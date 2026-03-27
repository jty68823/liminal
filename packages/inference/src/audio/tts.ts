/**
 * Text-to-Speech (TTS) module using a local TTS engine.
 *
 * Supports piper (fast, offline) or falls back to browser-based
 * Web Speech API via the frontend.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SynthesisResult {
  /** Raw audio data (WAV format). */
  audioBuffer: Buffer;
  /** Duration of synthesis in milliseconds. */
  durationMs: number;
}

export interface TTSConfig {
  /** Path to the TTS model file (piper model). */
  modelPath?: string;
  /** Voice ID or name. */
  voice?: string;
  /** Speaking rate (1.0 = normal). */
  rate?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Synthesizes speech from text using a local TTS engine.
 *
 * @param text    Text to convert to speech.
 * @param config  Optional configuration.
 * @returns       Audio buffer (WAV) and timing metadata.
 */
export async function synthesize(
  text: string,
  config: TTSConfig = {},
): Promise<SynthesisResult> {
  const startTime = Date.now();
  const tempDir = os.tmpdir();
  const outputFile = path.join(tempDir, `liminal-tts-${Date.now()}.wav`);

  try {
    const piperModel = config.modelPath
      ?? process.env['LIMINAL_TTS_MODEL']
      ?? '';

    if (piperModel && fs.existsSync(piperModel)) {
      // Use piper TTS
      const rateFlag = config.rate ? `--length-scale ${1.0 / config.rate}` : '';
      await execAsync(
        `echo "${text.replace(/"/g, '\\"')}" | piper --model "${piperModel}" ${rateFlag} --output_file "${outputFile}"`,
        { timeout: 30_000 },
      );

      const audioBuffer = fs.readFileSync(outputFile);
      return {
        audioBuffer,
        durationMs: Date.now() - startTime,
      };
    }

    // Fallback: return empty buffer indicating browser-side TTS should be used
    return {
      audioBuffer: Buffer.alloc(0),
      durationMs: Date.now() - startTime,
    };
  } finally {
    try {
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    } catch { /* non-fatal */ }
  }
}

/**
 * Checks if server-side TTS is available.
 */
export function isTTSAvailable(): boolean {
  const piperModel = process.env['LIMINAL_TTS_MODEL'] ?? '';
  return piperModel !== '' && fs.existsSync(piperModel);
}
