import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';

type DrizzleDb = ReturnType<typeof drizzle>;
let db: DrizzleDb | undefined;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, project_id TEXT, title TEXT, model TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, summary TEXT, metadata TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
  content TEXT NOT NULL, tool_calls TEXT, tool_call_id TEXT,
  tokens_input INTEGER, tokens_output INTEGER, model TEXT,
  created_at INTEGER NOT NULL, sequence INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, message_id TEXT,
  type TEXT NOT NULL, language TEXT, title TEXT, content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, system_prompt TEXT,
  root_path TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, metadata TEXT
);
CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY, project_id TEXT, conversation_id TEXT,
  content TEXT NOT NULL, embedding BLOB, source TEXT NOT NULL DEFAULT 'explicit',
  created_at INTEGER NOT NULL, last_accessed INTEGER
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY, message_id TEXT, conversation_id TEXT NOT NULL,
  tool_name TEXT NOT NULL, input TEXT NOT NULL, output TEXT,
  status TEXT NOT NULL DEFAULT 'pending', duration_ms INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, command TEXT NOT NULL,
  args TEXT, env TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
  messages_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
  version TEXT DEFAULT '1.0.0', author TEXT, content TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
  source_url TEXT, installed_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, project_id TEXT, filename TEXT NOT NULL,
  mime_type TEXT, status TEXT NOT NULL DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, content TEXT NOT NULL,
  embedding BLOB, chunk_index INTEGER NOT NULL, metadata TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, summary TEXT NOT NULL,
  from_sequence INTEGER NOT NULL, to_sequence INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cowork_sessions (
  id TEXT PRIMARY KEY, conversation_id TEXT, task TEXT NOT NULL,
  agents_config TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  result TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cowork_messages (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, agent_role TEXT NOT NULL,
  content TEXT NOT NULL, sequence INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auto_task_runs (
  id TEXT PRIMARY KEY, objective TEXT NOT NULL,
  security_level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  plan TEXT, result TEXT, error TEXT,
  total_tokens INTEGER DEFAULT 0, duration_ms INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auto_task_events (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL,
  type TEXT NOT NULL, payload TEXT NOT NULL,
  subtask_id TEXT, created_at INTEGER NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conv_seq ON messages(conversation_id, sequence);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_memory_project ON memory(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_idx ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conv ON tool_calls(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_checkpoints_conv ON checkpoints(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cowork_messages_session ON cowork_messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv ON conversation_summaries(conversation_id, from_sequence);
CREATE INDEX IF NOT EXISTS idx_auto_task_events_run ON auto_task_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_task_runs_status ON auto_task_runs(status, created_at);
`;

export function getDb(dbPath?: string): DrizzleDb {
  if (db) return db;
  const filePath = dbPath || process.env['DATABASE_PATH'] || './data/liminal.db';
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -32000');   // 32MB page cache
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('mmap_size = 30000000');  // 30MB memory-mapped I/O
  // Auto-initialize tables
  sqlite.exec(INIT_SQL);
  try { sqlite.exec('ALTER TABLE messages ADD COLUMN images TEXT'); } catch {}
  db = drizzle(sqlite, { schema });
  return db;
}
