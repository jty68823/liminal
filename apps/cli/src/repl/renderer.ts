import chalk from 'chalk';
import { highlight } from 'cli-highlight';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract fenced code blocks from `text` and syntax-highlight them.
 * Non-code text is returned as-is.
 */
function highlightCodeBlocks(text: string): string {
  // Match ``` optional-lang newline ... ```
  return text.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const trimmed = code.trimEnd();
      try {
        const highlighted = highlight(trimmed, {
          language: lang || 'text',
          ignoreIllegals: true,
          theme: {
            keyword: chalk.cyan,
            built_in: chalk.cyan,
            string: chalk.green,
            number: chalk.yellow,
            comment: chalk.gray.italic,
            literal: chalk.magenta,
            function: chalk.blue,
            title: chalk.blue.bold,
          },
        });
        const header = lang ? chalk.dim(`\`\`\`${lang}`) : chalk.dim('```');
        return `${header}\n${highlighted}\n${chalk.dim('```')}`;
      } catch {
        // If highlighting fails, fall back to plain code
        const header = lang ? chalk.dim(`\`\`\`${lang}`) : chalk.dim('```');
        return `${header}\n${chalk.white(trimmed)}\n${chalk.dim('```')}`;
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Public rendering helpers
// ---------------------------------------------------------------------------

/**
 * Format a chat message for terminal display.
 *
 * - "user" role  → dim white with `You:` prefix
 * - "assistant"  → bright white with cyan `Assistant:` prefix, code highlighted
 */
export function renderMessage(role: 'user' | 'assistant', content: string): string {
  if (role === 'user') {
    return `${chalk.bold.blue('You:')} ${chalk.white(content)}`;
  }

  const processed = highlightCodeBlocks(content);
  return `${chalk.bold.cyan('Assistant:')} ${processed}`;
}

/**
 * Format a tool call for terminal display.
 *
 * Status influences the leading icon and colours.
 */
export function renderToolCall(
  name: string,
  input: unknown,
  output: string | null,
  status: 'running' | 'done' | 'error',
): string {
  const icon =
    status === 'running' ? chalk.yellow('⟳')
    : status === 'error'   ? chalk.red('✗')
    :                        chalk.green('✓');

  const header = `${icon} ${chalk.bold.yellow('Tool:')} ${chalk.yellow(name)}`;

  let inputStr = '';
  if (input !== null && input !== undefined) {
    try {
      const pretty = JSON.stringify(input, null, 2);
      inputStr = `\n  ${chalk.dim('input:')} ${chalk.gray(pretty.replace(/\n/g, '\n  '))}`;
    } catch {
      inputStr = `\n  ${chalk.dim('input:')} ${chalk.gray(String(input))}`;
    }
  }

  let outputStr = '';
  if (output !== null && output !== undefined) {
    const colour = status === 'error' ? chalk.red : chalk.dim;
    // Trim very long outputs
    const maxLen = 500;
    const trimmed = output.length > maxLen ? output.slice(0, maxLen) + '…' : output;
    outputStr = `\n  ${chalk.dim('output:')} ${colour(trimmed)}`;
  }

  return `${header}${inputStr}${outputStr}`;
}

/**
 * Format a thinking block.
 * Shown in dim italic to distinguish internal reasoning from the final answer.
 */
export function renderThinking(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  const lines = trimmed.split('\n').map((l) => `  ${chalk.italic.gray(l)}`).join('\n');
  return `${chalk.dim('Thinking…')}\n${lines}`;
}

/**
 * Format a system / status line (e.g. "Connected to model deepseek-r1:8b").
 */
export function renderStatus(message: string): string {
  return chalk.dim(`  ${message}`);
}

/**
 * Format an error message.
 */
export function renderError(message: string): string {
  return `${chalk.bold.red('Error:')} ${chalk.red(message)}`;
}
