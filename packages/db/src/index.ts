// Database client
export { getDb } from './client.js';

// Schema
export * as schema from './schema.js';
export {
  conversations,
  messages,
  artifacts,
  projects,
  memory,
  toolCalls,
  mcpServers,
  checkpoints,
  skills,
  settings,
  documents,
  documentChunks,
  conversationSummaries,
  coworkSessions,
  coworkMessages,
  autoTaskRuns,
  autoTaskEvents,
} from './schema.js';

// Conversation queries
export {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
} from './queries/conversations.js';
export type {
  Conversation,
  CreateConversationData,
  ListConversationsOptions,
} from './queries/conversations.js';

// Message queries
export {
  createMessage,
  getMessages,
  getLastMessages,
} from './queries/messages.js';
export type {
  Message,
  CreateMessageData,
  GetMessagesOptions,
} from './queries/messages.js';

// Project queries
export {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
} from './queries/projects.js';
export type {
  Project,
  CreateProjectData,
} from './queries/projects.js';

// Memory queries
export {
  addMemory,
  listMemory,
  deleteMemory,
  searchMemoryBySimilarity,
} from './queries/memory.js';
export type {
  Memory,
  AddMemoryData,
  ListMemoryOptions,
} from './queries/memory.js';

// Settings queries
export {
  getSetting,
  getSettingParsed,
  setSetting,
  setSettingJson,
  deleteSetting,
  listSettings,
} from './queries/settings.js';
export type { Setting } from './queries/settings.js';

// Document queries
export {
  createDocument,
  getDocument,
  listDocuments,
  updateDocumentStatus,
  deleteDocument,
  addDocumentChunk,
  getDocumentChunks,
  searchChunksBySimilarity,
} from './queries/documents.js';
export type { Document, DocumentChunk } from './queries/documents.js';

// Cowork queries
export {
  createCoworkSession,
  getCoworkSession,
  listCoworkSessions,
  updateCoworkSession,
  addCoworkMessage,
  getCoworkMessages,
} from './queries/cowork.js';
export type { CoworkSession, CoworkMessage } from './queries/cowork.js';

// Auto Task queries
export {
  createAutoTaskRun,
  getAutoTaskRun,
  listAutoTaskRuns,
  updateAutoTaskRun,
  appendAutoTaskEvent,
  getAutoTaskEvents,
} from './queries/auto-task.js';
export type { AutoTaskRun, AutoTaskEvent } from './queries/auto-task.js';

// Re-export drizzle-orm helpers so consumers use the same instance
export { eq, and, or, desc, asc, like, sql } from 'drizzle-orm';

// Skills queries
export {
  addSkill,
  listSkills,
  getSkill,
  updateSkill,
  deleteSkill,
} from './queries/skills.js';
export type {
  Skill,
  NewSkill,
  AddSkillData,
} from './queries/skills.js';

// Checkpoint queries
export {
  createCheckpoint,
  listCheckpoints,
  getLatestCheckpoint,
  deleteCheckpoint,
} from './queries/checkpoints.js';
export type {
  Checkpoint,
} from './queries/checkpoints.js';
