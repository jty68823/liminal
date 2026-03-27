/**
 * Virus scanner for Auto Task security levels 2 and 3.
 * Uses SHA-256 hash checking and suspicious pattern detection.
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

// Known malicious file hashes (SHA-256) - populated from threat intelligence
const KNOWN_MALICIOUS_HASHES = new Set<string>([
  // EICAR test file hash — standard AV test vector (68-byte canonical form, SHA-256)
  '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
]);

// Suspicious shell patterns for content scanning
const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /rm\s+-rf\s+[/\\]/, name: 'destructive_delete' },
  { pattern: /curl\s+[^|]+\|\s*(?:sh|bash)/, name: 'remote_exec_curl' },
  { pattern: /wget\s+[^|]+\|\s*(?:sh|bash)/, name: 'remote_exec_wget' },
  { pattern: /base64\s+(?:--decode|-d)[^|]+\|\s*(?:sh|bash)/, name: 'base64_exec' },
  { pattern: /eval\s*\(/, name: 'eval_exec' },
  { pattern: /exec\s*\(/, name: 'exec_call' },
  { pattern: /system\s*\(/, name: 'system_call' },
  { pattern: /fork\s*\(\s*\)/, name: 'fork_bomb_risk' },
  { pattern: /\/etc\/(?:passwd|shadow|sudoers)/, name: 'sensitive_file_access' },
  { pattern: /chmod\s+[0-7]*7[0-7]*\s+/, name: 'permission_escalation' },
  { pattern: /sudo\s+/, name: 'sudo_usage' },
  { pattern: /nc\s+(?:-[a-zA-Z]*[le]|-[a-zA-Z]*[le])\s+/, name: 'netcat_listener' },
  { pattern: /python[23]?\s+-c\s+['"]import\s+(?:os|subprocess)/, name: 'python_exec' },
  { pattern: /:\s*\(\s*\)\s*\{.*:.*\|.*&\s*\};\s*:/, name: 'fork_bomb' },
];

export interface ScanResult {
  safe: boolean;
  threatType?: 'known_hash' | 'suspicious_pattern' | 'unreadable';
  detail?: string;
}

export async function scanFileHash(filePath: string): Promise<ScanResult> {
  if (!existsSync(filePath)) {
    return { safe: true };
  }
  try {
    const buffer = readFileSync(filePath);
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (KNOWN_MALICIOUS_HASHES.has(hash)) {
      return {
        safe: false,
        threatType: 'known_hash',
        detail: `File hash ${hash} matches known malicious signature`,
      };
    }
    return { safe: true };
  } catch {
    return {
      safe: false,
      threatType: 'unreadable',
      detail: 'Could not read file for hash verification',
    };
  }
}

export function scanContentPatterns(content: string): ScanResult {
  for (const { pattern, name } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        threatType: 'suspicious_pattern',
        detail: `Suspicious pattern detected: ${name}`,
      };
    }
  }
  return { safe: true };
}

export async function scanFile(filePath: string): Promise<ScanResult> {
  const hashResult = await scanFileHash(filePath);
  if (!hashResult.safe) return hashResult;

  if (!existsSync(filePath)) return { safe: true };
  try {
    const content = readFileSync(filePath, 'utf-8');
    return scanContentPatterns(content);
  } catch {
    // Binary files can't be pattern-scanned; hash check passed
    return { safe: true };
  }
}
