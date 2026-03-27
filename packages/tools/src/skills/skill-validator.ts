/**
 * Skill Validator
 *
 * Scans skill markdown content for potentially dangerous patterns
 * and computes a risk score (0-100).
 */

export interface ValidationResult {
  riskScore: number;
  warnings: string[];
  isBlocked: boolean;
}

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; weight: number; message: string }> = [
  { pattern: /\beval\b/gi, weight: 30, message: 'Contains eval() usage' },
  { pattern: /\bexec\b/gi, weight: 25, message: 'Contains exec() usage' },
  { pattern: /\bchild_process\b/gi, weight: 25, message: 'References child_process module' },
  { pattern: /\brm\s+-rf\b/gi, weight: 40, message: 'Contains destructive rm -rf command' },
  { pattern: /\bsudo\b/gi, weight: 35, message: 'Contains sudo command' },
  { pattern: /\bcurl\b.*\|\s*\bbash\b/gi, weight: 50, message: 'Pipes curl output to bash (dangerous)' },
  { pattern: /https?:\/\/[^\s)]+\.exe/gi, weight: 40, message: 'References external executable' },
  { pattern: /\bpassword\b|\bsecret\b|\btoken\b.*=\s*["'][^"']+/gi, weight: 20, message: 'May contain hardcoded credentials' },
  { pattern: /process\.env\[/gi, weight: 10, message: 'Accesses environment variables' },
  { pattern: /\bfetch\b.*\bpost\b/gi, weight: 15, message: 'Makes outbound POST requests' },
  { pattern: /\bwriteFile\b|\bfs\.write\b/gi, weight: 10, message: 'Writes to filesystem' },
];

const BLOCKED_PATTERNS = [
  /\bcurl\b.*\|\s*\bbash\b/gi,
  /\brm\s+-rf\s+\/(?!\w)/gi,  // rm -rf / (root deletion)
];

export function validateSkill(content: string): ValidationResult {
  const warnings: string[] = [];
  let totalScore = 0;
  let isBlocked = false;

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      isBlocked = true;
      warnings.push('BLOCKED: Contains extremely dangerous pattern');
      break;
    }
  }

  // Score dangerous patterns
  for (const { pattern, weight, message } of DANGEROUS_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      totalScore += weight;
      warnings.push(`${message} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  // Cap at 100
  const riskScore = Math.min(100, totalScore);

  return { riskScore, warnings, isBlocked };
}
