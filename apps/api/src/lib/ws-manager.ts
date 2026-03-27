/**
 * WebSocket connection manager — tracks subscriptions, broadcasts events.
 */

import type { ServerWebSocket } from 'bun';

export interface WsMessage {
  type: string;
  taskId?: string;
  [key: string]: unknown;
}

interface WsClient {
  ws: ServerWebSocket<unknown> | { send(data: string): void; readyState: number };
  subscribedTaskIds: Set<string>;
}

class WebSocketManager {
  private clients = new Map<string, WsClient>();
  private clientCounter = 0;

  addClient(ws: WsClient['ws']): string {
    const id = `ws-${++this.clientCounter}`;
    this.clients.set(id, { ws, subscribedTaskIds: new Set() });
    console.log(`[ws] Client connected: ${id} (total: ${this.clients.size})`);
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[ws] Client disconnected: ${id} (total: ${this.clients.size})`);
  }

  subscribe(clientId: string, taskId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedTaskIds.add(taskId);
    }
  }

  unsubscribe(clientId: string, taskId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedTaskIds.delete(taskId);
    }
  }

  /**
   * Broadcast a message to all clients subscribed to a specific task.
   */
  broadcastToTask(taskId: string, message: WsMessage): void {
    const data = JSON.stringify(message);
    for (const [id, client] of this.clients) {
      if (client.subscribedTaskIds.has(taskId) || client.subscribedTaskIds.has('*')) {
        try {
          if (client.ws.readyState === 1) { // OPEN
            client.ws.send(data);
          }
        } catch {
          this.removeClient(id);
        }
      }
    }
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcastAll(message: WsMessage): void {
    const data = JSON.stringify(message);
    for (const [id, client] of this.clients) {
      try {
        if (client.ws.readyState === 1) {
          client.ws.send(data);
        }
      } catch {
        this.removeClient(id);
      }
    }
  }

  handleMessage(clientId: string, raw: string): void {
    try {
      const msg = JSON.parse(raw) as WsMessage;

      switch (msg.type) {
        case 'subscribe':
          if (msg.taskId) this.subscribe(clientId, msg.taskId);
          break;
        case 'unsubscribe':
          if (msg.taskId) this.unsubscribe(clientId, msg.taskId);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
      }
    } catch {
      this.sendToClient(clientId, { type: 'error', message: 'Invalid JSON' });
    }
  }

  private sendToClient(clientId: string, message: WsMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
