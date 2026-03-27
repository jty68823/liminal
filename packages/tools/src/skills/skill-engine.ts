/**
 * Skill Engine
 *
 * Manages skill lifecycle: loading, activation, and prompt injection.
 */

import type { Skill } from '@liminal/db';
import { validateSkill, type ValidationResult } from './skill-validator.js';

export { validateSkill, type ValidationResult };

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  instructions: string;
}

/**
 * Parse skill markdown content into structured metadata.
 * Expected format:
 * ```
 * # Skill Name
 * description: ...
 * version: ...
 * author: ...
 * ---
 * (instructions markdown)
 * ```
 */
export function parseSkillContent(content: string): SkillMetadata {
  const lines = content.split('\n');
  let name = 'Unnamed Skill';
  let description = '';
  let version = '1.0.0';
  let author = 'Unknown';
  let instructionsStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('# ')) {
      name = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('description:')) {
      description = line.slice('description:'.length).trim();
      continue;
    }
    if (line.startsWith('version:')) {
      version = line.slice('version:'.length).trim();
      continue;
    }
    if (line.startsWith('author:')) {
      author = line.slice('author:'.length).trim();
      continue;
    }
    if (line === '---') {
      instructionsStart = i + 1;
      break;
    }
  }

  const instructions = lines.slice(instructionsStart).join('\n').trim();

  return { name, description, version, author, instructions };
}

/**
 * Build the system prompt extension for active skills.
 */
export function buildSkillPrompt(activeSkills: Skill[]): string {
  if (activeSkills.length === 0) return '';

  const sections = activeSkills
    .filter(s => s.enabled)
    .map(s => {
      const meta = parseSkillContent(s.content);
      return `<skill name="${meta.name}">\n${meta.instructions}\n</skill>`;
    });

  if (sections.length === 0) return '';

  return `\n\n## Active Skills\n${sections.join('\n\n')}`;
}

/**
 * Validate a skill and return analysis.
 */
export function analyzeSkill(content: string): {
  metadata: SkillMetadata;
  validation: ValidationResult;
} {
  const metadata = parseSkillContent(content);
  const validation = validateSkill(content);
  return { metadata, validation };
}
