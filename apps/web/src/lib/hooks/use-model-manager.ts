import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api-client';

type ModelStatus = 'available' | 'downloading' | 'loaded' | 'unloading' | 'error';

interface ModelWithStatus {
  name: string;
  displayName: string;
  family: string;
  description: string;
  vramMB: number;
  parameters: string;
  gpu: boolean;
  capabilities: {
    voiceCloning: boolean;
    emotionTags: boolean;
    streaming: boolean;
    speedControl: boolean;
  };
  voices: Array<{
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    language: string;
  }>;
  languages: string[];
  license: string;
  status: ModelStatus;
}

interface ActiveModel {
  active: boolean;
  modelName?: string;
  serviceUrl?: string;
  status?: ModelStatus;
  displayName?: string;
  voices?: ModelWithStatus['voices'];
}

export function useModels() {
  return useQuery<ModelWithStatus[]>({
    queryKey: ['tts-models'],
    queryFn: () => apiClient.getModels(),
    refetchInterval: 15000,
  });
}

export function useActiveModel() {
  return useQuery<ActiveModel>({
    queryKey: ['tts-active-model'],
    queryFn: () => apiClient.getActiveModel(),
    refetchInterval: 10000,
  });
}

export function useModelManager() {
  const queryClient = useQueryClient();
  const { data: models, isLoading: modelsLoading } = useModels();
  const { data: activeModel, isLoading: activeLoading } = useActiveModel();
  const [pollingModel, setPollingModel] = useState<string | null>(null);

  // Poll individual model status during loading
  const { data: pollingStatus } = useQuery({
    queryKey: ['tts-model-status', pollingModel],
    queryFn: () => apiClient.getModel(pollingModel!),
    enabled: !!pollingModel,
    refetchInterval: 2000,
  });

  // Stop polling when model reaches terminal state
  useEffect(() => {
    if (!pollingStatus) return;
    const status = pollingStatus.status as ModelStatus;
    if (status === 'loaded' || status === 'error' || status === 'available') {
      setPollingModel(null);
      queryClient.invalidateQueries({ queryKey: ['tts-models'] });
      queryClient.invalidateQueries({ queryKey: ['tts-active-model'] });
      queryClient.invalidateQueries({ queryKey: ['tts-voices'] });
    }
  }, [pollingStatus, queryClient]);

  const loadMutation = useMutation({
    mutationFn: (name: string) => apiClient.loadModel(name),
    onSuccess: (_data, name) => {
      setPollingModel(name);
      queryClient.invalidateQueries({ queryKey: ['tts-models'] });
      queryClient.invalidateQueries({ queryKey: ['tts-active-model'] });
    },
  });

  const unloadMutation = useMutation({
    mutationFn: (name: string) => apiClient.unloadModel(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tts-models'] });
      queryClient.invalidateQueries({ queryKey: ['tts-active-model'] });
      queryClient.invalidateQueries({ queryKey: ['tts-voices'] });
    },
  });

  const loadModel = useCallback(
    (name: string) => loadMutation.mutateAsync(name),
    [loadMutation]
  );

  const unloadModel = useCallback(
    (name: string) => unloadMutation.mutateAsync(name),
    [unloadMutation]
  );

  return {
    models: models || [],
    activeModel: activeModel || { active: false },
    modelsLoading,
    activeLoading,
    loadModel,
    unloadModel,
    isLoading: loadMutation.isPending,
    isUnloading: unloadMutation.isPending,
    loadingModel: pollingModel,
    loadError: loadMutation.error,
    unloadError: unloadMutation.error,
  };
}
