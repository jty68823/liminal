import type { Chunk } from './types.js';
import { RecursiveTextSplitter } from './text-splitter.js';

/**
 * Document parser — extracts text from various file formats
 * and splits into chunks for embedding.
 */

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.cs': 'csharp', '.sh': 'bash', '.sql': 'sql',
};

const CODE_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_LANGUAGE));

export interface ParseResult {
  text: string;
  metadata: {
    mimeType: string;
    pageCount?: number;
    language?: string;
  };
}

/**
 * Parse a document buffer into text based on mime type.
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<ParseResult> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const resolvedMime = mimeType ?? guessMimeType(ext);

  // PDF
  if (resolvedMime === 'application/pdf') {
    try {
      // Dynamic import — pdf-parse is an optional peer dependency
      const pdfParse = (await import('pdf-parse' as string)).default as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
      const data = await pdfParse(buffer);
      return {
        text: data.text,
        metadata: { mimeType: resolvedMime, pageCount: data.numpages },
      };
    } catch {
      return { text: buffer.toString('utf8'), metadata: { mimeType: 'text/plain' } };
    }
  }

  // Code files
  if (CODE_EXTENSIONS.has(ext)) {
    const language = EXTENSION_TO_LANGUAGE[ext] ?? 'text';
    return {
      text: buffer.toString('utf8'),
      metadata: { mimeType: 'text/plain', language },
    };
  }

  // Plain text, markdown, etc.
  return {
    text: buffer.toString('utf8'),
    metadata: { mimeType: resolvedMime },
  };
}

/**
 * Parse and chunk a document in one step.
 */
export async function parseAndChunk(
  buffer: Buffer,
  filename: string,
  options?: { chunkSize?: number; chunkOverlap?: number },
): Promise<Chunk[]> {
  const parsed = await parseDocument(buffer, filename);
  const splitter = new RecursiveTextSplitter({
    chunkSize: options?.chunkSize ?? 1000,
    chunkOverlap: options?.chunkOverlap ?? 200,
  });

  if (parsed.metadata.language) {
    return splitter.splitCode(parsed.text, parsed.metadata.language, filename);
  }

  return splitter.split(parsed.text, filename);
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.xml': 'text/xml',
  };
  return map[ext] ?? 'text/plain';
}
