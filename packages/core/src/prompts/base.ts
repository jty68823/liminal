import type { ToolDefinition } from '../types/tool.js';

/**
 * Options for customising the assembled system prompt.
 */
export interface BuildSystemPromptOptions {
  /** A project-level system prompt that overrides the default preamble. */
  projectPrompt?: string;
  /** Short memory snippets to inject into the prompt. */
  memory?: string[];
  /** Tool definitions for models that do not support native function calling. */
  tools?: ToolDefinition[];
  /** ISO-8601 date string injected into the prompt so the model knows the current date. */
  date?: string;
  /** When true, injects Constitutional AI verification rules. */
  constitutionalRules?: boolean;
}

const BASE_SYSTEM_PROMPT = `You are Liminal AI — an intelligent local AI assistant powered by the Liminal AI engine. You help users with a wide range of tasks including writing, analysis, coding, research, and creative projects. All processing runs locally on the user's machine with zero data sent to external servers.

You have the following capabilities:
- Writing and editing: drafting, proofreading, summarising, and transforming text
- Code: writing, reviewing, debugging, and explaining code across many languages
- Analysis: breaking down complex topics, comparing options, and synthesising information
- Research: answering questions, explaining concepts, and citing relevant details
- Creative: brainstorming, storytelling, ideation, and open-ended generation
- Tools: executing commands, reading/writing files, searching the web, and managing git

Guidelines:
- Be concise but thorough. Prefer clarity over verbosity.
- When writing code, always specify the language and explain non-obvious decisions.
- If you are uncertain, say so clearly rather than guessing.
- Respect the user's autonomy — offer recommendations but do not impose them.
- Never fabricate facts, citations, or file contents.
- When producing structured output (JSON, tables, lists), format it consistently.
- Challenge assumptions when they appear incorrect — suggest better alternatives.
- Verify facts using tools before stating them as truth.`;

/**
 * Formats a single ToolDefinition as a human-readable description block
 * suitable for models that do not support native tool calling.
 */
function formatToolForPrompt(tool: ToolDefinition): string {
  const lines: string[] = [`### ${tool.name}`, tool.description];

  const schema = tool.input_schema;
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    lines.push('');
    lines.push('**Parameters:**');
    for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
      const required = Array.isArray(schema.required) && schema.required.includes(paramName);
      const typeLabel = Array.isArray(paramSchema.type)
        ? paramSchema.type.join(' | ')
        : (paramSchema.type ?? 'any');
      const requiredLabel = required ? ' (required)' : ' (optional)';
      const desc = paramSchema.description ? ` — ${paramSchema.description}` : '';
      lines.push(`- \`${paramName}\` \`${typeLabel}\`${requiredLabel}${desc}`);
    }
  }

  return lines.join('\n');
}

/**
 * Assembles the final system prompt string from the provided options.
 *
 * The resulting string is composed of:
 * 1. The base (or project-level) assistant preamble
 * 2. An optional `<memory>` block containing persistent user memories
 * 3. An optional `<tools>` block for models without native function calling
 * 4. An optional date line
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
  const { projectPrompt, memory, tools, date, constitutionalRules = true } = options;
  const sections: string[] = [];

  // Core identity / instructions
  sections.push(projectPrompt?.trim() || BASE_SYSTEM_PROMPT);

  // Constitutional AI rules (enabled by default)
  if (constitutionalRules) {
    sections.push(
      `<constitutional_rules>
VERIFICATION PROTOCOL — Follow these rules to minimize errors and hallucination:
1. Before assuming any fact about the codebase, verify it with tools (read_file, bash, search_files).
2. If the user's request contains an ambiguous assumption, challenge it: state the assumption and ask for confirmation.
3. After generating code, mentally trace execution to check for errors before presenting it.
4. If you discover a mistake in your previous response, immediately acknowledge and correct it.
5. Never fabricate file contents, function signatures, or API responses.
6. When unsure, say "I'm not certain" rather than guessing.
7. For complex tasks, break them into steps and verify each step before proceeding.
8. Cross-reference multiple files when analyzing dependencies — a change in one file may affect others.
9. Always consider edge cases and error handling in generated code.
</constitutional_rules>`,
    );
  }

  // Memory block
  if (memory && memory.length > 0) {
    const memoryLines = memory
      .map((m) => m.trim())
      .filter(Boolean)
      .map((m) => `- ${m}`)
      .join('\n');

    sections.push(
      `<memory>\nThe following facts have been remembered from previous conversations:\n${memoryLines}\n</memory>`,
    );
  }

  // Tools block (for models that require textual tool descriptions)
  if (tools && tools.length > 0) {
    const toolDescriptions = tools.map(formatToolForPrompt).join('\n\n');
    sections.push(
      `<tools>\nYou have access to the following tools. To call a tool, respond with a JSON object of the form:\n{"tool": "<tool_name>", "input": {<parameters>}}\n\nAvailable tools:\n\n${toolDescriptions}\n</tools>`,
    );
  }

  // Current date
  const effectiveDate = date ?? new Date().toISOString().split('T')[0];
  sections.push(`Current date: ${effectiveDate}`);

  return sections.join('\n\n');
}
