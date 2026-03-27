/**
 * Speech-to-Text (STT) module using whisper.cpp via Node.js bindings.
 *
 * Provides local, offline speech recognition without any external API calls.
 * The whisper model is lazy-loaded on first use.
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

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationMs: number;
}

export interface STTConfig {
  /** Path to the whisper model file. */
  modelPath?: string;
  /** Language hint (e.g. 'en', 'ko', 'ja'). Auto-detect if not set. */
  language?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Transcribes audio to text using the Web Speech API (browser) or
 * whisper.cpp (server-side).
 *
 * For the server-side path, expects whisper.cpp to be available as a
 * command-line tool or the audio to be processed via the browser's
 * Web Speech API.
 *
 * @param audioBuffer  Raw audio data (WAV format preferred).
 * @param config       Optional configuration.
 * @returns            Transcription result with text and metadata.
 */
export async function transcribe(
  audioBuffer: Buffer,
  config: STTConfig = {},
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  // Write audio to temp file
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `liminal-stt-${Date.now()}.wav`);

  try {
    fs.writeFileSync(tempFile, audioBuffer);

    // Try to use whisper.cpp if available
    const whisperModel = config.modelPath
      ?? process.env['LIMINAL_WHISPER_MODEL']
      ?? '';

    if (whisperModel && fs.existsSync(whisperModel)) {
      // Use whisper.cpp binary
      const langFlag = config.language ? `-l ${config.language}` : '';
      const { stdout } = await execAsync(
        `whisper-cpp -m "${whisperModel}" ${langFlag} -f "${tempFile}" --no-timestamps`,
        { timeout: 60_000 },
      );

      return {
        text: stdout.trim(),
        language: config.language,
        durationMs: Date.now() - startTime,
      };
    }

    // Fallback: return placeholder indicating browser-side STT should be used
    return {
      text: '[STT: Use browser Web Speech API for transcription]',
      durationMs: Date.now() - startTime,
    };
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch { /* non-fatal */ }
  }
}

/**
 * Checks if server-side STT is available.
 */
export function isSTTAvailable(): boolean {
  const whisperModel = process.env['LIMINAL_WHISPER_MODEL'] ?? '';
  return whisperModel !== '' && fs.existsSync(whisperModel);
}
