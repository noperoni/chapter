'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@base-ui/react/select';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSettingsStore, type Theme, type FontSize } from '@/lib/stores/settings-store';
import { apiClient } from '@/lib/api-client';
import { LibraryFolders } from '@/components/library/library-folders';
import { TTSSettings } from '@/components/reader/TTSSettings';
import {
  ArrowLeft,
  ChevronDown,
  Check,
  Sun,
  Moon,
  BookOpen,
  Trash2,
  Database,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const { theme, fontSize, setTheme, setFontSize } = useSettingsStore();

  const [cacheStats, setCacheStats] = useState<{
    totalSizeMB: number;
    totalEntries: number;
  } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [metadataStats, setMetadataStats] = useState<{
    totalBooks: number;
    bloatedBooks: number;
    estimatedBloatMB: number;
  } | null>(null);
  const [cleaningMetadata, setCleaningMetadata] = useState(false);
  const [metadataCleaned, setMetadataCleaned] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load cache stats
  useEffect(() => {
    const loadCacheStats = async () => {
      try {
        const stats = await apiClient.getAudioCacheStats();
        setCacheStats({ totalSizeMB: stats.totalSizeMB, totalEntries: stats.totalEntries });
      } catch (error) {
        // Silently fail - cache stats are optional
      }
    };
    const loadMetadataStats = async () => {
      try {
        const stats = await apiClient.getMetadataStats();
        setMetadataStats(stats);
      } catch (error) {
        // Silently fail - stats are optional
      }
    };
    if (isAuthenticated) {
      loadCacheStats();
      loadMetadataStats();
    }
  }, [isAuthenticated]);

  const clearCache = async () => {
    setClearingCache(true);
    try {
      await apiClient.clearAudioCache();
      setCacheStats({ totalSizeMB: 0, totalEntries: 0 });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setClearingCache(false);
    }
  };

  const cleanMetadata = async () => {
    setCleaningMetadata(true);
    try {
      await apiClient.cleanMetadata();
      setMetadataStats((prev) => (prev ? { ...prev, bloatedBooks: 0, estimatedBloatMB: 0 } : prev));
      setMetadataCleaned(true);
    } catch (error) {
      console.error('Failed to clean metadata:', error);
    } finally {
      setCleaningMetadata(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const fontSizeOptions = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#1a1410',
        backgroundImage: 'url(/wood.png)',
        backgroundRepeat: 'repeat',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-black/60 via-black/40 to-transparent backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-[1.5rem] md:px-[3rem] py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-[18px] h-[18px]" />
              </button>
              <h1 className="text-lg font-semibold text-white/90">Settings</h1>
            </div>
            <button
              onClick={logout}
              className="h-10 px-5 rounded-full bg-white/5 hover:bg-white/10 text-white/90 text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          {/* Account Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white/90">Account</h2>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-white/50">Email</p>
                  <p className="font-medium text-white/90">{user?.email}</p>
                </div>
                {user?.name && (
                  <div>
                    <p className="text-sm text-white/50">Name</p>
                    <p className="font-medium text-white/90">{user.name}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Library Section */}
          <section className="mb-8">
            <LibraryFolders />
          </section>

          {/* TTS Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white/90">Text-to-Speech</h2>
            <TTSSettings />

            {/* Saved Audio */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-white/90">Saved Audio</p>
                  <p className="text-xs text-white/50">
                    {cacheStats ? `${cacheStats.totalSizeMB} MB used` : 'Loading...'}
                  </p>
                </div>
                <button
                  onClick={clearCache}
                  disabled={clearingCache || !cacheStats || cacheStats.totalEntries === 0}
                  className="h-9 px-4 rounded-lg border border-white/20 bg-white/5 text-white/70 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/20 disabled:hover:text-white/70"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {clearingCache ? 'Clearing...' : 'Clear'}
                </button>
              </div>
            </div>
          </section>

          {/* Reading Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white/90">Reading</h2>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block text-white/90">Font Size</label>
                <Select.Root
                  value={fontSize}
                  onValueChange={(value) => value && setFontSize(value as FontSize)}
                >
                  <Select.Trigger className="flex items-center justify-between w-full h-11 px-4 rounded-xl border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 transition-colors">
                    <Select.Value placeholder="Select font size" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner sideOffset={4} className="z-50">
                      <Select.Popup className="rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-1 shadow-2xl">
                        {fontSizeOptions.map((option) => (
                          <Select.Item
                            key={option.value}
                            value={option.value}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer outline-none text-white/90 data-[highlighted]:bg-white/10 transition-colors"
                          >
                            <Select.ItemText>{option.label}</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check className="w-4 h-4 text-white" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-white/90">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`h-11 px-4 rounded-xl border transition-colors font-medium flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'border-white bg-white/20 text-white'
                        : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`h-11 px-4 rounded-xl border transition-colors font-medium flex items-center justify-center gap-2 ${
                      theme === 'dark'
                        ? 'border-white bg-white/20 text-white'
                        : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('sepia')}
                    className={`h-11 px-4 rounded-xl border transition-colors font-medium flex items-center justify-center gap-2 ${
                      theme === 'sepia'
                        ? 'border-white bg-white/20 text-white'
                        : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Sepia
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Maintenance Section */}
          {metadataStats && metadataStats.bloatedBooks > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-white/90">Maintenance</h2>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-white/70" />
                      <p className="text-sm font-medium text-white/90">Database Cleanup</p>
                    </div>
                    <p className="text-xs text-white/50">
                      {metadataCleaned
                        ? 'Metadata cleaned successfully'
                        : `${metadataStats.bloatedBooks} of ${metadataStats.totalBooks} books have embedded cover images in metadata (~${metadataStats.estimatedBloatMB} MB). These are already saved as files and can be safely removed from the database.`}
                    </p>
                  </div>
                  {!metadataCleaned && (
                    <button
                      onClick={cleanMetadata}
                      disabled={cleaningMetadata}
                      className="ml-4 shrink-0 h-9 px-4 rounded-lg border border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cleaningMetadata ? 'Cleaning...' : 'Clean Up'}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Info Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4 text-white/90">About</h2>
            <div className="text-sm text-white/50 space-y-2">
              <p>
                <strong className="text-white/70">Chapter</strong> - Offline-first reading &
                audiobook app
              </p>
              <p>Version: 0.1.0</p>
              <p>
                TTS powered by Kokoro, Orpheus, Chatterbox, Qwen3, and Piper
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
