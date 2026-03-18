'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface TTSTelemetryProps {
  /** Total sentence chunks the server created for this chapter */
  totalChunks: number | null;
  /** Currently cached/generated chunks from the server */
  generatedChunks: number;
  /** Index of the chunk currently playing */
  activeChunkIndex: number | null;
  /** Whether initial generation is in progress */
  isGenerating: boolean;
  /** Whether a single on-demand chunk is being generated */
  isChunkLoading: boolean;
  /** Voice ID being used */
  voiceId: string;
  /** TTS speed setting */
  speed: number;
  /** Total audio size in bytes from cached chunks */
  totalAudioSize: number;
  /** Total audio duration from cached chunks */
  totalAudioDuration: number;
}

export function TTSTelemetry({
  totalChunks,
  generatedChunks,
  activeChunkIndex,
  isGenerating,
  isChunkLoading,
  voiceId,
  speed,
  totalAudioSize,
  totalAudioDuration,
}: TTSTelemetryProps) {
  const [expanded, setExpanded] = useState(false);
  const [genRate, setGenRate] = useState<number | null>(null);
  const prevCountRef = useRef(generatedChunks);
  const prevTimeRef = useRef(Date.now());
  const rateHistoryRef = useRef<number[]>([]);

  // Calculate generation rate from chunk count changes
  useEffect(() => {
    const now = Date.now();
    const elapsed = (now - prevTimeRef.current) / 1000;
    const delta = generatedChunks - prevCountRef.current;

    if (delta > 0 && elapsed > 0.5) {
      const rate = delta / elapsed;
      rateHistoryRef.current.push(rate);
      // Keep last 5 measurements for smoothing
      if (rateHistoryRef.current.length > 5) {
        rateHistoryRef.current.shift();
      }
      const avg =
        rateHistoryRef.current.reduce((a, b) => a + b, 0) /
        rateHistoryRef.current.length;
      setGenRate(avg);
    }

    prevCountRef.current = generatedChunks;
    prevTimeRef.current = now;
  }, [generatedChunks]);

  // Reset rate when chapter changes (totalChunks changes)
  useEffect(() => {
    rateHistoryRef.current = [];
    setGenRate(null);
    prevCountRef.current = 0;
    prevTimeRef.current = Date.now();
  }, [totalChunks]);

  const progress = totalChunks ? Math.round((generatedChunks / totalChunks) * 100) : 0;
  const remaining = totalChunks ? totalChunks - generatedChunks : 0;
  const isDone = totalChunks !== null && generatedChunks >= totalChunks;

  const eta = useMemo(() => {
    if (!genRate || remaining <= 0) return null;
    const seconds = remaining / genRate;
    if (seconds < 60) return `~${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `~${mins}m ${secs}s`;
  }, [genRate, remaining]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Status indicator color
  const statusColor = isGenerating || isChunkLoading
    ? 'text-amber-400'
    : isDone
      ? 'text-emerald-400'
      : 'text-blue-400';

  if (totalChunks === null && !isGenerating) return null;

  return (
    <div className="fixed top-4 right-4 z-50 select-none">
      <div
        className={`
          bg-[hsl(var(--reader-bg))]/95 backdrop-blur-xl
          border border-[hsl(var(--reader-text))]/10
          rounded-xl shadow-2xl
          transition-all duration-300 ease-out
          ${expanded ? 'w-72' : 'w-auto'}
        `}
      >
        {/* Compact header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[hsl(var(--reader-text))]/5 rounded-xl transition-colors"
        >
          <Activity className={`w-3.5 h-3.5 ${statusColor} ${(isGenerating || isChunkLoading) ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-mono font-medium text-[hsl(var(--reader-text))]/70">
            {totalChunks !== null ? (
              <>
                {generatedChunks}/{totalChunks}
                <span className="text-[hsl(var(--reader-text))]/40 ml-1">
                  {isDone ? '✓' : `${progress}%`}
                </span>
              </>
            ) : (
              'Initializing...'
            )}
          </span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-[hsl(var(--reader-text))]/40 ml-auto" />
          ) : (
            <ChevronDown className="w-3 h-3 text-[hsl(var(--reader-text))]/40 ml-auto" />
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-[hsl(var(--reader-text))]/5">
            {/* Progress bar */}
            {totalChunks !== null && (
              <div className="pt-2.5">
                <div className="h-1.5 w-full bg-[hsl(var(--reader-text))]/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isDone
                        ? 'bg-emerald-400/60'
                        : 'bg-blue-400/60'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="space-y-1 font-mono text-[10px] leading-relaxed">
              <Row label="Model" value="Kokoro TTS" />
              <Row label="Voice" value={voiceId} />
              <Row label="Speed" value={`${speed}x`} />
              <Row label="Chunks" value={
                totalChunks !== null
                  ? `${generatedChunks} / ${totalChunks}${isDone ? ' (done)' : ''}`
                  : '—'
              } />
              {genRate !== null && !isDone && (
                <Row label="Rate" value={`${genRate.toFixed(1)} chunks/s`} />
              )}
              {eta && !isDone && (
                <Row label="ETA" value={eta} />
              )}
              {activeChunkIndex !== null && (
                <Row label="Playing" value={`chunk #${activeChunkIndex}`} />
              )}
              <Row label="Audio" value={formatBytes(totalAudioSize)} />
              <Row label="Duration" value={formatDuration(totalAudioDuration)} />
              {isChunkLoading && (
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse" />
                  <span className="text-amber-400/80">On-demand synthesis...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[hsl(var(--reader-text))]/40 shrink-0">{label}</span>
      <span className="text-[hsl(var(--reader-text))]/70 truncate text-right">{value}</span>
    </div>
  );
}
