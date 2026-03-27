import type { Chunk, ChunkMetadata } from './types.js';

/**
 * Recursive text splitter — splits text using a hierarchy of separators:
 * paragraphs → sentences → characters. Each chunk overlaps slightly
 * to maintain context across boundaries.
 */
export class RecursiveTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options?: { chunkSize?: number; chunkOverlap?: number; separators?: string[] }) {
    this.chunkSize = options?.chunkSize ?? 1000;
    this.chunkOverlap = options?.chunkOverlap ?? 200;
    this.separators = options?.separators ?? ['\n\n', '\n', '. ', ' ', ''];
  }

  /**
   * Split text into overlapping chunks.
   */
  split(text: string, source = 'unknown'): Chunk[] {
    const rawChunks = this.splitRecursive(text, this.separators);
    const merged = this.mergeSplits(rawChunks);

    let offset = 0;
    return merged.map((content, i) => {
      const startOffset = text.indexOf(content, offset);
      const actualOffset = startOffset >= 0 ? startOffset : offset;
      offset = actualOffset + content.length - this.chunkOverlap;

      const metadata: ChunkMetadata = {
        source,
        chunkIndex: i,
        totalChunks: merged.length,
        startOffset: actualOffset,
        endOffset: actualOffset + content.length,
      };

      return { content, metadata };
    });
  }

  /**
   * Split code files with language-aware separators.
   */
  splitCode(text: string, language: string, source = 'unknown'): Chunk[] {
    const codeSeparators = this.getCodeSeparators(language);
    const rawChunks = this.splitRecursive(text, codeSeparators);
    const merged = this.mergeSplits(rawChunks);

    let offset = 0;
    return merged.map((content, i) => {
      const startOffset = text.indexOf(content, offset);
      const actualOffset = startOffset >= 0 ? startOffset : offset;
      offset = actualOffset + content.length - this.chunkOverlap;

      return {
        content,
        metadata: {
          source,
          chunkIndex: i,
          totalChunks: merged.length,
          startOffset: actualOffset,
          endOffset: actualOffset + content.length,
          language,
        },
      };
    });
  }

  private splitRecursive(text: string, separators: string[]): string[] {
    if (text.length <= this.chunkSize) return [text];

    const sep = separators[0];
    const remainingSeps = separators.slice(1);

    if (!sep || sep === '') {
      // Character-level split as last resort
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += this.chunkSize - this.chunkOverlap) {
        chunks.push(text.slice(i, i + this.chunkSize));
      }
      return chunks;
    }

    const parts = text.split(sep);
    const results: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;

      if (candidate.length <= this.chunkSize) {
        current = candidate;
      } else {
        if (current) results.push(current);

        if (part.length > this.chunkSize && remainingSeps.length > 0) {
          // Recursively split with finer separator
          results.push(...this.splitRecursive(part, remainingSeps));
          current = '';
        } else {
          current = part;
        }
      }
    }

    if (current) results.push(current);
    return results;
  }

  private mergeSplits(splits: string[]): string[] {
    if (splits.length <= 1) return splits;

    const merged: string[] = [];
    for (let i = 0; i < splits.length; i++) {
      let chunk = splits[i];

      // Add overlap from previous chunk
      if (i > 0 && this.chunkOverlap > 0) {
        const prevText = splits[i - 1];
        const overlap = prevText.slice(-this.chunkOverlap);
        chunk = overlap + chunk;
      }

      // Trim to chunkSize
      if (chunk.length > this.chunkSize + this.chunkOverlap) {
        chunk = chunk.slice(0, this.chunkSize + this.chunkOverlap);
      }

      merged.push(chunk.trim());
    }

    return merged.filter((c) => c.length > 0);
  }

  private getCodeSeparators(language: string): string[] {
    const common = ['\n\n', '\n', ' ', ''];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
      case 'tsx':
      case 'jsx':
        return ['\nexport ', '\nfunction ', '\nclass ', '\nconst ', '\ninterface ', '\ntype ', ...common];
      case 'python':
        return ['\nclass ', '\ndef ', '\n\n', '\n', ' ', ''];
      case 'rust':
        return ['\nfn ', '\nstruct ', '\nenum ', '\nimpl ', '\nmod ', ...common];
      case 'go':
        return ['\nfunc ', '\ntype ', '\nvar ', ...common];
      default:
        return common;
    }
  }
}
