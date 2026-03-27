import { Hono } from 'hono';
import {
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  addDocumentChunk,
  updateDocumentStatus,
  getDocumentChunks,
  searchChunksBySimilarity,
} from '@liminal/db';
import { embed } from '@liminal/inference';
import { parseAndChunk } from '@liminal/core';

export const documentsRouter = new Hono();

// GET / — list documents (optionally filtered by project)
documentsRouter.get('/', (c) => {
  const projectId = c.req.query('project_id');
  const docs = listDocuments(projectId);
  return c.json({ documents: docs });
});

// GET /:id — get single document
documentsRouter.get('/:id', (c) => {
  const doc = getDocument(c.req.param('id'));
  if (!doc) return c.json({ error: 'Document not found' }, 404);
  return c.json(doc);
});

// GET /:id/chunks — get document chunks
documentsRouter.get('/:id/chunks', (c) => {
  const chunks = getDocumentChunks(c.req.param('id'));
  return c.json({ chunks });
});

// POST / — upload and ingest a document
documentsRouter.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  const projectId = typeof body['project_id'] === 'string' ? body['project_id'] : undefined;

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name;

  // Create document record
  const doc = createDocument({ projectId, filename, mimeType: file.type });

  // Ingest asynchronously
  (async () => {
    try {
      updateDocumentStatus(doc.id, 'processing');

      const chunks = await parseAndChunk(buffer, filename);

      for (const chunk of chunks) {
        let embedding: Buffer | undefined;
        try {
          const vec = await embed(chunk.content);
          embedding = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
        } catch {
          // Embedding may fail if nomic-embed-text not available
        }

        addDocumentChunk({
          documentId: doc.id,
          content: chunk.content,
          embedding,
          chunkIndex: chunk.metadata.chunkIndex,
          metadata: JSON.stringify(chunk.metadata),
        });
      }

      updateDocumentStatus(doc.id, 'ready', chunks.length);
    } catch (err) {
      console.error(`[documents] Ingest error for ${doc.id}:`, err);
      try {
        updateDocumentStatus(doc.id, 'error');
      } catch (dbErr) {
        console.error(`[documents] Failed to update status for ${doc.id}:`, dbErr);
      }
    }
  })();

  return c.json({ document: doc, message: 'Document upload started' }, 202);
});

// POST /search — semantic search across document chunks
documentsRouter.post('/search', async (c) => {
  const { query, project_id, k } = await c.req.json<{
    query: string;
    project_id?: string;
    k?: number;
  }>();

  if (!query) return c.json({ error: 'Query required' }, 400);

  try {
    const queryVec = await embed(query);
    const results = searchChunksBySimilarity(queryVec, {
      projectId: project_id,
      k: k ?? 5,
    });

    return c.json({
      results: results.map((r) => ({
        content: r.content,
        score: r.score,
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
      })),
    });
  } catch (err) {
    return c.json({ error: `Search failed: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});

// DELETE /:id — delete a document and its chunks
documentsRouter.delete('/:id', (c) => {
  deleteDocument(c.req.param('id'));
  return c.json({ success: true });
});
