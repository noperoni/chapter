'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { fixEncodingIssues } from '@/lib/text-cleanup';

interface ChapterReaderProps {
  chapter: {
    title?: string;
    htmlContent?: string;
    href?: string;
  } | null;
  bookId: string;
  isLoading: boolean;
  onScrollProgress?: (percentage: number) => void;
  initialScrollPosition?: number;
  className?: string;
}

/**
 * Rewrite <img src="..."> in EPUB HTML to point at our epub-asset API endpoint.
 * Skips absolute URLs and data URIs.
 */
function rewriteImageUrls(html: string, bookId: string, chapterHref: string): string {
  return html.replace(
    /(<img\s+[^>]*?)src=["']([^"']+)["']/gi,
    (_match, before: string, src: string) => {
      if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) {
        return `${before}src="${src}"`;
      }
      const url = apiClient.getEpubAssetUrl(bookId, chapterHref, src);
      return `${before}src="${url}"`;
    }
  );
}

export function ChapterReader({
  chapter,
  bookId,
  isLoading,
  onScrollProgress,
  initialScrollPosition,
  className = '',
}: ChapterReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasRestoredScroll = useRef(false);
  const restoreTimeouts = useRef<NodeJS.Timeout[]>([]);

  const content = useMemo(() => {
    if (!chapter?.htmlContent) return '';

    let html = chapter.htmlContent;

    // Rewrite image URLs if we have a chapter href
    if (chapter.href) {
      html = rewriteImageUrls(html, bookId, chapter.href);
    }

    return html;
  }, [chapter, bookId]);

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

  // Scroll position restoration
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

  // Reset scroll restoration on chapter change
  useEffect(() => {
    hasRestoredScroll.current = false;
  }, [chapter]);

  // Fade-in animation
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
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
    <main className={`min-h-screen pb-48 bg-[hsl(var(--reader-bg))] ${className}`}>
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
              {fixEncodingIssues(chapter.title)}
            </h1>
            <div className="flex items-center justify-center mt-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
            </div>
          </header>
        )}

        <div
          className="rich-epub-content text-[hsl(var(--reader-text))] animate-fade-in
            [&_p]:mb-6 [&_p]:leading-[1.8] [&_p]:text-[1.125rem] sm:[&_p]:text-[1.1875rem] md:[&_p]:text-[1.25rem]
            [&_h1]:text-2xl [&_h1]:font-serif [&_h1]:font-semibold [&_h1]:text-center [&_h1]:my-8
            [&_h2]:text-xl [&_h2]:font-serif [&_h2]:text-center [&_h2]:my-6 [&_h2]:opacity-80
            [&_h3]:text-lg [&_h3]:font-serif [&_h3]:text-center [&_h3]:my-6 [&_h3]:italic
            [&_h4]:text-base [&_h4]:text-center [&_h4]:my-4 [&_h4]:opacity-60
            [&_blockquote]:border-l-2 [&_blockquote]:border-current/20 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:my-6
            [&_em]:italic [&_strong]:font-semibold
            [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:my-4
            [&_ol]:list-decimal [&_ol]:pl-8 [&_ol]:my-4
            [&_li]:mb-2
            [&_hr]:my-8 [&_hr]:border-current/10
            [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:my-8 [&_img]:rounded-lg
            [&_figure]:my-8 [&_figure]:text-center
            [&_figcaption]:text-sm [&_figcaption]:opacity-60 [&_figcaption]:mt-2 [&_figcaption]:italic
            [&_table]:w-full [&_table]:my-6 [&_table]:border-collapse
            [&_td]:p-2 [&_td]:border [&_td]:border-current/10
            [&_th]:p-2 [&_th]:border [&_th]:border-current/10 [&_th]:font-semibold
            [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-current/30
            [&_pre]:bg-current/5 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-4
            [&_code]:font-mono [&_code]:text-sm"
          dangerouslySetInnerHTML={{ __html: content }}
        />

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
