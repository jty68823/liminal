import { nanoid } from 'nanoid';
import { getDb, artifacts, eq } from '@liminal/db';
import type { ArtifactType } from '@liminal/core';

export interface DetectedArtifact {
  id: string;
  type: ArtifactType;
  language?: string;
  title?: string;
  content: string;
}

interface ParsedCodeBlock {
  language: string;
  content: string;
  lineCount: number;
}

/**
 * Parses fenced code blocks from markdown-like text.
 * Returns all ``` ... ``` blocks with their language hints and content.
 */
function parseCodeBlocks(text: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = [];
  // Match fenced code blocks: ```language\ncode\n```
  const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const language = (match[1] ?? '').trim().toLowerCase();
    const content = match[2] ?? '';
    const lineCount = content.split('\n').length;
    blocks.push({ language, content, lineCount });
  }

  return blocks;
}

/**
 * Classifies a parsed code block into an ArtifactType.
 * Returns null if the block is not artifact-worthy.
 */
function classifyBlock(block: ParsedCodeBlock): ArtifactType | null {
  const { language, content, lineCount } = block;

  // HTML artifacts: language is 'html' and contains html/body tags
  if (language === 'html' && (content.includes('<html') || content.includes('<body'))) {
    return 'html';
  }

  // SVG artifacts
  if (language === 'svg' || (language === 'html' && content.trim().startsWith('<svg'))) {
    return 'svg';
  }

  // React/JSX artifacts
  if (language === 'jsx' || language === 'tsx') {
    return 'react';
  }

  // Mermaid diagrams
  if (language === 'mermaid') {
    return 'mermaid';
  }

  // Markdown artifacts (standalone markdown blocks)
  if (language === 'markdown' || language === 'md') {
    return 'markdown';
  }

  // Large code blocks (> 15 lines) are artifact-worthy regardless of language
  if (lineCount > 15 && language.length > 0) {
    return 'code';
  }

  return null;
}

/**
 * Derives a human-readable title from a code block.
 * Tries to extract function/class names, file comments, or falls back to a generic label.
 */
function deriveTitle(block: ParsedCodeBlock, artifactType: ArtifactType): string {
  const { language, content } = block;

  if (artifactType === 'html') return 'HTML Page';
  if (artifactType === 'svg') return 'SVG Diagram';
  if (artifactType === 'mermaid') return 'Diagram';
  if (artifactType === 'markdown') return 'Document';
  if (artifactType === 'react') return 'React Component';

  // For code, try to find the first meaningful name
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  // Look for class declaration
  for (const line of lines.slice(0, 10)) {
    const classMatch = line.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
    if (classMatch) return `${classMatch[1]} Class`;

    const funcMatch = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) return `${funcMatch[1]} Function`;

    const constFuncMatch = line.match(/^(?:export\s+)?const\s+(\w+)\s*=/);
    if (constFuncMatch) return `${constFuncMatch[1]}`;
  }

  const langLabel = language ? ` (${language})` : '';
  return `Code Block${langLabel}`;
}

export interface ArtifactRow {
  id: string;
  conversationId: string;
  messageId?: string | null;
  type: string;
  language?: string | null;
  title?: string | null;
  content: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Scans assistant response text for fenced code blocks, classifies them into
 * artifact types, persists them to the database, and returns the created artifact records.
 */
export function detectAndSaveArtifacts(
  responseText: string,
  conversationId: string,
  messageId: string,
): ArtifactRow[] {
  const db = getDb();
  const blocks = parseCodeBlocks(responseText);
  const created: ArtifactRow[] = [];

  for (const block of blocks) {
    const artifactType = classifyBlock(block);
    if (!artifactType) continue;

    const id = nanoid();
    const now = Date.now();
    const title = deriveTitle(block, artifactType);
    const language = block.language || null;

    const row = {
      id,
      conversationId,
      messageId,
      type: artifactType,
      language,
      title,
      content: block.content,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(artifacts).values(row).run();

    const saved = db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .get() as ArtifactRow;

    created.push(saved);
  }

  return created;
}

/**
 * Retrieves a single artifact by ID.
 */
export function getArtifact(id: string): ArtifactRow | null {
  const db = getDb();
  return (db.select().from(artifacts).where(eq(artifacts.id, id)).get() as ArtifactRow) ?? null;
}

/**
 * Updates an artifact's content and increments the version counter.
 */
export function updateArtifactContent(id: string, content: string): ArtifactRow | null {
  const db = getDb();

  const existing = db.select().from(artifacts).where(eq(artifacts.id, id)).get() as ArtifactRow | undefined;
  if (!existing) return null;

  const newVersion = (existing.version ?? 1) + 1;
  const now = Date.now();

  db.update(artifacts)
    .set({ content, version: newVersion, updatedAt: now })
    .where(eq(artifacts.id, id))
    .run();

  return (db.select().from(artifacts).where(eq(artifacts.id, id)).get() as ArtifactRow) ?? null;
}
