'use client';

import { useState, useMemo } from 'react';
import { Select } from '@base-ui/react/select';
import { Slider } from '@base-ui/react/slider';
import { useModelManager } from '@/lib/hooks/use-model-manager';
import { useTTS } from '@/lib/hooks/use-tts';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { ModelWithStatus } from '@/lib/hooks/use-model-manager';
import {
  Cpu,
  Zap,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
  Mic,
  Globe,
} from 'lucide-react';

function formatVRAM(mb: number): string {
  if (mb === 0) return 'CPU';
  if (mb >= 1000) return `${(mb / 1000).toFixed(0)}GB`;
  return `${mb}MB`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
  return `${(bytes / 1_000_000).toFixed(0)}MB`;
}

interface ModelCardProps {
  model: ModelWithStatus;
  isActive: boolean;
  isLoadingThis: boolean;
  onLoad: () => void;
  onUnload: () => void;
}

function ModelCard({ model, isActive, isLoadingThis, onLoad, onUnload }: ModelCardProps) {
  const status = model.status as string;
  const isLoaded = status === 'loaded';
  const isError = status === 'error';

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        isActive
          ? 'border-green-500/40 bg-green-500/5'
          : isError
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white/90 truncate">
              {model.displayName}
            </h3>
            <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/50">
              {model.parameters}
            </span>
          </div>
          <p className="text-xs text-white/40 line-clamp-2 mb-2">{model.description}</p>
          <div className="flex items-center gap-3 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              {model.gpu ? <Zap className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
              {formatVRAM(model.vramMB)}
            </span>
            <span>{model.voices?.length || 0} voices</span>
            <span>{model.languages?.length || 0} langs</span>
            {model.capabilities?.voiceCloning && (
              <span className="flex items-center gap-0.5">
                <Mic className="w-3 h-3" />
                clone
              </span>
            )}
            {model.capabilities?.emotionTags && <span>emotions</span>}
          </div>
        </div>

        <div className="shrink-0">
          {isLoadingThis ? (
            <button
              disabled
              className="h-8 px-3 rounded-lg bg-white/10 text-white/50 text-xs font-medium flex items-center gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading...
            </button>
          ) : isLoaded || isActive ? (
            <button
              onClick={onUnload}
              className="h-8 px-3 rounded-lg border border-white/20 bg-white/5 text-white/60 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors text-xs font-medium flex items-center gap-1.5"
            >
              <PowerOff className="w-3.5 h-3.5" />
              Unload
            </button>
          ) : isError ? (
            <button
              onClick={onLoad}
              className="h-8 px-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Retry
            </button>
          ) : (
            <button
              onClick={onLoad}
              className="h-8 px-3 rounded-lg border border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90 transition-colors text-xs font-medium flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              Load
            </button>
          )}
        </div>
      </div>

      {/* Loading progress bar */}
      {isLoadingThis && (
        <div className="mt-3">
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/30 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            Starting model... First load may take a few minutes to pull the image.
          </p>
        </div>
      )}
    </div>
  );
}

// Group voices by language for the picker
function groupVoicesByLanguage(
  voices: Array<{ id: string; name: string; gender: string; language: string }>
) {
  const groups: Record<string, typeof voices> = {};
  for (const voice of voices) {
    const lang = voice.language || 'other';
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(voice);
  }
  return groups;
}

const LANGUAGE_LABELS: Record<string, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  it: 'Italian',
  'pt-BR': 'Portuguese (BR)',
  multi: 'Multilingual',
};

export function TTSSettings() {
  const {
    models,
    activeModel,
    modelsLoading,
    loadModel,
    unloadModel,
    loadingModel,
    loadError,
    unloadError,
  } = useModelManager();
  const { voices, voicesLoading } = useTTS();
  const { tts, setTTSSettings } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (name: string) => {
    setError(null);
    try {
      await loadModel(name);
      setTTSSettings({ modelName: name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load model');
    }
  };

  const handleUnload = async (name: string) => {
    setError(null);
    try {
      await unloadModel(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unload model');
    }
  };

  // Group voices by language for the picker
  const voiceGroups = useMemo(() => {
    if (!voices || voices.length === 0) return {};
    return groupVoicesByLanguage(voices);
  }, [voices]);

  const activeModelName = activeModel?.active ? activeModel.modelName : null;
  const totalVRAM = 24000; // RTX 3090

  return (
    <div className="space-y-6">
      {/* Active Model Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`w-2 h-2 rounded-full ${activeModelName ? 'bg-green-500' : 'bg-white/30'}`}
          />
          <span className="text-sm text-white/60">
            {activeModelName
              ? `Active: ${activeModel.displayName || activeModelName}`
              : 'No model loaded'}
          </span>
        </div>

        {/* VRAM Usage */}
        {activeModelName && (
          <div className="mb-4">
            {(() => {
              const activeEntry = models.find((m) => m.name === activeModelName);
              const usedVRAM = activeEntry?.vramMB || 0;
              const pct = Math.min((usedVRAM / totalVRAM) * 100, 100);
              return (
                <div>
                  <div className="flex justify-between text-[11px] text-white/40 mb-1">
                    <span>VRAM: {formatVRAM(usedVRAM)} / {formatVRAM(totalVRAM)}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 80 ? 'bg-red-500/70' : pct > 50 ? 'bg-yellow-500/70' : 'bg-green-500/70'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Error Display */}
      {(error || loadError || unloadError) && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error || (loadError instanceof Error ? loadError.message : '') || (unloadError instanceof Error ? unloadError.message : '')}
          </p>
        </div>
      )}

      {/* Model List */}
      <div>
        <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Available Models
        </h3>
        {modelsLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/40 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading models...
          </div>
        ) : (
          <div className="space-y-2">
            {models.map((model) => (
              <ModelCard
                key={model.name}
                model={model}
                isActive={activeModelName === model.name}
                isLoadingThis={loadingModel === model.name}
                onLoad={() => handleLoad(model.name)}
                onUnload={() => handleUnload(model.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Voice Picker — only shown when a model is active */}
      {activeModelName && (
        <div>
          <label className="text-sm font-medium mb-2 block text-white/90">Voice</label>
          {voicesLoading ? (
            <p className="text-sm text-white/50">Loading voices...</p>
          ) : voices.length === 0 ? (
            <p className="text-sm text-white/40">No voices available for this model.</p>
          ) : (
            <Select.Root
              value={tts.voiceId}
              onValueChange={(value) => value && setTTSSettings({ voiceId: value })}
            >
              <Select.Trigger className="flex items-center justify-between w-full h-11 px-4 rounded-xl border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 transition-colors">
                <Select.Value placeholder="Select a voice" />
                <Select.Icon>
                  <ChevronDown className="w-4 h-4 text-white/50" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner sideOffset={4} className="z-50">
                  <Select.Popup className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-1 shadow-2xl">
                    {Object.entries(voiceGroups).map(([lang, langVoices]) => (
                      <div key={lang}>
                        {Object.keys(voiceGroups).length > 1 && (
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                            {LANGUAGE_LABELS[lang] || lang}
                          </div>
                        )}
                        {langVoices.map((voice) => (
                          <Select.Item
                            key={voice.id}
                            value={voice.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer outline-none text-white/90 data-[highlighted]:bg-white/10 transition-colors"
                          >
                            <Select.ItemText>
                              {voice.name}{' '}
                              <span className="text-white/40">
                                ({voice.gender})
                              </span>
                            </Select.ItemText>
                            <Select.ItemIndicator>
                              <Check className="w-4 h-4 text-white" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </div>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          )}
        </div>
      )}

      {/* Speed Slider */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-white/90">Speed</label>
          <span className="text-sm font-medium text-white">{tts.speed.toFixed(1)}x</span>
        </div>
        <Slider.Root
          value={tts.speed}
          onValueChange={(value) => setTTSSettings({ speed: value })}
          min={0.5}
          max={2.0}
          step={0.1}
          className="flex flex-col gap-2"
        >
          <Slider.Control className="relative flex items-center h-5">
            <Slider.Track className="h-2 w-full bg-white/20 rounded-full">
              <Slider.Indicator className="h-full bg-white/70 rounded-full" />
              <Slider.Thumb className="w-5 h-5 bg-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-white/50 cursor-grab active:cursor-grabbing" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="flex justify-between text-xs text-white/50 mt-2">
          <span>0.5x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-white/90">Voice Variation</label>
          <span className="text-sm font-medium text-white">{tts.temperature.toFixed(1)}</span>
        </div>
        <Slider.Root
          value={tts.temperature}
          onValueChange={(value) => setTTSSettings({ temperature: value })}
          min={0.0}
          max={1.0}
          step={0.1}
          className="flex flex-col gap-2"
        >
          <Slider.Control className="relative flex items-center h-5">
            <Slider.Track className="h-2 w-full bg-white/20 rounded-full">
              <Slider.Indicator className="h-full bg-white/70 rounded-full" />
              <Slider.Thumb className="w-5 h-5 bg-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-white/50 cursor-grab active:cursor-grabbing" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="flex justify-between text-xs text-white/50 mt-2">
          <span>Consistent</span>
          <span>Natural</span>
          <span>Variable</span>
        </div>
      </div>
    </div>
  );
}
