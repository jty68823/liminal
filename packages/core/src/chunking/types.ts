export interface ChunkMetadata {
  source: string;
  chunkIndex: number;
  totalChunks: number;
  startOffset: number;
  endOffset: number;
  heading?: string;
  language?: string;
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

export type SplitStrategy = 'paragraph' | 'sentence' | 'character' | 'code';
