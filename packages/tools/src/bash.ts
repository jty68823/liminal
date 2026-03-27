import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from './registry.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 30000;
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB output limit

/** Patterns that match destructive or dangerous commands */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|[A-Z]:\\)(\s|$)/, name: 'rm -rf /' },
  { pattern: /\bmkfs\b/, name: 'mkfs (format disk)' },
  { pattern: /\bshutdown\b/, name: 'shutdown' },
  { pattern: /\breboot\b/, name: 'reboot' },
  { pattern: /\bhalt\b/, name: 'halt' },
  { pattern: /\bpoweroff\b/, name: 'poweroff' },
  { pattern: /\binit\s+0\b/, name: 'init 0' },
  { pattern: /\bdd\s+.*of=\/dev\/[sh]d/, name: 'dd to disk device' },
  { pattern: />\s*\/dev\/[sh]d/, name: 'redirect to disk device' },
  { pattern: /:()\{\s*:\|:&\s*\};:/, name: 'fork bomb' },
  { pattern: /\bchmod\s+(-[a-zA-Z]+\s+)?[0-7]*7[0-7]*\s+\//, name: 'chmod world-writable on /' },
  { pattern: /\bformat\s+[A-Z]:/, name: 'format drive (Windows)' },
];

function isDangerous(command: string): string | null {
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return name;
  }
  return null;
}

function truncateOutput(output: string): string {
  if (Buffer.byteLength(output, 'utf-8') <= MAX_OUTPUT_BYTES) return output;
  const truncated = output.slice(0, MAX_OUTPUT_BYTES);
  return truncated + '\n\n[Output truncated at 1MB]';
}

export const bashTool: ToolHandler = {
  definition: {
    name: 'bash',
    description:
      'Execute a bash/shell command and return stdout and stderr. Working directory defaults to the current directory.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const command = input['command'] as string;
    const cwd = (input['cwd'] as string | undefined) ?? process.cwd();
    const timeout = (input['timeout'] as number | undefined) ?? DEFAULT_TIMEOUT;

    if (!command || typeof command !== 'string') {
      return 'Error: "command" must be a non-empty string.';
    }

    const danger = isDangerous(command);
    if (danger) {
      return `Error: Blocked dangerous command (${danger}). This operation could cause irreversible system damage.`;
    }

    // On Windows use cmd.exe, on Unix use sh — the `shell` option handles flags automatically
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';

    try {
      const { stdout, stderr } = await execAsync(
        command,
        {
          cwd,
          timeout,
          shell: shell,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        },
      );

      const output = [stdout, stderr].filter(Boolean).join('\n').trimEnd();
      return output.length > 0 ? truncateOutput(output) : '(no output)';
    } catch (err: unknown) {
      const error = err as {
        code?: number;
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        message?: string;
      };

      if (error.killed) {
        return `Error: Command timed out after ${timeout}ms.`;
      }

      const exitCode = error.code ?? 1;
      const combined = [error.stdout, error.stderr]
        .filter(Boolean)
        .join('\n')
        .trimEnd();

      if (combined.length > 0) {
        return `Error (exit code ${exitCode}):\n${combined}`;
      }

      return `Error (exit code ${exitCode}): ${error.message ?? 'Unknown error'}`;
    }
  },
};
