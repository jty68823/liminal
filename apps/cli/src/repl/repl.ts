import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import type { ReplOptions } from './App.js';

export type { ReplOptions };

/**
 * Bootstrap the Ink-based terminal REPL.
 *
 * Renders the top-level <App> component and waits until the user exits
 * (Ctrl+C / Ctrl+D) or the process receives SIGINT/SIGTERM.
 */
export async function startRepl(options: ReplOptions): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(App, { options }),
  );

  await waitUntilExit();
}
