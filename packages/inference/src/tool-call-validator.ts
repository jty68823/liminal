/**
 * Tool call validation and repair.
 *
 * Handles common LLM mistakes: missing required params, wrong types,
 * tool name typos (via fuzzy matching).
 */

import type { ToolDefinition } from '@liminal/core';

/**
 * Computes edit distance (Levenshtein) between two strings.
 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Fuzzy match a tool name against available tools.
 * Returns the best match if edit distance <= maxDistance, otherwise null.
 */
export function fuzzyMatchToolName(
  name: string,
  tools: ToolDefinition[],
  maxDistance = 2,
): string | null {
  if (!name) return null;

  const lower = name.toLowerCase();

  // Exact match first
  const exact = tools.find((t) => t.name === name);
  if (exact) return exact.name;

  // Case-insensitive exact match
  const caseInsensitive = tools.find((t) => t.name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.name;

  // Common substitutions (underscores for hyphens, etc.)
  const normalized = lower.replace(/[-_]/g, '');
  const normalizedMatch = tools.find((t) => t.name.toLowerCase().replace(/[-_]/g, '') === normalized);
  if (normalizedMatch) return normalizedMatch.name;

  // Edit distance fuzzy match
  let bestMatch: string | null = null;
  let bestDist = maxDistance + 1;

  for (const tool of tools) {
    const dist = editDistance(lower, tool.name.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = tool.name;
    }
  }

  return bestDist <= maxDistance ? bestMatch : null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  repaired: boolean;
  repairedInput?: Record<string, unknown>;
  repairedName?: string;
}

/**
 * Validates a tool call against its definition.
 */
export function validateToolCall(
  name: string,
  input: Record<string, unknown>,
  tools: ToolDefinition[],
): ValidationResult {
  const errors: string[] = [];

  // Find the tool definition
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    // Try fuzzy matching
    const corrected = fuzzyMatchToolName(name, tools);
    if (corrected) {
      return {
        valid: true,
        errors: [],
        repaired: true,
        repairedName: corrected,
        repairedInput: input,
      };
    }
    return { valid: false, errors: [`Unknown tool: ${name}`], repaired: false };
  }

  const schema = tool.input_schema;

  // Check required parameters
  if (Array.isArray(schema.required)) {
    for (const req of schema.required) {
      if (!(req in input) || input[req] === undefined || input[req] === null) {
        errors.push(`Missing required parameter: ${req}`);
      }
    }
  }

  // Check parameter types
  if (schema.properties) {
    for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
      if (paramName in input && input[paramName] !== undefined) {
        const value = input[paramName];
        const expectedType = paramSchema.type;

        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Parameter "${paramName}" should be string, got ${typeof value}`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Parameter "${paramName}" should be number, got ${typeof value}`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter "${paramName}" should be boolean, got ${typeof value}`);
        } else if (expectedType === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Parameter "${paramName}" should be object`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter "${paramName}" should be array`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    repaired: false,
  };
}

/**
 * Attempts to repair common tool call errors:
 * - Coerce types (string "123" → number 123)
 * - Fill missing required params with sensible defaults
 * - Fix nested JSON strings
 */
export function repairToolCall(
  name: string,
  input: Record<string, unknown>,
  tools: ToolDefinition[],
): { name: string; input: Record<string, unknown>; repaired: boolean } {
  // Fix tool name if needed
  let repairedName = name;
  const exactTool = tools.find((t) => t.name === name);
  if (!exactTool) {
    const corrected = fuzzyMatchToolName(name, tools);
    if (corrected) {
      repairedName = corrected;
    } else {
      return { name, input, repaired: false };
    }
  }

  const tool = tools.find((t) => t.name === repairedName);
  if (!tool) return { name: repairedName, input, repaired: repairedName !== name };

  const schema = tool.input_schema;
  const repairedInput = { ...input };
  let didRepair = repairedName !== name;

  // Type coercion
  if (schema.properties) {
    for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
      if (paramName in repairedInput) {
        const value = repairedInput[paramName];
        const expectedType = paramSchema.type;

        if (expectedType === 'string' && typeof value !== 'string') {
          repairedInput[paramName] = String(value);
          didRepair = true;
        } else if (expectedType === 'number' && typeof value === 'string') {
          const num = Number(value);
          if (!isNaN(num)) {
            repairedInput[paramName] = num;
            didRepair = true;
          }
        } else if (expectedType === 'boolean' && typeof value === 'string') {
          repairedInput[paramName] = value === 'true' || value === '1';
          didRepair = true;
        } else if (expectedType === 'object' && typeof value === 'string') {
          try {
            repairedInput[paramName] = JSON.parse(value);
            didRepair = true;
          } catch {
            // keep as-is
          }
        }
      }
    }
  }

  // Fill missing required params with defaults
  if (Array.isArray(schema.required) && schema.properties) {
    for (const req of schema.required) {
      if (!(req in repairedInput) || repairedInput[req] === undefined) {
        const paramSchema = schema.properties[req];
        if (paramSchema?.default !== undefined) {
          repairedInput[req] = paramSchema.default;
          didRepair = true;
        }
      }
    }
  }

  return { name: repairedName, input: repairedInput, repaired: didRepair };
}
