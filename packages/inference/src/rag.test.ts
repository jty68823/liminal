/**
 * Unit tests for RAG (Retrieval-Augmented Generation) pipeline.
 * Tests ingestDocument and queryKnowledgeBase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@liminal/core', () => ({
  parseAndChunk: vi.fn(),
}));

import { parseAndChunk } from '@liminal/core';
import { ingestDocument, queryKnowledgeBase } from './rag.js';

beforeEach(() => {
  vi.resetAllMocks();
});

// ── ingestDocument helpers ────────────────────────────────────────────────

function makeIngestOptions(
  overrides: Partial<Parameters<typeof ingestDocument>[2]> = {},
): Parameters<typeof ingestDocument>[2] {
  return {
    embedFn: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    createDocFn: vi.fn().mockReturnValue({ id: 'doc-1' }),
    addChunkFn: vi.fn(),
    updateStatusFn: vi.fn(),
    ...overrides,
  };
}

// ── queryKnowledgeBase helpers ────────────────────────────────────────────

function makeQueryOptions(
  overrides: Partial<Parameters<typeof queryKnowledgeBase>[1]> = {},
): Parameters<typeof queryKnowledgeBase>[1] {
  return {
    embedFn: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    searchFn: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

// ── ingestDocument tests ──────────────────────────────────────────────────

describe('ingestDocument', () => {
  it('creates document record and updates status to ready', async () => {
    const buffer = Buffer.from('Hello world content');
    const opts = makeIngestOptions();

    (parseAndChunk as ReturnType<typeof vi.fn>).mockResolvedValue([
      { content: 'Hello world content', metadata: { chunkIndex: 0 } },
    ]);

    const result = await ingestDocument(buffer, 'test.txt', opts);

    expect(opts.createDocFn).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'test.txt' }),
    );
    expect(opts.updateStatusFn).toHaveBeenCalledWith('doc-1', 'processing');
    expect(opts.updateStatusFn).toHaveBeenCalledWith('doc-1', 'ready', 1);
    expect(result.status).toBe('success');
    expect(result.documentId).toBe('doc-1');
    expect(result.chunkCount).toBe(1);
  });

  it('embeds each chunk and stores it', async () => {
    const buffer = Buffer.from('content');
    const mockEmbedding = new Float32Array([0.1, 0.2, 0.3]);
    const opts = makeIngestOptions({
      embedFn: vi.fn().mockResolvedValue(mockEmbedding),
    });

    (parseAndChunk as ReturnType<typeof vi.fn>).mockResolvedValue([
      { content: 'Chunk one', metadata: { chunkIndex: 0 } },
      { content: 'Chunk two', metadata: { chunkIndex: 1 } },
    ]);

    await ingestDocument(buffer, 'doc.txt', opts);

    expect(opts.embedFn).toHaveBeenCalledTimes(2);
    expect(opts.addChunkFn).toHaveBeenCalledTimes(2);
    expect(opts.addChunkFn).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1', chunkIndex: 0 }),
    );
    expect(opts.addChunkFn).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-1', chunkIndex: 1 }),
    );
  });

  it('marks document as error when parsing fails', async () => {
    const buffer = Buffer.from('corrupt pdf');
    const opts = makeIngestOptions();

    (parseAndChunk as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Parse failed'));

    const result = await ingestDocument(buffer, 'corrupt.pdf', opts);

    expect(result.status).toBe('error');
    expect(result.error).toContain('Parse failed');
    expect(opts.updateStatusFn).toHaveBeenCalledWith('doc-1', 'error');
  });

  it('passes projectId to createDocFn', async () => {
    const buffer = Buffer.from('content');
    const opts = makeIngestOptions({ projectId: 'proj-123' });

    (parseAndChunk as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await ingestDocument(buffer, 'file.txt', opts);

    expect(opts.createDocFn).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-123' }),
    );
  });

  it('handles empty document (zero chunks) gracefully', async () => {
    const buffer = Buffer.from('');
    const opts = makeIngestOptions();

    (parseAndChunk as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await ingestDocument(buffer, 'empty.txt', opts);

    expect(result.status).toBe('success');
    expect(result.chunkCount).toBe(0);
    expect(opts.updateStatusFn).toHaveBeenCalledWith('doc-1', 'ready', 0);
  });
});

// ── queryKnowledgeBase tests ──────────────────────────────────────────────

describe('queryKnowledgeBase', () => {
  it('embeds query and calls searchFn with the embedding', async () => {
    const queryVec = new Float32Array([0.1, 0.2, 0.3]);
    const opts = makeQueryOptions({
      embedFn: vi.fn().mockResolvedValue(queryVec),
    });

    await queryKnowledgeBase('What is the project?', opts);

    expect(opts.embedFn).toHaveBeenCalledWith('What is the project?');
    expect(opts.searchFn).toHaveBeenCalledWith(queryVec, expect.any(Object));
  });

  it('returns formatted chunks above minScore threshold', async () => {
    const opts = makeQueryOptions({
      searchFn: vi.fn().mockReturnValue([
        { content: 'High relevance', score: 0.92, chunkIndex: 0, metadata: '{"source":"doc.txt"}' },
        { content: 'Low relevance', score: 0.25, chunkIndex: 1, metadata: null },
      ]),
      minScore: 0.5,
    });

    const result = await queryKnowledgeBase('query', opts);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].content).toBe('High relevance');
    expect(result.chunks[0].score).toBe(0.92);
  });

  it('includes context block when results found', async () => {
    const opts = makeQueryOptions({
      searchFn: vi.fn().mockReturnValue([
        { content: 'TypeScript is great', score: 0.9, chunkIndex: 0, metadata: '{"source":"ts.md"}' },
      ]),
    });

    const result = await queryKnowledgeBase('TypeScript', opts);

    expect(result.contextBlock).toContain('<knowledge>');
    expect(result.contextBlock).toContain('TypeScript is great');
    expect(result.contextBlock).toContain('</knowledge>');
  });

  it('returns empty contextBlock when no results', async () => {
    const opts = makeQueryOptions({
      searchFn: vi.fn().mockReturnValue([]),
    });

    const result = await queryKnowledgeBase('unknown', opts);

    expect(result.chunks).toEqual([]);
    expect(result.contextBlock).toBe('');
  });

  it('passes projectId and k to searchFn', async () => {
    const opts = makeQueryOptions({ projectId: 'proj-1', k: 3 });

    await queryKnowledgeBase('query', opts);

    expect(opts.searchFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: 'proj-1', k: 3 }),
    );
  });

  it('extracts source from chunk metadata', async () => {
    const opts = makeQueryOptions({
      searchFn: vi.fn().mockReturnValue([
        { content: 'content', score: 0.8, chunkIndex: 0, metadata: '{"source":"readme.md"}' },
      ]),
    });

    const result = await queryKnowledgeBase('query', opts);

    expect(result.chunks[0].source).toBe('readme.md');
  });

  it('uses unknown as source when metadata is null', async () => {
    const opts = makeQueryOptions({
      searchFn: vi.fn().mockReturnValue([
        { content: 'content', score: 0.8, chunkIndex: 0, metadata: null },
      ]),
    });

    const result = await queryKnowledgeBase('query', opts);

    expect(result.chunks[0].source).toBe('unknown');
  });
});
