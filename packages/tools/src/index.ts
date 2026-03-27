import { registry } from './registry.js';
import { bashTool } from './bash.js';
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  searchFilesTool,
} from './filesystem.js';
import { gitTool } from './git.js';
import { webSearchTool, fetchPageTool } from './web-search.js';
import { analyzePdfTool, analyzeCsvTool, analyzeExcelTool } from './file-analysis.js';
import { dispatchAgentsTool } from './dispatch-agents.js';

// Register all tools with the singleton registry
registry.register(bashTool);
registry.register(readFileTool);
registry.register(writeFileTool);
registry.register(editFileTool);
registry.register(listFilesTool);
registry.register(searchFilesTool);
registry.register(gitTool);
registry.register(webSearchTool);
registry.register(fetchPageTool);
registry.register(analyzePdfTool);
registry.register(analyzeCsvTool);
registry.register(analyzeExcelTool);
registry.register(dispatchAgentsTool);

// Computer use tools - only registered when ENABLE_COMPUTER_USE=1
if (process.env['ENABLE_COMPUTER_USE'] === '1') {
  import('./computer-use.js').then(({ screenshotTool, clickTool, typeTool, keyTool, scrollTool }) => {
    registry.register(screenshotTool);
    registry.register(clickTool);
    registry.register(typeTool);
    registry.register(keyTool);
    registry.register(scrollTool);
  }).catch(() => {});
}

export { registry };
export type { ToolHandler } from './registry.js';

// Re-export individual tools for consumers that want to cherry-pick
export { bashTool } from './bash.js';
export {
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  searchFilesTool,
} from './filesystem.js';
export { gitTool } from './git.js';
export { webSearchTool, fetchPageTool } from './web-search.js';
export { mcpManager } from './mcp/server-manager.js';
export { McpClient } from './mcp/client.js';
export { analyzePdfTool, analyzeCsvTool, analyzeExcelTool } from './file-analysis.js';
export { dispatchAgentsTool } from './dispatch-agents.js';
export { validateSkill } from './skills/skill-validator.js';
export { parseSkillContent, buildSkillPrompt, analyzeSkill } from './skills/skill-engine.js';
export { screenshotTool, clickTool, typeTool, keyTool, scrollTool } from './computer-use.js';

// Security utilities (for Auto Task)
export { scanFile, scanFileHash, scanContentPatterns } from './security/virus-scanner.js';
export type { ScanResult } from './security/virus-scanner.js';
export { encryptFile, decryptFile, deriveSessionKey } from './security/file-encryptor.js';
export type { EncryptedFileMetadata } from './security/file-encryptor.js';
export { runSandboxed, buildSandboxedCommand } from './security/sandbox.js';
export type { SandboxOptions, SandboxResult } from './security/sandbox.js';
