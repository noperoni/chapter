/**
 * TTS Router Service — routes /synthesize and /voices to the active model pod.
 * Replaces direct KokoroService usage with dynamic routing.
 * Falls back to legacy Kokoro service URL if no model is managed.
 */

import { config } from '../../core/config';
import { prisma } from '../../core/database';
import { ttsManagerService } from './tts-manager.service';
import type { TTSGenerateRequest, TTSGenerateResponse, Voice } from '@chapter/types';

export class TTSRouterService {
  /**
   * Get the service URL for the currently active TTS model.
   * Falls back to the legacy KOKORO_SERVICE_URL config.
   */
  private async getServiceUrl(): Promise<string> {
    const active = await ttsManagerService.getActiveModel();
    if (active) return active.serviceUrl;
    // Fallback to legacy Kokoro service URL
    return config.tts.kokoroServiceUrl;
  }

  /**
   * Get the name of the currently active model.
   */
  async getActiveModelName(): Promise<string> {
    const active = await ttsManagerService.getActiveModel();
    return active?.modelName || config.tts.defaultModel;
  }

  /**
   * Synthesize speech through the active model.
   */
  async generateSpeech(request: TTSGenerateRequest): Promise<TTSGenerateResponse> {
    const serviceUrl = await this.getServiceUrl();

    const response = await fetch(`${serviceUrl}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: request.text,
        voice: request.voiceId,
        speed: request.settings?.speed || 1.0,
        temperature: request.settings?.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`TTS synthesis failed (${response.status}): ${errorText}`);
    }

    const audioData = Buffer.from(await response.arrayBuffer());

    const durationHeader = response.headers.get('X-Audio-Duration');
    const sampleRateHeader = response.headers.get('X-Sample-Rate');

    const duration = durationHeader ? parseFloat(durationHeader) : this.estimateDuration(audioData);

    return {
      audioData,
      duration,
      format: 'wav',
      sampleRate: sampleRateHeader ? parseInt(sampleRateHeader, 10) : 24000,
    };
  }

  /**
   * Get voices from the active model.
   */
  async getVoices(): Promise<Voice[]> {
    const serviceUrl = await this.getServiceUrl();

    try {
      const response = await fetch(`${serviceUrl}/voices`);
      if (!response.ok) throw new Error(`Failed to fetch voices: ${response.statusText}`);

      const data: any = await response.json(); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Normalize response — some models return an array directly,
      // others return { voices: [...] }
      const voiceList = Array.isArray(data) ? data : data.voices || [];

      return voiceList.map((v: any) => ({
        id: v.id,
        name: v.name,
        language: v.language || 'en',
        accent: v.accent || v.language || 'unknown',
        gender: v.gender || 'neutral',
      }));
    } catch (error) {
      console.error('[TTS Router] Failed to fetch voices:', error);
      return [];
    }
  }

  /**
   * Health check the active model.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const serviceUrl = await this.getServiceUrl();
      const response = await fetch(`${serviceUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if a voice ID is valid for the active model.
   */
  async isValidVoice(voiceId: string): Promise<boolean> {
    const voices = await this.getVoices();
    return voices.some((v) => v.id === voiceId);
  }

  private estimateDuration(audioData: Buffer): number {
    // WAV: 24kHz, 16-bit, mono = 48000 bytes/sec
    const bytesPerSecond = 24000 * 2 * 1;
    const dataSize = audioData.length - 44; // Skip WAV header
    return dataSize / bytesPerSecond;
  }
}

export const ttsRouterService = new TTSRouterService();
