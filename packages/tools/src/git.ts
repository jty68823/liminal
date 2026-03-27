import { simpleGit, type SimpleGit, type SimpleGitOptions } from 'simple-git';
import type { ToolHandler } from './registry.js';

type GitOperation =
  | 'status'
  | 'diff'
  | 'add'
  | 'commit'
  | 'log'
  | 'branch'
  | 'checkout'
  | 'push'
  | 'pull';

function makeGit(cwd: string): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir: cwd,
    binary: 'git',
    maxConcurrentProcesses: 6,
  };
  return simpleGit(options);
}

export const gitTool: ToolHandler = {
  definition: {
    name: 'git',
    description:
      'Perform git operations: status, diff, add, commit, log, branch, checkout, push, pull.',
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'status',
            'diff',
            'add',
            'commit',
            'log',
            'branch',
            'checkout',
            'push',
            'pull',
          ],
          description: 'The git operation to perform',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional arguments for the operation',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (git repo root). Defaults to process.cwd()',
        },
        message: {
          type: 'string',
          description: 'Commit message (required for "commit" operation)',
        },
      },
      required: ['operation'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const operation = input['operation'] as GitOperation;
    const args = (input['args'] as string[] | undefined) ?? [];
    const cwd = (input['cwd'] as string | undefined) ?? process.cwd();
    const message = input['message'] as string | undefined;

    if (!operation) {
      return 'Error: "operation" is required.';
    }

    const git = makeGit(cwd);

    try {
      switch (operation) {
        case 'status': {
          const result = await git.status();
          const lines: string[] = [];
          lines.push(`On branch: ${result.current ?? '(unknown)'}`);
          lines.push(`Tracking: ${result.tracking ?? '(none)'}`);
          lines.push('');

          const formatFiles = (label: string, files: string[]) => {
            if (files.length > 0) {
              lines.push(`${label}:`);
              files.forEach((f) => lines.push(`  ${f}`));
              lines.push('');
            }
          };

          formatFiles('Staged (new)', result.created);
          formatFiles('Staged (modified)', result.staged);
          formatFiles('Staged (deleted)', result.deleted);
          formatFiles('Not staged (modified)', result.modified);
          formatFiles('Not staged (deleted)', result.deleted);
          formatFiles('Untracked', result.not_added);
          formatFiles('Conflicted', result.conflicted);

          if (result.isClean()) {
            lines.push('Working tree clean');
          }

          return lines.join('\n').trimEnd();
        }

        case 'diff': {
          // If args contains '--staged' or '--cached', pass through; otherwise default to working tree diff
          const diffResult = await git.diff(args);
          return diffResult.trimEnd() || '(no diff)';
        }

        case 'add': {
          if (args.length === 0) {
            return 'Error: "add" requires at least one file path in args. Use ["."] to add all.';
          }
          await git.add(args);
          return `Added to staging: ${args.join(', ')}`;
        }

        case 'commit': {
          if (!message) {
            return 'Error: "commit" operation requires a "message" field.';
          }
          const commitArgs: string[] = [...args];
          const result = await git.commit(message, commitArgs);
          const summary = result.summary;
          return (
            `Committed: ${result.commit || '(no hash)'}\n` +
            `Branch: ${result.branch || '(unknown)'}\n` +
            `Changes: ${summary.changes} file(s) changed, ` +
            `${summary.insertions} insertion(s), ${summary.deletions} deletion(s)`
          );
        }

        case 'log': {
          // Default to last 10 commits unless --max-count is in args
          const hasMaxCount = args.some(
            (a) => a.startsWith('--max-count') || a.startsWith('-n'),
          );
          const logArgs = hasMaxCount ? args : ['--max-count=10', ...args];
          const result = await git.log(logArgs);
          if (result.all.length === 0) {
            return '(no commits)';
          }
          const lines = result.all.map(
            (c) =>
              `${c.hash.slice(0, 8)}  ${c.date.slice(0, 10)}  ${c.author_name}  ${c.message}`,
          );
          return lines.join('\n');
        }

        case 'branch': {
          if (args.length > 0) {
            // Create or delete a branch
            const result = await git.branch(args);
            return `Branch operation result:\n${JSON.stringify(result, null, 2)}`;
          }
          const result = await git.branch(['-a']);
          const lines = result.all.map(
            (b) => (b === result.current ? `* ${b}` : `  ${b}`),
          );
          return lines.join('\n') || '(no branches)';
        }

        case 'checkout': {
          if (args.length === 0) {
            return 'Error: "checkout" requires at least one argument (branch name or file path).';
          }
          await git.checkout(args);
          return `Checked out: ${args.join(' ')}`;
        }

        case 'push': {
          const result = await git.push(args);
          const pushed = result.pushed
            .map((p) => `  ${p.local} -> ${p.remote}`)
            .join('\n');
          return pushed || 'Push complete (nothing pushed or already up to date).';
        }

        case 'pull': {
          const result = await git.pull(args[0], args[1], {});
          const lines: string[] = [];
          lines.push(
            `Pull result: ${result.summary.changes} change(s), ` +
              `${result.summary.insertions} insertion(s), ` +
              `${result.summary.deletions} deletion(s)`,
          );
          if (result.files.length > 0) {
            lines.push('Files changed:');
            result.files.forEach((f) => lines.push(`  ${f}`));
          }
          return lines.join('\n');
        }

        default: {
          const _exhaustive: never = operation;
          return `Error: Unknown git operation: ${_exhaustive}`;
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      return `Git error: ${error.message ?? String(err)}`;
    }
  },
};
