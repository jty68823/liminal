/**
 * A recursive representation of a JSON Schema object.
 */
export interface JSONSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  definitions?: Record<string, JSONSchema>;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  default?: unknown;
  title?: string;
  [key: string]: unknown;
}

/**
 * Describes a tool that the model can request to call.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

/**
 * Represents a specific invocation of a tool requested by the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * The result of executing a tool call.
 */
export interface ToolResult {
  tool_use_id: string;
  output: string;
  is_error: boolean;
  duration_ms?: number;
}
