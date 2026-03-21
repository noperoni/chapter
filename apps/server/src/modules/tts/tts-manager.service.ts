/**
 * TTS Manager Service — creates/deletes TTS model deployments via k8s API.
 * Tracks active model in Prisma DB. Enforces VRAM limits.
 * Uses in-cluster ServiceAccount (tts-manager) for k8s access.
 */

import * as k8s from '@kubernetes/client-node';
import { prisma } from '../../core/database';
import { config } from '../../core/config';
import { getAllModels, getModel, isKnownModel, type ModelRegistryEntry } from './model-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelStatus =
  | 'available' // In registry, not deployed
  | 'loading' // Deployment exists, pod not ready
  | 'loaded' // Pod running and ready
  | 'unloading' // Deletion in progress
  | 'error'; // Pod in error state

export interface ModelWithStatus extends ModelRegistryEntry {
  status: ModelStatus;
  serviceUrl?: string;
}

// ---------------------------------------------------------------------------
// k8s Client Setup
// ---------------------------------------------------------------------------

const kc = new k8s.KubeConfig();
kc.loadFromCluster(); // Uses in-cluster ServiceAccount token

const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

const NAMESPACE = config.tts.namespace;
const NODE_SELECTOR = config.tts.nodeSelector;
const NVIDIA_LIBS = config.tts.nvidiaDriverLibsPath;

const LABELS = {
  component: 'app.kubernetes.io/component',
  model: 'tts-model',
  managedBy: 'app.kubernetes.io/managed-by',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TTSManagerService {
  // ---- Startup Sync ----

  /**
   * On startup, detect any existing TTS model deployments (e.g. the static
   * tts-kokoro) and register them in the DB so the UI shows them as loaded.
   */
  async syncExistingModels(): Promise<void> {
    try {
      const models = getAllModels();
      for (const model of models) {
        const status = await this.getModelStatus(model.name);
        if (status === 'loaded' || status === 'loading') {
          const existing = await prisma.activeTTSModel.findUnique({
            where: { modelName: model.name },
          });
          if (!existing) {
            const serviceUrl = `http://tts-${model.name}.${NAMESPACE}.svc.cluster.local:${model.port}`;
            await prisma.activeTTSModel.create({
              data: { modelName: model.name, serviceUrl },
            });
            console.log(`[TTS Manager] Auto-registered existing deployment: ${model.name}`);
          }
        }
      }
    } catch (e) {
      // Non-fatal — k8s API may not be available in dev
      console.warn('[TTS Manager] Could not sync existing models:', (e as Error).message);
    }
  }

  // ---- Registry ----

  getRegistry(): ModelRegistryEntry[] {
    return getAllModels();
  }

  getModelInfo(name: string): ModelRegistryEntry | undefined {
    return getModel(name);
  }

  // ---- Status ----

  async getModelStatus(name: string): Promise<ModelStatus> {
    try {
      const dep = await appsApi.readNamespacedDeployment({
        name: `tts-${name}`,
        namespace: NAMESPACE,
      });
      const status = dep.status;
      if (status?.readyReplicas && status.readyReplicas > 0) return 'loaded';
      if (status?.unavailableReplicas && status.unavailableReplicas > 0) return 'loading';
      return 'loading';
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.response?.statusCode === 404) return 'available';
      console.error(`[TTS Manager] Error checking status for ${name}:`, e?.message);
      return 'error';
    }
  }

  async getActiveModel(): Promise<{ modelName: string; serviceUrl: string } | null> {
    const active = await prisma.activeTTSModel.findFirst();
    return active ? { modelName: active.modelName, serviceUrl: active.serviceUrl } : null;
  }

  async listModelsWithStatus(): Promise<ModelWithStatus[]> {
    const models = getAllModels();
    const active = await this.getActiveModel();

    return Promise.all(
      models.map(async (m) => {
        const status = await this.getModelStatus(m.name);
        return {
          ...m,
          status,
          serviceUrl:
            status === 'loaded'
              ? `http://tts-${m.name}.${NAMESPACE}.svc.cluster.local:${m.port}`
              : undefined,
        };
      })
    );
  }

  // ---- Lifecycle ----

  async loadModel(name: string): Promise<void> {
    const model = getModel(name);
    if (!model) throw new Error(`Unknown model: ${name}`);

    // VRAM guard
    if (model.vramMB > config.tts.maxVramMB) {
      throw new Error(
        `Model ${name} requires ${model.vramMB}MB VRAM, limit is ${config.tts.maxVramMB}MB`
      );
    }

    // Unload any currently loaded model first (one-at-a-time rule)
    const active = await this.getActiveModel();
    if (active && active.modelName !== name) {
      console.log(`[TTS Manager] Unloading ${active.modelName} before loading ${name}`);
      await this.unloadModel(active.modelName);
    }

    if (active && active.modelName === name) {
      console.log(`[TTS Manager] ${name} is already loaded`);
      return;
    }

    console.log(`[TTS Manager] Loading model: ${name}`);

    // Create Deployment
    await this.createDeployment(model);
    // Create Service
    await this.createService(model);

    const serviceUrl = `http://tts-${name}.${NAMESPACE}.svc.cluster.local:${model.port}`;

    // Track in DB
    await prisma.activeTTSModel.upsert({
      where: { modelName: name },
      update: { serviceUrl, loadedAt: new Date() },
      create: { modelName: name, serviceUrl },
    });

    console.log(`[TTS Manager] Model ${name} deployment created, waiting for readiness`);
  }

  async unloadModel(name: string): Promise<void> {
    console.log(`[TTS Manager] Unloading model: ${name}`);

    // Delete Deployment (ignore 404)
    try {
      await appsApi.deleteNamespacedDeployment({
        name: `tts-${name}`,
        namespace: NAMESPACE,
      });
    } catch (e: any) {
      if (e?.statusCode !== 404 && e?.response?.statusCode !== 404) throw e;
    }

    // Delete Service (ignore 404)
    try {
      await coreApi.deleteNamespacedService({
        name: `tts-${name}`,
        namespace: NAMESPACE,
      });
    } catch (e: any) {
      if (e?.statusCode !== 404 && e?.response?.statusCode !== 404) throw e;
    }

    // Remove from DB
    await prisma.activeTTSModel.deleteMany({ where: { modelName: name } });

    console.log(`[TTS Manager] Model ${name} unloaded`);
  }

  // ---- VRAM Guard ----

  checkVRAMLimit(name: string): boolean {
    const model = getModel(name);
    if (!model) return false;
    return model.vramMB <= config.tts.maxVramMB;
  }

  // ---- k8s Resource Creation ----

  private async createDeployment(model: ModelRegistryEntry): Promise<void> {
    const name = `tts-${model.name}`;

    // Build env vars from registry
    const envVars: k8s.V1EnvVar[] = Object.entries(model.env).map(([k, v]) => ({
      name: k,
      value: v,
    }));

    // GPU workaround for Garuda Linux — mount nvidia driver libs directly
    const volumeMounts: k8s.V1VolumeMount[] = [];
    const volumes: k8s.V1Volume[] = [];

    if (model.gpu) {
      envVars.push(
        { name: 'NVIDIA_VISIBLE_DEVICES', value: 'void' },
        { name: 'LD_LIBRARY_PATH', value: '/usr/local/nvidia/lib64' }
      );

      volumeMounts.push(
        { name: 'nvidia-driver-libs', mountPath: '/usr/local/nvidia/lib64', readOnly: true },
        { name: 'nvidia-dev-0', mountPath: '/dev/nvidia0' },
        { name: 'nvidiactl', mountPath: '/dev/nvidiactl' },
        { name: 'nvidia-uvm', mountPath: '/dev/nvidia-uvm' },
        { name: 'nvidia-uvm-tools', mountPath: '/dev/nvidia-uvm-tools' }
      );

      volumes.push(
        { name: 'nvidia-driver-libs', hostPath: { path: NVIDIA_LIBS, type: 'Directory' } },
        { name: 'nvidia-dev-0', hostPath: { path: '/dev/nvidia0' } },
        { name: 'nvidiactl', hostPath: { path: '/dev/nvidiactl' } },
        { name: 'nvidia-uvm', hostPath: { path: '/dev/nvidia-uvm' } },
        { name: 'nvidia-uvm-tools', hostPath: { path: '/dev/nvidia-uvm-tools' } }
      );
    }

    const deployment: k8s.V1Deployment = {
      metadata: {
        name,
        namespace: NAMESPACE,
        labels: {
          [LABELS.component]: 'tts-model',
          [LABELS.model]: model.name,
          [LABELS.managedBy]: 'tts-manager',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: { [LABELS.model]: model.name },
        },
        template: {
          metadata: {
            labels: {
              [LABELS.component]: 'tts-model',
              [LABELS.model]: model.name,
              [LABELS.managedBy]: 'tts-manager',
            },
          },
          spec: {
            nodeSelector: { 'kubernetes.io/hostname': NODE_SELECTOR },
            containers: [
              {
                name: 'tts',
                image: model.image,
                ports: [{ containerPort: model.port }],
                env: envVars,
                volumeMounts,
                resources: {
                  limits: {
                    memory: model.memoryLimit,
                    ...(model.gpu ? { 'nvidia.com/gpu': '1' } : {}),
                  },
                },
                readinessProbe: {
                  httpGet: { path: model.healthEndpoint, port: model.port as any },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 30, // Allow up to 5 minutes for large models
                },
                ...(model.gpu ? { securityContext: { privileged: true } } : {}),
              },
            ],
            volumes,
          },
        },
      },
    };

    try {
      await appsApi.createNamespacedDeployment({
        namespace: NAMESPACE,
        body: deployment,
      });
    } catch (e: any) {
      if (e?.statusCode === 409 || e?.response?.statusCode === 409) {
        // Already exists — delete and recreate with desired state
        await appsApi.deleteNamespacedDeployment({ name, namespace: NAMESPACE });
        await appsApi.createNamespacedDeployment({
          namespace: NAMESPACE,
          body: deployment,
        });
      } else {
        throw e;
      }
    }
  }

  private async createService(model: ModelRegistryEntry): Promise<void> {
    const name = `tts-${model.name}`;

    const service: k8s.V1Service = {
      metadata: {
        name,
        namespace: NAMESPACE,
        labels: {
          [LABELS.component]: 'tts-model',
          [LABELS.model]: model.name,
          [LABELS.managedBy]: 'tts-manager',
        },
      },
      spec: {
        selector: { [LABELS.model]: model.name },
        ports: [{ port: model.port, targetPort: model.port as any, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };

    try {
      await coreApi.createNamespacedService({
        namespace: NAMESPACE,
        body: service,
      });
    } catch (e: any) {
      if (e?.statusCode === 409 || e?.response?.statusCode === 409) {
        // Already exists — that's fine
        return;
      }
      throw e;
    }
  }
}

export const ttsManagerService = new TTSManagerService();
