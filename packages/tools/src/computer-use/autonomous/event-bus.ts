/**
 * EventBus for autonomous agent progress events.
 * Emits events that can be forwarded via SSE to the web client.
 */

import { EventEmitter } from 'events';

export interface AutonomousProgressEvent {
  type: 'autonomous_progress';
  taskId: string;
  iteration: number;
  maxIterations: number;
  phase: 'observe' | 'analyze' | 'plan' | 'act' | 'verify';
  action?: string;
  screenshotBase64?: string;
  analysis?: string;
  goalMet: boolean;
  timestamp: number;
}

export interface AutonomousCompleteEvent {
  type: 'autonomous_complete';
  taskId: string;
  success: boolean;
  summary: string;
  totalIterations: number;
  durationMs: number;
}

export type AutonomousEvent = AutonomousProgressEvent | AutonomousCompleteEvent;

class AutonomousEventBus extends EventEmitter {
  emitProgress(event: AutonomousProgressEvent): void {
    this.emit('progress', event);
  }

  emitComplete(event: AutonomousCompleteEvent): void {
    this.emit('complete', event);
  }

  onProgress(handler: (event: AutonomousProgressEvent) => void): void {
    this.on('progress', handler);
  }

  onComplete(handler: (event: AutonomousCompleteEvent) => void): void {
    this.on('complete', handler);
  }
}

export const autonomousEventBus = new AutonomousEventBus();
