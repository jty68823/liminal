/**
 * Connector registry — maps app names to AppConnector instances.
 */

import type { AppConnector } from './dispatcher.js';

class ConnectorRegistry {
  private connectors = new Map<string, AppConnector>();

  register(connector: AppConnector): void {
    this.connectors.set(connector.appName.toLowerCase(), connector);
  }

  get(appName: string): AppConnector | undefined {
    return this.connectors.get(appName.toLowerCase());
  }

  has(appName: string): boolean {
    return this.connectors.has(appName.toLowerCase());
  }

  list(): AppConnector[] {
    return Array.from(this.connectors.values());
  }

  supportedApps(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const connectorRegistry = new ConnectorRegistry();
