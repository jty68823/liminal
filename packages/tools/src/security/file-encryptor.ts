/**
 * AES-256-GCM file encryption for Auto Task security level 3.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const ALGORITHM = 'aes-256-gcm' as const;

export interface EncryptedFileMetadata {
  iv: string;   // hex-encoded IV
  tag: string;  // hex-encoded GCM auth tag
  keyId: string; // identifies the session key used
}

export async function encryptFile(
  filePath: string,
  outputPath: string,
  key: Buffer,
): Promise<EncryptedFileMetadata> {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = readFileSync(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  writeFileSync(outputPath, encrypted);
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    keyId: createHash('sha256').update(key).digest('hex').slice(0, 8),
  };
}

export async function decryptFile(
  filePath: string,
  outputPath: string,
  key: Buffer,
  meta: EncryptedFileMetadata,
): Promise<void> {
  const iv = Buffer.from(meta.iv, 'hex');
  const tag = Buffer.from(meta.tag, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const ciphertext = readFileSync(filePath);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(outputPath, decrypted);
}

export function deriveSessionKey(runId: string): Buffer {
  const masterKey = process.env['AUTO_TASK_ENCRYPTION_KEY'] ?? 'liminal-default-key-change-in-prod';
  return createHash('sha256').update(`${masterKey}:${runId}`).digest();
}
