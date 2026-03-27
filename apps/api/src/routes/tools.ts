import { Hono } from 'hono';
import { z } from 'zod';
import {
  bashTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  searchFilesTool,
  gitTool,
  screenshotTool,
  clickTool,
  typeTool,
  keyTool,
  scrollTool,
} from '@liminal/tools';

export const toolsRouter = new Hono();

// ---------------------------------------------------------------------------
// Generic tool executor
// ---------------------------------------------------------------------------

async function executeTool(
  tool: { definition: { name: string }; execute(input: Record<string, unknown>): Promise<string> },
  input: unknown,
) {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid input: must be a JSON object', is_error: true };
  }
  try {
    const output = await tool.execute(input as Record<string, unknown>);
    return { output, is_error: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: message, is_error: true };
  }
}

// ---------------------------------------------------------------------------
// POST /bash — execute a bash command
// ---------------------------------------------------------------------------

const BashSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

toolsRouter.post('/bash', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = BashSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(bashTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /read-file — read a file
// ---------------------------------------------------------------------------

const ReadFileSchema = z.object({
  path: z.string().min(1),
  start_line: z.number().int().positive().optional(),
  end_line: z.number().int().positive().optional(),
});

toolsRouter.post('/read-file', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = ReadFileSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  // Map snake_case to the tool's expected parameter names
  const input: Record<string, unknown> = { path: parseResult.data.path };
  if (parseResult.data.start_line !== undefined) input['start_line'] = parseResult.data.start_line;
  if (parseResult.data.end_line !== undefined) input['end_line'] = parseResult.data.end_line;

  const result = await executeTool(readFileTool, input);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /write-file — write a file
// ---------------------------------------------------------------------------

const WriteFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

toolsRouter.post('/write-file', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = WriteFileSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(writeFileTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /edit-file — perform exact string replacement in a file
// ---------------------------------------------------------------------------

const EditFileSchema = z.object({
  path: z.string().min(1),
  old_string: z.string().min(1),
  new_string: z.string(),
});

toolsRouter.post('/edit-file', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = EditFileSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(editFileTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /list-files — glob file listing
// ---------------------------------------------------------------------------

const ListFilesSchema = z.object({
  pattern: z.string().min(1),
  cwd: z.string().optional(),
});

toolsRouter.post('/list-files', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = ListFilesSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(listFilesTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /search-files — grep in files
// ---------------------------------------------------------------------------

const SearchFilesSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  file_glob: z.string().optional(),
  case_insensitive: z.boolean().optional(),
});

toolsRouter.post('/search-files', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = SearchFilesSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(searchFilesTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /git — git operations
// ---------------------------------------------------------------------------

const GitOperations = ['status', 'diff', 'add', 'commit', 'log', 'branch', 'checkout', 'push', 'pull'] as const;

const GitSchema = z.object({
  operation: z.enum(GitOperations),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  message: z.string().optional(),
});

toolsRouter.post('/git', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parseResult = GitSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten(), is_error: true }, 400);
  }

  const result = await executeTool(gitTool, parseResult.data);
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// GET /computer/screenshot — capture current screen
// ---------------------------------------------------------------------------

toolsRouter.get('/computer/screenshot', async (c) => {
  if (!process.env['ENABLE_COMPUTER_USE']) {
    return c.json({ error: 'Computer use is disabled. Set ENABLE_COMPUTER_USE=1', is_error: true }, 403);
  }
  const result = await executeTool(screenshotTool, {});
  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// POST /computer/action — perform a computer action (click/type/key/scroll)
// ---------------------------------------------------------------------------

const ComputerActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    x: z.number(),
    y: z.number(),
    button: z.enum(['left', 'right', 'middle']).optional(),
  }),
  z.object({
    type: z.literal('type'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('key'),
    key: z.string(),
  }),
  z.object({
    type: z.literal('scroll'),
    x: z.number(),
    y: z.number(),
    direction: z.enum(['up', 'down']),
    amount: z.number().optional(),
  }),
]);

toolsRouter.post('/computer/action', async (c) => {
  if (!process.env['ENABLE_COMPUTER_USE']) {
    return c.json({ error: 'Computer use is disabled. Set ENABLE_COMPUTER_USE=1', is_error: true }, 403);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body', is_error: true }, 400);
  }

  const parsed = ComputerActionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten(), is_error: true }, 400);
  }

  const action = parsed.data;
  let result;
  if (action.type === 'click') {
    result = await executeTool(clickTool, { x: action.x, y: action.y, button: action.button ?? 'left' });
  } else if (action.type === 'type') {
    result = await executeTool(typeTool, { text: action.text });
  } else if (action.type === 'key') {
    result = await executeTool(keyTool, { key: action.key });
  } else {
    result = await executeTool(scrollTool, { x: action.x, y: action.y, direction: action.direction, amount: action.amount ?? 3 });
  }

  return c.json(result, result.is_error ? 500 : 200);
});

// ---------------------------------------------------------------------------
// GET / — list available tool endpoints
// ---------------------------------------------------------------------------

toolsRouter.get('/', (c) => {
  return c.json({
    tools: [
      {
        name: 'bash',
        endpoint: 'POST /api/v1/tools/bash',
        description: bashTool.definition.description,
      },
      {
        name: 'read_file',
        endpoint: 'POST /api/v1/tools/read-file',
        description: readFileTool.definition.description,
      },
      {
        name: 'write_file',
        endpoint: 'POST /api/v1/tools/write-file',
        description: writeFileTool.definition.description,
      },
      {
        name: 'edit_file',
        endpoint: 'POST /api/v1/tools/edit-file',
        description: editFileTool.definition.description,
      },
      {
        name: 'list_files',
        endpoint: 'POST /api/v1/tools/list-files',
        description: listFilesTool.definition.description,
      },
      {
        name: 'search_files',
        endpoint: 'POST /api/v1/tools/search-files',
        description: searchFilesTool.definition.description,
      },
      {
        name: 'git',
        endpoint: 'POST /api/v1/tools/git',
        description: gitTool.definition.description,
        note: 'Accepts { operation, args?, cwd?, message? }. Operations: status, diff, add, commit, log, branch, checkout, push, pull.',
      },
      {
        name: 'computer_screenshot',
        endpoint: 'GET /api/v1/tools/computer/screenshot',
        description: screenshotTool.definition.description,
        note: 'Requires ENABLE_COMPUTER_USE=1',
      },
      {
        name: 'computer_action',
        endpoint: 'POST /api/v1/tools/computer/action',
        description: 'Perform a computer action: click, type, key press, or scroll.',
        note: 'Requires ENABLE_COMPUTER_USE=1. Body: { type: "click"|"type"|"key"|"scroll", ...params }',
      },
    ],
  });
});
