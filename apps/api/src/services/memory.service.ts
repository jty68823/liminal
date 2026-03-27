import { addMemory } from '@liminal/db';
import { embed } from '@liminal/inference';

export interface AddMemoryRequest {
  content: string;
  projectId?: string;
  conversationId?: string;
  source?: string;
}

export async function addMemoryWithEmbedding(data: AddMemoryRequest): Promise<void> {
  let embeddingBuf: Buffer | undefined;
  try {
    const vec = await embed(data.content);
    embeddingBuf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
  } catch {
    // Store without embedding — will be skipped in similarity search
  }
  addMemory({
    content: data.content,
    projectId: data.projectId,
    conversationId: data.conversationId,
    source: data.source ?? 'explicit',
    embedding: embeddingBuf,
  });
}
