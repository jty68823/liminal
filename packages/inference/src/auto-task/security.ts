/**
 * Security context for Auto Task execution.
 * Implements security checks inline (no @liminal/tools dependency at inference layer).
 */

import type { SecurityLevel } from './types.js';
import { createHash, createCipheriv, randomBytes } from 'crypto';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { platform } from 'os';

export interface SecurityContext {
  level: SecurityLevel;
  runId: string;
}

export function createSecurityContext(level: SecurityLevel, runId: string): SecurityContext {
  return { level, runId };
}

// Known malicious SHA-256 hashes (EICAR test hash for testing)
const KNOWN_MALICIOUS_HASHES = new Set<string>([
  '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
]);

// Suspicious shell patterns
const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /rm\s+-rf\s+[/\\]/, name: 'destructive_delete' },
  { pattern: /curl\s+[^|]+\|\s*(?:sh|bash)/, name: 'remote_exec_curl' },
  { pattern: /wget\s+[^|]+\|\s*(?:sh|bash)/, name: 'remote_exec_wget' },
  { pattern: /base64\s+(?:--decode|-d)[^|]+\|\s*(?:sh|bash)/, name: 'base64_exec' },
  { pattern: /eval\s*\(/, name: 'eval_exec' },
  { pattern: /\/etc\/(?:passwd|shadow|sudoers)/, name: 'sensitive_file_access' },
  { pattern: /:\s*\(\s*\)\s*\{.*:.*\|.*&\s*\};\s*:/, name: 'fork_bomb' },
];

function scanHash(filePath: string): { safe: boolean; reason?: string } {
  if (!existsSync(filePath)) return { safe: true };
  try {
    const buf = readFileSync(filePath);
    const hash = createHash('sha256').update(buf).digest('hex');
    if (KNOWN_MALICIOUS_HASHES.has(hash)) {
      return { safe: false, reason: `Malicious hash detected: ${hash}` };
    }
    return { safe: true };
  } catch {
    return { safe: true }; // Binary read failure — not a threat
  }
}

function scanPatterns(content: string): { safe: boolean; reason?: string } {
  for (const { pattern, name } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return { safe: false, reason: `Suspicious pattern: ${name}` };
    }
  }
  return { safe: true };
}

export async function validateFile(
  filePath: string,
  ctx: SecurityContext,
): Promise<{ safe: boolean; reason?: string }> {
  if (ctx.level === 1) return { safe: true };
  const hashResult = scanHash(filePath);
  if (!hashResult.safe) return hashResult;
  if (!existsSync(filePath)) return { safe: true };
  try {
    const content = readFileSync(filePath, 'utf-8');
    return scanPatterns(content);
  } catch {
    return { safe: true };
  }
}

export function validateCommand(
  command: string,
  ctx: SecurityContext,
): { allowed: boolean; reason?: string } {
  if (ctx.level === 1) return { allowed: true };
  const scan = scanPatterns(command);
  if (!scan.safe) {
    if (ctx.level === 2) {
      console.warn(`[Security L2] Suspicious command pattern: ${scan.reason}`);
      return { allowed: true };
    }
    return { allowed: false, reason: scan.reason };
  }
  return { allowed: true };
}

export async function runCommandWithSecurity(
  command: string,
  ctx: SecurityContext,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env: NodeJS.ProcessEnv = ctx.level === 3
    ? { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: process.env['HOME'] ?? '/tmp', TMPDIR: '/tmp' }
    : { ...process.env };

  const cmd = ctx.level === 3 && platform() === 'linux'
    ? `unshare --net --fork -- sh -c ${JSON.stringify(command)}`
    : command;

  const result = spawnSync('sh', ['-c', cmd], {
    encoding: 'utf-8',
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    env,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

export async function postExecutionHook(
  outputPaths: string[],
  ctx: SecurityContext,
): Promise<void> {
  if (ctx.level === 1) return;
  for (const filePath of outputPaths) {
    if (!existsSync(filePath)) continue;
    // L2+: scan file
    const hashResult = scanHash(filePath);
    if (!hashResult.safe) {
      console.warn(`[Security L${ctx.level}] Output file flagged: ${filePath} — ${hashResult.reason}`);
    }
    // L3: encrypt
    if (ctx.level === 3) {
      try {
        const masterKey = process.env['AUTO_TASK_ENCRYPTION_KEY'] ?? 'liminal-default-key-change-in-prod';
        const key = createHash('sha256').update(`${masterKey}:${ctx.runId}`).digest();
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const plain = readFileSync(filePath);
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        writeFileSync(filePath + '.enc', encrypted);
      } catch (e) {
        console.warn(`[Security L3] Encryption failed for ${filePath}: ${String(e)}`);
      }
    }
  }
}
