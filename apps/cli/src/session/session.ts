import fs from 'fs';
import path from 'path';
import { getConfig } from '../config/loader.js';

export interface Session {
  conversationId: string | null;
  projectId: string | null;
  cwd: string;
  model: string;
  apiUrl: string;
  systemPrompt: string;
}

export interface ProjectConfig {
  systemPrompt?: string;
  model?: string;
}

/**
 * Walk up the directory tree looking for LIMINAL.md.
 * Returns the first match found, or null if none.
 */
export function loadProjectConfig(cwd: string): ProjectConfig | null {
  let dir = path.resolve(cwd);

  // Traverse upward until we hit the filesystem root
  while (true) {
    const candidate = path.join(dir, 'LIMINAL.md');
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        const result: ProjectConfig = { systemPrompt: raw };

        // Optionally parse a `model:` frontmatter line, e.g.:
        // <!-- model: qwen2.5-coder:7b -->
        const modelMatch = raw.match(/<!--\s*model:\s*([^\s>]+)\s*-->/i);
        if (modelMatch && modelMatch[1]) {
          result.model = modelMatch[1];
        }

        return result;
      } catch {
        // Ignore read errors and keep walking
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      break;
    }
    dir = parent;
  }

  return null;
}

export function createSession(options: Partial<Session> = {}): Session {
  const config = getConfig();
  const cwd = options.cwd ?? process.cwd();

  // Try to load project config from LIMINAL.md
  const projectConfig = loadProjectConfig(cwd);

  return {
    conversationId: options.conversationId ?? null,
    projectId: options.projectId ?? null,
    cwd,
    model: options.model ?? projectConfig?.model ?? config.defaultModel,
    apiUrl: options.apiUrl ?? config.apiUrl,
    systemPrompt: options.systemPrompt ?? projectConfig?.systemPrompt ?? '',
  };
}
