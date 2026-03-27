import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import type { ToolHandler } from './registry.js';

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Maximum file size (50 MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Sensitive file patterns that should not be read/written */
const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.env\.[a-z]+$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
  /credentials\.json$/i,
  /secrets?\.(json|ya?ml|toml)$/i,
  /\/\.ssh\//,
  /\/\.gnupg\//,
  /\/\.aws\/credentials/,
];

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SENSITIVE_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Validates a file path against path traversal attacks.
 * Resolves the path and ensures it stays within the working directory.
 */
function validatePath(filePath: string, cwd?: string): { valid: true; resolved: string } | { valid: false; error: string } {
  const base = cwd ?? process.cwd();
  const resolved = path.resolve(base, filePath);
  // Allow absolute paths but check for traversal when relative
  if (!path.isAbsolute(filePath)) {
    if (!resolved.startsWith(path.resolve(base))) {
      return { valid: false, error: `Path traversal detected: ${filePath}` };
    }
  }
  return { valid: true, resolved };
}

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

export const readFileTool: ToolHandler = {
  definition: {
    name: 'read_file',
    description:
      'Read the contents of a file. Optionally specify a line range. Line numbers are shown in the output (like cat -n). Reads at most 2000 lines by default.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file',
        },
        start_line: {
          type: 'number',
          description: 'First line to read (1-indexed, inclusive)',
        },
        end_line: {
          type: 'number',
          description: 'Last line to read (1-indexed, inclusive)',
        },
      },
      required: ['path'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = input['path'] as string;
    if (!filePath || typeof filePath !== 'string') {
      return 'Error: "path" must be a non-empty string.';
    }

    const pathCheck = validatePath(filePath);
    if (!pathCheck.valid) return `Error: ${pathCheck.error}`;
    const resolvedPath = pathCheck.resolved;

    if (isSensitivePath(resolvedPath)) {
      return `Error: Access denied — sensitive file: ${filePath}`;
    }

    const startLine = input['start_line'] as number | undefined;
    const endLine = input['end_line'] as number | undefined;
    const MAX_LINES = 2000;

    try {
      const stat = await fs.stat(resolvedPath);
      if (stat.size > MAX_FILE_SIZE) {
        return `Error: File exceeds 50MB size limit (${Math.round(stat.size / 1024 / 1024)}MB): ${filePath}`;
      }
      const raw = await fs.readFile(resolvedPath, 'utf-8');
      const allLines = raw.split('\n');

      // Resolve 1-indexed range to 0-indexed slice bounds
      const from = startLine != null ? Math.max(1, startLine) : 1;
      const to =
        endLine != null
          ? Math.min(endLine, allLines.length)
          : Math.min(from + MAX_LINES - 1, allLines.length);

      const selectedLines = allLines.slice(from - 1, to);

      // Format with line numbers padded to the width of the last line number
      const lastNum = to;
      const width = String(lastNum).length;

      const numbered = selectedLines.map((line, idx) => {
        const lineNum = String(from + idx).padStart(width, ' ');
        return `${lineNum}\t${line}`;
      });

      const totalLines = allLines.length;
      const header =
        `File: ${filePath}  (lines ${from}-${to} of ${totalLines})\n` +
        '─'.repeat(60) +
        '\n';

      return header + numbered.join('\n');
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`;
      }
      if (error.code === 'EISDIR') {
        return `Error: Path is a directory, not a file: ${filePath}`;
      }
      return `Error reading file: ${error.message ?? String(err)}`;
    }
  },
};

// ---------------------------------------------------------------------------
// write_file
// ---------------------------------------------------------------------------

export const writeFileTool: ToolHandler = {
  definition: {
    name: 'write_file',
    description:
      'Write content to a file, creating it (and any missing parent directories) if it does not exist. Overwrites existing content.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = input['path'] as string;
    const content = input['content'] as string;

    if (!filePath || typeof filePath !== 'string') {
      return 'Error: "path" must be a non-empty string.';
    }
    if (typeof content !== 'string') {
      return 'Error: "content" must be a string.';
    }

    const pathCheck = validatePath(filePath);
    if (!pathCheck.valid) return `Error: ${pathCheck.error}`;
    const resolvedPath = pathCheck.resolved;

    if (isSensitivePath(resolvedPath)) {
      return `Error: Access denied — cannot write to sensitive file: ${filePath}`;
    }

    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
      return 'Error: Content exceeds 50MB size limit.';
    }

    try {
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(resolvedPath, content, 'utf-8');
      return `File written successfully: ${filePath}`;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      return `Error writing file: ${error.message ?? String(err)}`;
    }
  },
};

// ---------------------------------------------------------------------------
// edit_file
// ---------------------------------------------------------------------------

export const editFileTool: ToolHandler = {
  definition: {
    name: 'edit_file',
    description:
      'Perform an exact string replacement in a file. Fails if the old_string is not found or appears more than once.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The text to replace it with',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = input['path'] as string;
    const oldString = input['old_string'] as string;
    const newString = input['new_string'] as string;

    if (!filePath || typeof filePath !== 'string') {
      return 'Error: "path" must be a non-empty string.';
    }
    if (typeof oldString !== 'string' || oldString.length === 0) {
      return 'Error: "old_string" must be a non-empty string.';
    }
    if (typeof newString !== 'string') {
      return 'Error: "new_string" must be a string.';
    }

    const pathCheck = validatePath(filePath);
    if (!pathCheck.valid) return `Error: ${pathCheck.error}`;
    const resolvedPath = pathCheck.resolved;

    if (isSensitivePath(resolvedPath)) {
      return `Error: Access denied — cannot edit sensitive file: ${filePath}`;
    }

    try {
      const original = await fs.readFile(resolvedPath, 'utf-8');

      // Count occurrences
      let count = 0;
      let searchIndex = 0;
      while (true) {
        const idx = original.indexOf(oldString, searchIndex);
        if (idx === -1) break;
        count++;
        searchIndex = idx + 1;
      }

      if (count === 0) {
        return `Error: old_string not found in file: ${filePath}`;
      }
      if (count > 1) {
        return `Error: old_string appears ${count} times in ${filePath}. Provide more context to make the match unique.`;
      }

      const updated = original.replace(oldString, newString);
      await fs.writeFile(resolvedPath, updated, 'utf-8');
      return `File edited successfully: ${filePath}`;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`;
      }
      return `Error editing file: ${error.message ?? String(err)}`;
    }
  },
};

// ---------------------------------------------------------------------------
// list_files
// ---------------------------------------------------------------------------

export const listFilesTool: ToolHandler = {
  definition: {
    name: 'list_files',
    description:
      'List files matching a glob pattern. Returns a newline-separated list of matching paths.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern, e.g. "src/**/*.ts" or "*.json"',
        },
        cwd: {
          type: 'string',
          description: 'Base directory for the glob (defaults to process.cwd())',
        },
      },
      required: ['pattern'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const pattern = input['pattern'] as string;
    const cwd = (input['cwd'] as string | undefined) ?? process.cwd();

    if (!pattern || typeof pattern !== 'string') {
      return 'Error: "pattern" must be a non-empty string.';
    }

    try {
      const matches = await glob(pattern, {
        cwd,
        dot: true,
        nodir: false,
      });

      if (matches.length === 0) {
        return `No files matched pattern: ${pattern}`;
      }

      const sorted = matches.slice().sort();
      return sorted.join('\n');
    } catch (err: unknown) {
      const error = err as Error;
      return `Error listing files: ${error.message ?? String(err)}`;
    }
  },
};

// ---------------------------------------------------------------------------
// search_files
// ---------------------------------------------------------------------------

export const searchFilesTool: ToolHandler = {
  definition: {
    name: 'search_files',
    description:
      'Search file contents for a regex pattern (like grep). Returns matching lines in "file:line:content" format. Limits to 100 results.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression to search for',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in (defaults to process.cwd())',
        },
        file_glob: {
          type: 'string',
          description: 'Glob pattern to filter files, e.g. "**/*.ts"',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Whether to perform a case-insensitive search (default: false)',
        },
      },
      required: ['pattern'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const pattern = input['pattern'] as string;
    const searchPath = (input['path'] as string | undefined) ?? process.cwd();
    const fileGlob = (input['file_glob'] as string | undefined) ?? '**/*';
    const caseInsensitive = Boolean(input['case_insensitive']);
    const MAX_RESULTS = 100;

    if (!pattern || typeof pattern !== 'string') {
      return 'Error: "pattern" must be a non-empty string.';
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, caseInsensitive ? 'i' : '');
    } catch {
      return `Error: Invalid regular expression: ${pattern}`;
    }

    try {
      // Determine whether searchPath is a file or directory
      const stat = await fs.stat(searchPath).catch(() => null);

      let files: string[];
      if (stat?.isFile()) {
        files = [searchPath];
      } else {
        const cwd = stat?.isDirectory() ? searchPath : process.cwd();
        const rawMatches = await glob(fileGlob, {
          cwd,
          dot: true,
          nodir: true,
          absolute: true,
        });
        files = rawMatches.sort();
      }

      const results: string[] = [];
      let total = 0;

      outer: for (const file of files) {
        let content: string;
        try {
          content = await fs.readFile(file, 'utf-8');
        } catch {
          // Skip unreadable files (binary, permission errors, etc.)
          continue;
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i]!)) {
            results.push(`${file}:${i + 1}:${lines[i]}`);
            total++;
            if (total >= MAX_RESULTS) break outer;
          }
        }
      }

      if (results.length === 0) {
        return `No matches found for pattern: ${pattern}`;
      }

      const suffix = total >= MAX_RESULTS ? `\n(Showing first ${MAX_RESULTS} results)` : '';
      return results.join('\n') + suffix;
    } catch (err: unknown) {
      const error = err as Error;
      return `Error searching files: ${error.message ?? String(err)}`;
    }
  },
};
