/**
 * Sandboxed execution for Auto Task security level 3.
 * On Linux: uses namespace isolation via unshare.
 * On Windows/macOS: best-effort PATH and env restriction.
 */
import { spawnSync } from 'child_process';
import { platform } from 'os';

export interface SandboxOptions {
  cwd?: string;
  allowedPaths?: string[];
  networkDisabled?: boolean;
  timeoutMs?: number;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function isLinux(): boolean {
  return platform() === 'linux';
}

export function buildSandboxedCommand(command: string, options: SandboxOptions = {}): string {
  if (isLinux()) {
    // Use Linux namespaces for isolation
    const parts = ['unshare'];
    if (options.networkDisabled !== false) parts.push('--net');
    parts.push('--fork', '--', 'sh', '-c', command);
    return parts.join(' ');
  }
  // Non-Linux: return command as-is with env restrictions handled at spawn time
  return command;
}

export async function runSandboxed(
  command: string,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const cwd = options.cwd ?? process.cwd();

  // Restricted environment: only allow essential vars
  const restrictedEnv: NodeJS.ProcessEnv = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env['HOME'] ?? '/tmp',
    TMPDIR: '/tmp',
  };

  const sandboxedCmd = buildSandboxedCommand(command, options);

  // Build restricted env for non-Linux platforms too
  const windowsRestrictedEnv: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'] ?? '',
    SYSTEMROOT: process.env['SYSTEMROOT'] ?? 'C:\\Windows',
    TEMP: process.env['TEMP'] ?? process.env['TMP'] ?? 'C:\\Windows\\Temp',
    TMP: process.env['TMP'] ?? process.env['TEMP'] ?? 'C:\\Windows\\Temp',
    USERPROFILE: process.env['USERPROFILE'] ?? '',
    HOMEDRIVE: process.env['HOMEDRIVE'] ?? 'C:',
    HOMEPATH: process.env['HOMEPATH'] ?? '\\Users\\Default',
  };

  const envToUse = isLinux() ? restrictedEnv : windowsRestrictedEnv;
  const shellCmd = isLinux() ? 'sh' : process.platform === 'win32' ? 'cmd.exe' : 'sh';
  const shellArgs = isLinux() ? ['-c', sandboxedCmd] : process.platform === 'win32' ? ['/c', sandboxedCmd] : ['-c', sandboxedCmd];

  const result = spawnSync(shellCmd, shellArgs, {
    cwd,
    env: envToUse,
    timeout: timeoutMs,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}
