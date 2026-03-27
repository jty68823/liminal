/**
 * Tool-calling prompt templates with few-shot examples.
 *
 * These help models understand the expected tool call format,
 * especially models that don't support native function calling.
 */

import type { ToolDefinition } from '../types/tool.js';

/**
 * Generates a few-shot tool calling prompt section.
 */
export function buildToolCallingPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';

  const sections: string[] = [];

  sections.push('## Tool Usage');
  sections.push('You have access to tools that you can call to accomplish tasks.');
  sections.push('When you need to use a tool, respond with a tool call in this exact format:');
  sections.push('');
  sections.push('<tool_call>');
  sections.push('{"name": "tool_name", "arguments": {"param1": "value1"}}');
  sections.push('</tool_call>');
  sections.push('');
  sections.push('### Available Tools');
  sections.push('');

  for (const tool of tools) {
    sections.push(`**${tool.name}**: ${tool.description}`);

    if (tool.input_schema.properties) {
      const params = Object.entries(tool.input_schema.properties);
      if (params.length > 0) {
        sections.push('Parameters:');
        for (const [name, schema] of params) {
          const required = Array.isArray(tool.input_schema.required) && tool.input_schema.required.includes(name);
          const typeLabel = typeof schema.type === 'string' ? schema.type : 'any';
          sections.push(`  - ${name} (${typeLabel}${required ? ', required' : ''}): ${schema.description ?? ''}`);
        }
      }
    }
    sections.push('');
  }

  // Few-shot examples
  sections.push('### Examples');
  sections.push('');

  // Example 1: bash tool
  if (tools.some((t) => t.name === 'bash')) {
    sections.push('To list files in the current directory:');
    sections.push('<tool_call>');
    sections.push('{"name": "bash", "arguments": {"command": "ls -la"}}');
    sections.push('</tool_call>');
    sections.push('');
  }

  // Example 2: read_file tool
  if (tools.some((t) => t.name === 'read_file')) {
    sections.push('To read a file:');
    sections.push('<tool_call>');
    sections.push('{"name": "read_file", "arguments": {"path": "src/index.ts"}}');
    sections.push('</tool_call>');
    sections.push('');
  }

  // Example 3: web_search tool
  if (tools.some((t) => t.name === 'web_search')) {
    sections.push('To search the web:');
    sections.push('<tool_call>');
    sections.push('{"name": "web_search", "arguments": {"query": "latest TypeScript features"}}');
    sections.push('</tool_call>');
    sections.push('');
  }

  sections.push('### Important Rules');
  sections.push('1. ALWAYS use the exact tool names listed above.');
  sections.push('2. Each tool call must be wrapped in <tool_call> tags.');
  sections.push('3. Use valid JSON inside the tags.');
  sections.push('4. Wait for the tool result before making another call.');
  sections.push('5. If a tool fails, try a different approach rather than repeating the same call.');
  sections.push('6. Summarize tool results for the user — do not dump raw output.');

  return sections.join('\n');
}
