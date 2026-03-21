/**
 * TTS Model Registry — static catalog of all known TTS models.
 *
 * Each model variant (e.g. Orpheus 400M vs 3B) gets its own entry so users
 * see the exact VRAM cost and capabilities before loading.
 *
 * Adding a model = adding an entry here + building a wrapper image.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelVoice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  language: string;
}

export interface ModelCapabilities {
  voiceCloning: boolean;
  emotionTags: boolean;
  streaming: boolean;
  speedControl: boolean;
}

export interface ModelRegistryEntry {
  /** Unique slug used in API paths and k8s resource names */
  name: string;
  /** Human-readable name shown in UI */
  displayName: string;
  /** Model family (groups variants together in UI) */
  family: string;
  description: string;
  /** Docker image reference */
  image: string;
  /** Approximate pulled image size in bytes */
  sizeBytes: number;
  /** VRAM required in MB (0 = CPU-only) */
  vramMB: number;
  /** Human-readable parameter count */
  parameters: string;
  capabilities: ModelCapabilities;
  /** Preset voices (empty for clone-only models) */
  voices: ModelVoice[];
  languages: string[];
  license: string;
  /** Container port the model listens on */
  port: number;
  healthEndpoint: string;
  synthesizeEndpoint: string;
  voicesEndpoint: string;
  /** Whether the model needs GPU access */
  gpu: boolean;
  /** Extra env vars to set on the pod */
  env: Record<string, string>;
  /** Memory limit for the k8s pod (e.g. "4Gi") */
  memoryLimit: string;
}

// ---------------------------------------------------------------------------
// Registry Data
// ---------------------------------------------------------------------------

const registry: ModelRegistryEntry[] = [
  // ------- Kokoro -------
  {
    name: 'kokoro',
    displayName: 'Kokoro v1.0',
    family: 'kokoro',
    description:
      'Fast and reliable ONNX-based TTS. 54 voices across 9 languages. Current default engine.',
    image: 'ghcr.io/noperoni/tts-kokoro:latest',
    sizeBytes: 500_000_000,
    vramMB: 2000,
    parameters: '82M',
    capabilities: {
      voiceCloning: false,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    // All 54 Kokoro v1.0 voices
    voices: [
      // American English — Female (11)
      { id: 'af_heart', name: 'Heart', gender: 'female', language: 'en-US' },
      { id: 'af_alloy', name: 'Alloy', gender: 'female', language: 'en-US' },
      { id: 'af_aoede', name: 'Aoede', gender: 'female', language: 'en-US' },
      { id: 'af_bella', name: 'Bella', gender: 'female', language: 'en-US' },
      { id: 'af_jessica', name: 'Jessica', gender: 'female', language: 'en-US' },
      { id: 'af_kore', name: 'Kore', gender: 'female', language: 'en-US' },
      { id: 'af_nicole', name: 'Nicole', gender: 'female', language: 'en-US' },
      { id: 'af_nova', name: 'Nova', gender: 'female', language: 'en-US' },
      { id: 'af_river', name: 'River', gender: 'female', language: 'en-US' },
      { id: 'af_sarah', name: 'Sarah', gender: 'female', language: 'en-US' },
      { id: 'af_sky', name: 'Sky', gender: 'female', language: 'en-US' },
      // American English — Male (9)
      { id: 'am_adam', name: 'Adam', gender: 'male', language: 'en-US' },
      { id: 'am_echo', name: 'Echo', gender: 'male', language: 'en-US' },
      { id: 'am_eric', name: 'Eric', gender: 'male', language: 'en-US' },
      { id: 'am_fenrir', name: 'Fenrir', gender: 'male', language: 'en-US' },
      { id: 'am_liam', name: 'Liam', gender: 'male', language: 'en-US' },
      { id: 'am_michael', name: 'Michael', gender: 'male', language: 'en-US' },
      { id: 'am_onyx', name: 'Onyx', gender: 'male', language: 'en-US' },
      { id: 'am_puck', name: 'Puck', gender: 'male', language: 'en-US' },
      { id: 'am_santa', name: 'Santa', gender: 'male', language: 'en-US' },
      // British English — Female (4)
      { id: 'bf_alice', name: 'Alice', gender: 'female', language: 'en-GB' },
      { id: 'bf_emma', name: 'Emma', gender: 'female', language: 'en-GB' },
      { id: 'bf_isabella', name: 'Isabella', gender: 'female', language: 'en-GB' },
      { id: 'bf_lily', name: 'Lily', gender: 'female', language: 'en-GB' },
      // British English — Male (4)
      { id: 'bm_daniel', name: 'Daniel', gender: 'male', language: 'en-GB' },
      { id: 'bm_fable', name: 'Fable', gender: 'male', language: 'en-GB' },
      { id: 'bm_george', name: 'George', gender: 'male', language: 'en-GB' },
      { id: 'bm_lewis', name: 'Lewis', gender: 'male', language: 'en-GB' },
      // Japanese (5)
      { id: 'jf_alpha', name: 'Alpha', gender: 'female', language: 'ja' },
      { id: 'jf_gongitsune', name: 'Gongitsune', gender: 'female', language: 'ja' },
      { id: 'jf_nezumi', name: 'Nezumi', gender: 'female', language: 'ja' },
      { id: 'jf_tebukuro', name: 'Tebukuro', gender: 'female', language: 'ja' },
      { id: 'jm_kumo', name: 'Kumo', gender: 'male', language: 'ja' },
      // Mandarin Chinese (8)
      { id: 'zf_xiaobei', name: 'Xiaobei', gender: 'female', language: 'zh' },
      { id: 'zf_xiaoni', name: 'Xiaoni', gender: 'female', language: 'zh' },
      { id: 'zf_xiaoxiao', name: 'Xiaoxiao', gender: 'female', language: 'zh' },
      { id: 'zf_xiaoyi', name: 'Xiaoyi', gender: 'female', language: 'zh' },
      { id: 'zm_yunjian', name: 'Yunjian', gender: 'male', language: 'zh' },
      { id: 'zm_yunxi', name: 'Yunxi', gender: 'male', language: 'zh' },
      { id: 'zm_yunxia', name: 'Yunxia', gender: 'male', language: 'zh' },
      { id: 'zm_yunyang', name: 'Yunyang', gender: 'male', language: 'zh' },
      // Spanish (3)
      { id: 'ef_dora', name: 'Dora', gender: 'female', language: 'es' },
      { id: 'em_alex', name: 'Alex', gender: 'male', language: 'es' },
      { id: 'em_santa', name: 'Santa', gender: 'male', language: 'es' },
      // French (1)
      { id: 'ff_siwis', name: 'Siwis', gender: 'female', language: 'fr' },
      // Hindi (4)
      { id: 'hf_alpha', name: 'Alpha', gender: 'female', language: 'hi' },
      { id: 'hf_beta', name: 'Beta', gender: 'female', language: 'hi' },
      { id: 'hm_omega', name: 'Omega', gender: 'male', language: 'hi' },
      { id: 'hm_psi', name: 'Psi', gender: 'male', language: 'hi' },
      // Italian (2)
      { id: 'if_sara', name: 'Sara', gender: 'female', language: 'it' },
      { id: 'im_nicola', name: 'Nicola', gender: 'male', language: 'it' },
      // Brazilian Portuguese (3)
      { id: 'pf_dora', name: 'Dora', gender: 'female', language: 'pt-BR' },
      { id: 'pm_alex', name: 'Alex', gender: 'male', language: 'pt-BR' },
      { id: 'pm_santa', name: 'Santa', gender: 'male', language: 'pt-BR' },
    ],
    languages: ['en-US', 'en-GB', 'ja', 'zh', 'es', 'fr', 'hi', 'it', 'pt-BR'],
    license: 'Apache-2.0',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: {},
    memoryLimit: '4Gi',
  },

  // ------- Orpheus 3B (only size available) -------
  {
    name: 'orpheus-3b',
    displayName: 'Orpheus 3B',
    family: 'orpheus',
    description:
      'Emotional narration with tags like <laugh>, <sigh>, <gasp>. Best for fiction with expressive dialogue.',
    image: 'ghcr.io/noperoni/tts-orpheus:latest',
    sizeBytes: 8_000_000_000,
    vramMB: 16000,
    parameters: '3B',
    capabilities: {
      voiceCloning: true,
      emotionTags: true,
      streaming: false,
      speedControl: true,
    },
    voices: [
      { id: 'tara', name: 'Tara', gender: 'female', language: 'en' },
      { id: 'leah', name: 'Leah', gender: 'female', language: 'en' },
      { id: 'jess', name: 'Jess', gender: 'female', language: 'en' },
      { id: 'mia', name: 'Mia', gender: 'female', language: 'en' },
      { id: 'leo', name: 'Leo', gender: 'male', language: 'en' },
      { id: 'dan', name: 'Dan', gender: 'male', language: 'en' },
      { id: 'zac', name: 'Zac', gender: 'male', language: 'en' },
      { id: 'zoe', name: 'Zoe', gender: 'female', language: 'en' },
    ],
    languages: ['en'],
    license: 'Apache-2.0',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: {},
    memoryLimit: '20Gi',
  },

  // ------- Chatterbox (Turbo) -------
  {
    name: 'chatterbox-turbo',
    displayName: 'Chatterbox Turbo',
    family: 'chatterbox',
    description:
      'Zero-shot voice cloning from a short audio sample. Faster turbo variant. Beats ElevenLabs in blind tests.',
    image: 'ghcr.io/noperoni/tts-chatterbox:latest',
    sizeBytes: 3_000_000_000,
    vramMB: 6000,
    parameters: '350M',
    capabilities: {
      voiceCloning: true,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    voices: [
      { id: 'default', name: 'Default', gender: 'female', language: 'en' },
    ],
    languages: ['en'],
    license: 'MIT',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: { MODEL_VARIANT: 'turbo' },
    memoryLimit: '8Gi',
  },

  // ------- Chatterbox (Original) -------
  {
    name: 'chatterbox',
    displayName: 'Chatterbox Original',
    family: 'chatterbox',
    description:
      'Zero-shot voice cloning from a short audio sample. Higher quality original variant, slower than turbo.',
    image: 'ghcr.io/noperoni/tts-chatterbox:latest',
    sizeBytes: 4_000_000_000,
    vramMB: 10000,
    parameters: '500M',
    capabilities: {
      voiceCloning: true,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    voices: [
      { id: 'default', name: 'Default', gender: 'female', language: 'en' },
    ],
    languages: ['en'],
    license: 'MIT',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: { MODEL_VARIANT: 'original' },
    memoryLimit: '12Gi',
  },

  // ------- Qwen3-TTS (Small) -------
  {
    name: 'qwen3-tts-small',
    displayName: 'Qwen3-TTS 0.6B',
    family: 'qwen3-tts',
    description:
      'Multilingual TTS with 3-second voice cloning. Smaller variant, good for quick generation across 10 languages.',
    image: 'ghcr.io/noperoni/tts-qwen3:latest',
    sizeBytes: 3_000_000_000,
    vramMB: 3000,
    parameters: '0.6B',
    capabilities: {
      voiceCloning: true,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    voices: [
      { id: 'default', name: 'Default', gender: 'neutral', language: 'multi' },
    ],
    languages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ar', 'ru', 'pt'],
    license: 'Apache-2.0',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: { MODEL_SIZE: '0.6b' },
    memoryLimit: '8Gi',
  },

  // ------- Qwen3-TTS -------
  {
    name: 'qwen3-tts',
    displayName: 'Qwen3-TTS 1.7B',
    family: 'qwen3-tts',
    description:
      'Best multilingual TTS with lowest word error rate. 3-second voice cloning across 10 languages. Larger variant for highest quality.',
    image: 'ghcr.io/noperoni/tts-qwen3:latest',
    sizeBytes: 8_000_000_000,
    vramMB: 12000,
    parameters: '1.7B',
    capabilities: {
      voiceCloning: true,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    voices: [
      { id: 'default', name: 'Default', gender: 'neutral', language: 'multi' },
    ],
    languages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ar', 'ru', 'pt'],
    license: 'Apache-2.0',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: true,
    env: { MODEL_SIZE: '1.7b' },
    memoryLimit: '16Gi',
  },

  // ------- Piper -------
  {
    name: 'piper',
    displayName: 'Piper',
    family: 'piper',
    description:
      'Instant CPU-only TTS. 300+ voices across 40+ languages. No GPU needed — perfect fallback when GPU is busy.',
    image: 'ghcr.io/noperoni/tts-piper:latest',
    sizeBytes: 200_000_000,
    vramMB: 0,
    parameters: '~50M',
    capabilities: {
      voiceCloning: false,
      emotionTags: false,
      streaming: false,
      speedControl: true,
    },
    // Popular English voices bundled by default; more downloadable on demand
    voices: [
      { id: 'en_US-lessac-medium', name: 'Lessac', gender: 'male', language: 'en-US' },
      { id: 'en_US-libritts_r-medium', name: 'LibriTTS', gender: 'neutral', language: 'en-US' },
      { id: 'en_US-amy-medium', name: 'Amy', gender: 'female', language: 'en-US' },
      { id: 'en_US-ryan-medium', name: 'Ryan', gender: 'male', language: 'en-US' },
      { id: 'en_GB-alba-medium', name: 'Alba', gender: 'female', language: 'en-GB' },
      { id: 'en_GB-aru-medium', name: 'Aru', gender: 'male', language: 'en-GB' },
    ],
    languages: [
      'en-US', 'en-GB', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru',
      'zh', 'ja', 'ko', 'ar', 'cs', 'da', 'el', 'fi', 'hu', 'no',
      'ro', 'sk', 'sv', 'tr', 'uk', 'vi', 'ca', 'ka', 'kk', 'ne',
      'sr', 'sw', 'te', 'bg', 'fa', 'is', 'lb', 'mk',
    ],
    license: 'MIT',
    port: 5000,
    healthEndpoint: '/health',
    synthesizeEndpoint: '/synthesize',
    voicesEndpoint: '/voices',
    gpu: false,
    env: {},
    memoryLimit: '2Gi',
  },
];

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Get all registered models */
export function getAllModels(): ModelRegistryEntry[] {
  return registry;
}

/** Get a model by name, or undefined if not found */
export function getModel(name: string): ModelRegistryEntry | undefined {
  return registry.find((m) => m.name === name);
}

/** Get all variants of a model family (e.g. "orpheus" returns small + 3b) */
export function getModelsByFamily(family: string): ModelRegistryEntry[] {
  return registry.filter((m) => m.family === family);
}

/** Get all unique model family names */
export function getModelFamilies(): string[] {
  return [...new Set(registry.map((m) => m.family))];
}

/** Check if a model name exists in the registry */
export function isKnownModel(name: string): boolean {
  return registry.some((m) => m.name === name);
}
