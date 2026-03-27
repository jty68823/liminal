#!/usr/bin/env node
import { program } from 'commander';
import { startRepl } from './repl/repl.js';

// Register all built-in slash commands before starting the REPL.
// Each module registers itself as a side-effect on import.
import './commands/help.js';
import './commands/clear.js';
import './commands/compact.js';
import './commands/model.js';
import './commands/memory.js';
import './commands/mcp.js';
import './commands/research.js';

program
  .name('liminal')
  .description('Liminal — AI coding assistant')
  .version('0.1.0')
  .option('-m, --model <model>', 'Model to use (overrides config/LIMINAL.md)')
  .option('--api-url <url>', 'API server URL', 'http://localhost:3001')
  .option('--computer-use', 'Enable computer use tools (screenshot, mouse, keyboard control)')
  .argument('[prompt]', 'Optional initial prompt (runs in non-interactive mode)')
  .action(async (prompt: string | undefined, options: { model?: string; apiUrl: string; computerUse?: boolean }) => {
    if (options.computerUse || options['computer-use' as keyof typeof options]) {
      process.env['ENABLE_COMPUTER_USE'] = '1';
      console.log('[cli] Computer use tools enabled');
    }
    await startRepl({
      initialPrompt: prompt,
      model: options.model,
      apiUrl: options.apiUrl,
    });
  });

program.parse();
