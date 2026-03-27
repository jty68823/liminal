/**
 * Video frame analyzer — extracts key frames from video files
 * and analyzes them using a vision-capable LLM.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { providerRegistry } from '../providers/registry.js';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoAnalysisResult {
  /** Overall description of the video content. */
  description: string;
  /** Per-frame analysis results. */
  frames: Array<{
    /** Frame index (0-based). */
    index: number;
    /** Timestamp in seconds. */
    timestamp: number;
    /** Description of what's visible in this frame. */
    description: string;
  }>;
  /** Total analysis duration in milliseconds. */
  durationMs: number;
}

export interface VideoAnalysisOptions {
  /** Maximum number of frames to extract. Default: 5. */
  maxFrames?: number;
  /** Vision model to use. Default: LIMINAL_VISION_MODEL env var. */
  visionModel?: string;
  /** Custom prompt for frame analysis. */
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Extracts key frames from a video file using ffmpeg and analyzes them
 * using a vision-capable model.
 *
 * Requires ffmpeg to be installed and accessible from PATH.
 *
 * @param videoPath  Path to the video file.
 * @param options    Analysis configuration.
 * @returns          Structured analysis results.
 */
export async function analyzeVideo(
  videoPath: string,
  options: VideoAnalysisOptions = {},
): Promise<VideoAnalysisResult> {
  const startTime = Date.now();
  const maxFrames = options.maxFrames ?? 5;
  const visionModel = options.visionModel
    ?? process.env['LIMINAL_VISION_MODEL']
    ?? 'llava-v1.6-mistral-7b.Q4_K_M';

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  // Create temp directory for frames
  const tempDir = path.join(os.tmpdir(), `liminal-video-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Get video duration
    const { stdout: durationOut } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { timeout: 10_000 },
    );
    const duration = parseFloat(durationOut.trim()) || 10;

    // Extract frames at equal intervals
    const interval = duration / (maxFrames + 1);
    const framePromises: Promise<string>[] = [];

    for (let i = 1; i <= maxFrames; i++) {
      const timestamp = interval * i;
      const outputPath = path.join(tempDir, `frame_${i}.jpg`);

      framePromises.push(
        execAsync(
          `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
          { timeout: 15_000 },
        ).then(() => outputPath),
      );
    }

    const framePaths = await Promise.allSettled(framePromises);
    const validFrames = framePaths
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((p) => fs.existsSync(p));

    if (validFrames.length === 0) {
      return {
        description: 'No frames could be extracted from the video.',
        frames: [],
        durationMs: Date.now() - startTime,
      };
    }

    // Analyze each frame with the vision model
    const provider = providerRegistry.getActive();
    const analysisPrompt = options.prompt
      ?? 'Describe what you see in this video frame in detail. Focus on actions, objects, text, and any notable elements.';

    const frameResults: VideoAnalysisResult['frames'] = [];

    for (let i = 0; i < validFrames.length; i++) {
      const frameData = fs.readFileSync(validFrames[i]);
      const base64 = frameData.toString('base64');
      const timestamp = (interval * (i + 1));

      try {
        const response = await provider.chat({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: analysisPrompt,
              images: [base64],
            },
          ],
        });

        frameResults.push({
          index: i,
          timestamp,
          description: response.message.content,
        });
      } catch {
        frameResults.push({
          index: i,
          timestamp,
          description: '[Frame analysis failed]',
        });
      }
    }

    // Generate overall description
    const frameDescriptions = frameResults
      .map((f) => `[${f.timestamp.toFixed(1)}s] ${f.description}`)
      .join('\n');

    const overallResponse = await provider.chat({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: `Based on these frame-by-frame descriptions of a video, provide a concise overall summary:\n\n${frameDescriptions}\n\nOverall video summary:`,
        },
      ],
    });

    return {
      description: overallResponse.message.content,
      frames: frameResults,
      durationMs: Date.now() - startTime,
    };
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* non-fatal */ }
  }
}

/**
 * Checks if video analysis is available (requires ffmpeg).
 */
export async function isVideoAnalysisAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version', { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
