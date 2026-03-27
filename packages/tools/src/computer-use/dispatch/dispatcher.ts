/**
 * ExecutionDispatcher — smart router that tries API connectors first,
 * falls back to browser automation, then to raw screen control.
 */

export interface AppAction {
  app: string;
  action: string;
  params: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  method: 'api' | 'browser' | 'screen';
  output: string;
  screenshotBase64?: string;
  durationMs: number;
}

export interface ExecutionMethod {
  type: 'api' | 'browser' | 'screen';
  priority: number; // lower = tried first
  available(): Promise<boolean>;
  execute(action: AppAction): Promise<ExecutionResult>;
}

export interface AppConnector {
  appName: string;
  supportedActions: string[];
  toExecutionMethod(): ExecutionMethod;
}

export class ExecutionDispatcher {
  private methods: ExecutionMethod[] = [];

  register(method: ExecutionMethod): void {
    this.methods.push(method);
    this.methods.sort((a, b) => a.priority - b.priority);
  }

  registerConnector(connector: AppConnector): void {
    this.register(connector.toExecutionMethod());
  }

  async dispatch(action: AppAction): Promise<ExecutionResult> {
    const errors: string[] = [];

    for (const method of this.methods) {
      try {
        const isAvailable = await method.available();
        if (!isAvailable) {
          errors.push(`[${method.type}] Not available`);
          continue;
        }

        const start = Date.now();
        const result = await method.execute(action);
        result.durationMs = Date.now() - start;
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${method.type}] ${msg}`);
      }
    }

    return {
      success: false,
      method: 'screen',
      output: `All execution methods failed:\n${errors.join('\n')}`,
      durationMs: 0,
    };
  }

  listMethods(): Array<{ type: string; priority: number }> {
    return this.methods.map((m) => ({ type: m.type, priority: m.priority }));
  }
}

/** Singleton dispatcher instance */
export const dispatcher = new ExecutionDispatcher();
