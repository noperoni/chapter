'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fixEncodingIssues } from '@/lib/text-cleanup';

/**
 * Split text into sentences using the same logic as the server's TextChunker.
 * Must stay in sync with server/src/modules/tts/chunker.ts → splitSentencesComplete
 */
function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  // Match sentence text + punctuation + any trailing closing quotes/brackets
  // Must stay in sync with server's splitSentencesComplete in chunker.ts
  const regex = /[^.!?]+[.!?]+["\u201D'\u2019)\]]*\s*/g;
  let match;
  let lastEnd = 0;

  while ((match = regex.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) sentences.push(trimmed);
    lastEnd = match.index + match[0].length;
  }

  const remaining = text.substring(lastEnd).trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push(text.trim());
  }

  return sentences;
}

interface ReadAlongViewProps {
  chapter: any;
  isLoading: boolean;
  onScrollProgress?: (percentage: number) => void;
  initialScrollPosition?: number;
  /** Index of the currently playing sentence (global across all paragraphs) */
  activeSentenceIndex?: number | null;
  /** Called when user clicks a sentence to play from it */
  onSentenceClick?: (globalSentenceIndex: number) => void;
  /** Number of chunks available (generated) — sentences beyond this are dimmed in debug mode */
  availableChunks?: number;
  /** Show debug indicators (generation frontier, chunk indices) */
  debugMode?: boolean;
  /** Whether listening mode is active (enables click-to-seek and highlighting) */
  isListening?: boolean;
}

export function ReadAlongView({
  chapter,
  isLoading,
  onScrollProgress,
  initialScrollPosition,
  activeSentenceIndex,
  onSentenceClick,
  availableChunks,
  debugMode,
  isListening,
}: ReadAlongViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasRestoredScroll = useRef(false);
  const restoreTimeouts = useRef<NodeJS.Timeout[]>([]);
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  // Detect if paragraph 0 is a duplicate of the chapter title (already rendered in header).
  // The EPUB parser includes <h1> title text in textContent, so the server creates
  // audio chunks for it. We skip rendering it as a paragraph but account for the
  // chunk offset so sentence indices still map correctly to server chunks.
  const titleParagraphCount = useMemo(() => {
    if (!chapter?.title || !chapter?.paragraphs?.length) return 0;
    const firstParaText = fixEncodingIssues(chapter.paragraphs[0].text).trim();
    return firstParaText === chapter.title.trim() ? 1 : 0;
  }, [chapter]);

  // Precompute sentence arrays for all paragraphs (excluding title paragraph)
  const paragraphSentences = useMemo(() => {
    if (!chapter?.paragraphs) return [];
    return chapter.paragraphs.slice(titleParagraphCount).map((p: any) =>
      splitIntoSentences(fixEncodingIssues(p.text))
    );
  }, [chapter, titleParagraphCount]);

  // Number of server chunks consumed by skipped title paragraph(s)
  const chunkOffset = useMemo(() => {
    if (!chapter?.paragraphs || titleParagraphCount === 0) return 0;
    let offset = 0;
    for (let i = 0; i < titleParagraphCount; i++) {
      offset += splitIntoSentences(fixEncodingIssues(chapter.paragraphs[i].text)).length;
    }
    return offset;
  }, [chapter, titleParagraphCount]);

  // Cumulative sentence offsets per paragraph (for global index calculation)
  const paragraphOffsets = useMemo(() => {
    const offsets: number[] = [0];
    for (let i = 0; i < paragraphSentences.length; i++) {
      offsets.push(offsets[i] + paragraphSentences[i].length);
    }
    return offsets;
  }, [paragraphSentences]);

  // Auto-scroll to keep the active sentence visible
  useEffect(() => {
    if (activeSentenceRef.current && isListening && activeSentenceIndex !== null && activeSentenceIndex !== undefined) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex, isListening]);

  const handleScroll = useCallback(() => {
    if (!onScrollProgress) return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrollable = scrollHeight - clientHeight;
    const percentage = scrollable > 0 ? (scrollTop / scrollable) * 100 : 0;
    onScrollProgress(percentage);
  }, [onScrollProgress]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (
      initialScrollPosition !== undefined &&
      initialScrollPosition > 0 &&
      chapter &&
      !isLoading &&
      !hasRestoredScroll.current
    ) {
      hasRestoredScroll.current = true;
      restoreTimeouts.current.forEach(clearTimeout);
      restoreTimeouts.current = [];

      const restoreScroll = () => {
        const trackLength = document.documentElement.scrollHeight - window.innerHeight;
        if (trackLength > 0) {
          window.scrollTo({
            top: (initialScrollPosition / 100) * trackLength,
            behavior: 'instant',
          });
        }
      };

      restoreTimeouts.current = [setTimeout(restoreScroll, 100), setTimeout(restoreScroll, 300)];
    }

    return () => restoreTimeouts.current.forEach(clearTimeout);
  }, [chapter, initialScrollPosition, isLoading]);

  useEffect(() => {
    hasRestoredScroll.current = false;
  }, [chapter]);

  useEffect(() => {
    if (chapter && !isLoading) {
      setIsVisible(false);
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [chapter, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg
          className="animate-spin h-6 w-6 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Chapter not found</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-48 bg-[hsl(var(--reader-bg))]">
      <article
        ref={contentRef}
        className={`reader-content max-w-[42rem] mx-auto px-6 sm:px-8 md:px-12 pt-24 pb-16 transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {chapter.title && (
          <header className="mb-12 animate-fade-in">
            <div className="flex items-center justify-center mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-semibold mb-4 text-center tracking-tight leading-tight text-[hsl(var(--reader-text))]">
              {chapter.title}
            </h1>

            <div className="flex items-center justify-center mt-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
            </div>
          </header>
        )}

        <div className="space-y-6">
          {chapter.paragraphs?.slice(titleParagraphCount).map((paragraph: any, pIndex: number) => {
            const sentences = paragraphSentences[pIndex] || [];
            const globalOffset = paragraphOffsets[pIndex] || 0;

            return (
              <p
                key={pIndex}
                className={`hyphenate text-[hsl(var(--reader-text))] animate-fade-in-stagger whitespace-pre-line ${
                  pIndex === 0 && chapter.title ? 'drop-cap mt-8' : ''
                }`}
                style={{
                  animationDelay: `${Math.min(pIndex * 50, 400)}ms`,
                }}
                lang="en"
              >
                {sentences.map((sentence: string, sIndex: number) => {
                  // chunkOffset maps UI sentence indices to server chunk indices
                  const chunkIdx = chunkOffset + globalOffset + sIndex;
                  const isActive = isListening && activeSentenceIndex === chunkIdx;
                  const isAvailable = availableChunks === undefined || chunkIdx < availableChunks;
                  const isFrontier = debugMode && isListening && availableChunks !== undefined && chunkIdx === availableChunks - 1;

                  return (
                    <span key={sIndex}>
                      <span
                        ref={isActive ? activeSentenceRef : undefined}
                        data-sentence-idx={chunkIdx}
                        className={`transition-all duration-300 ${
                          isListening ? 'cursor-pointer hover:bg-[hsl(var(--reader-accent))]/10 rounded-sm' : ''
                        } ${
                          isActive
                            ? 'bg-[hsl(var(--reader-accent))]/20 rounded-sm shadow-[0_0_0_3px_hsl(var(--reader-accent)/0.1)]'
                            : ''
                        } ${
                          debugMode && isListening && !isAvailable
                            ? 'opacity-35'
                            : ''
                        } ${
                          isFrontier
                            ? 'border-b border-dashed border-emerald-400/50'
                            : ''
                        }`}
                        onClick={
                          isListening && onSentenceClick
                            ? () => onSentenceClick(chunkIdx)
                            : undefined
                        }
                      >
                        {debugMode && isListening && (
                          <span className="text-[9px] font-mono text-[hsl(var(--reader-text))]/25 align-super mr-0.5 select-none">
                            {chunkIdx}
                          </span>
                        )}
                        {sentence}
                      </span>
                      {sIndex < sentences.length - 1 ? ' ' : ''}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>

        <div
          className="flex items-center justify-center mt-16 mb-8 animate-fade-in"
          style={{ animationDelay: '600ms' }}
        >
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
        </div>
      </article>
    </main>
  );
}
