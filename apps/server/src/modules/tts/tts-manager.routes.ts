/**
 * TTS Manager REST endpoints — model listing, load, unload, delete.
 * Mounted alongside existing tts.routes.ts.
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ttsManagerService } from './tts-manager.service';
import { ttsRouterService } from './tts-router.service';

export const ttsManagerRoutes: FastifyPluginAsync = async (app) => {
  // All manager routes require authentication
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // List all models with status
  app.get('/models', async (_request, reply) => {
    try {
      const models = await ttsManagerService.listModelsWithStatus();
      return reply.send(models);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list models';
      return reply.code(500).send({ error: message });
    }
  });

  // Get single model details + status
  app.get<{ Params: { name: string } }>('/models/:name', async (request, reply) => {
    try {
      const { name } = request.params;
      const model = ttsManagerService.getModelInfo(name);
      if (!model) {
        return reply.code(404).send({ error: `Model not found: ${name}` });
      }

      const status = await ttsManagerService.getModelStatus(name);
      return reply.send({ ...model, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get model';
      return reply.code(500).send({ error: message });
    }
  });

  // Load a model (creates k8s deployment)
  app.post<{ Params: { name: string } }>('/models/:name/load', async (request, reply) => {
    try {
      const { name } = request.params;

      if (!ttsManagerService.checkVRAMLimit(name)) {
        const model = ttsManagerService.getModelInfo(name);
        return reply.code(400).send({
          error: `Model ${name} requires ${model?.vramMB || '?'}MB VRAM, limit is ${ttsManagerService['config']?.tts?.maxVramMB || 20000}MB`,
        });
      }

      await ttsManagerService.loadModel(name);
      return reply.send({ status: 'loading', model: name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load model';
      return reply.code(500).send({ error: message });
    }
  });

  // Unload a model (deletes k8s deployment)
  app.post<{ Params: { name: string } }>('/models/:name/unload', async (request, reply) => {
    try {
      const { name } = request.params;
      await ttsManagerService.unloadModel(name);
      return reply.send({ status: 'unloaded', model: name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unload model';
      return reply.code(500).send({ error: message });
    }
  });

  // Get active model info
  app.get('/active', async (_request, reply) => {
    try {
      const active = await ttsManagerService.getActiveModel();
      if (!active) {
        return reply.send({ active: false });
      }

      const model = ttsManagerService.getModelInfo(active.modelName);
      const status = await ttsManagerService.getModelStatus(active.modelName);
      return reply.send({
        active: true,
        modelName: active.modelName,
        serviceUrl: active.serviceUrl,
        status,
        ...model,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get active model';
      return reply.code(500).send({ error: message });
    }
  });

  // Get voices for active model (proxied)
  app.get('/voices', async (_request, reply) => {
    try {
      const voices = await ttsRouterService.getVoices();
      return reply.send(voices);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch voices';
      return reply.code(500).send({ error: message });
    }
  });
};
