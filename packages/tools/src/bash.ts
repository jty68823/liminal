import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from './registry.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 30000;

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
      return output.length > 0 ? output : '(no output)';
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
