import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

// conversations table
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  title: text('title'),
  model: text('model').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  summary: text('summary'),
  metadata: text('metadata'),  // JSON string
});

// messages table
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  toolCalls: text('tool_calls'),   // JSON string
  toolCallId: text('tool_call_id'),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  model: text('model'),
  images: text('images'),
  createdAt: integer('created_at').notNull(),
  sequence: integer('sequence').notNull(),
});

// artifacts table
export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  messageId: text('message_id'),
  type: text('type').notNull(),
  language: text('language'),
  title: text('title'),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// projects table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt'),
  rootPath: text('root_path'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  metadata: text('metadata'),
});

// memory table
export const memory = sqliteTable('memory', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  conversationId: text('conversation_id'),
  content: text('content').notNull(),
  embedding: blob('embedding'),
  source: text('source').notNull().default('explicit'),
  createdAt: integer('created_at').notNull(),
  lastAccessed: integer('last_accessed'),
});

// tool_calls table (audit log)
export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  messageId: text('message_id'),
  conversationId: text('conversation_id').notNull(),
  toolName: text('tool_name').notNull(),
  input: text('input').notNull(),
  output: text('output'),
  status: text('status').notNull().default('pending'),
  durationMs: integer('duration_ms'),
  createdAt: integer('created_at').notNull(),
});

// mcp_servers table
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  command: text('command').notNull(),
  args: text('args'),
  env: text('env'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});

// checkpoints table (for undo/redo)
export const checkpoints = sqliteTable('checkpoints', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  messagesJson: text('messages_json').notNull(),
  createdAt: integer('created_at').notNull(),
});

// skills table
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  version: text('version').default('1.0.0'),
  author: text('author'),
  content: text('content').notNull(),  // Markdown content of the skill
  riskScore: integer('risk_score').default(0),  // 0-100
  enabled: integer('enabled').notNull().default(1),
  sourceUrl: text('source_url'),
  installedAt: integer('installed_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// settings table (key-value store for app configuration)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// documents table (knowledge base)
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  filename: text('filename').notNull(),
  mimeType: text('mime_type'),
  status: text('status').notNull().default('pending'), // pending, processing, ready, error
  chunkCount: integer('chunk_count').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// document_chunks table (RAG chunks with embeddings)
export const documentChunks = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  content: text('content').notNull(),
  embedding: blob('embedding'),
  chunkIndex: integer('chunk_index').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull(),
});

// conversation_summaries table (context compression)
export const conversationSummaries = sqliteTable('conversation_summaries', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  summary: text('summary').notNull(),
  fromSequence: integer('from_sequence').notNull(),
  toSequence: integer('to_sequence').notNull(),
  createdAt: integer('created_at').notNull(),
});

// cowork_sessions table (multi-agent collaboration)
export const coworkSessions = sqliteTable('cowork_sessions', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  task: text('task').notNull(),
  agentsConfig: text('agents_config').notNull(), // JSON array of agent configs
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  result: text('result'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// cowork_messages table (individual agent messages)
export const coworkMessages = sqliteTable('cowork_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  agentRole: text('agent_role').notNull(),
  content: text('content').notNull(),
  sequence: integer('sequence').notNull(),
  createdAt: integer('created_at').notNull(),
});

// auto_task_runs table
export const autoTaskRuns = sqliteTable('auto_task_runs', {
  id: text('id').primaryKey(),
  objective: text('objective').notNull(),
  securityLevel: integer('security_level').notNull().default(1),
  status: text('status').notNull().default('pending'),
  plan: text('plan'),
  result: text('result'),
  error: text('error'),
  totalTokens: integer('total_tokens').default(0),
  durationMs: integer('duration_ms'),
  maxConcurrent: integer('max_concurrent').default(3),
  concurrencyStrategy: text('concurrency_strategy').default('fixed'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// auto_task_events table
export const autoTaskEvents = sqliteTable('auto_task_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  subtaskId: text('subtask_id'),
  createdAt: integer('created_at').notNull(),
});
