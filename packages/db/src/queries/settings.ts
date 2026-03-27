/**
 * Settings queries — key-value store for app configuration.
 */

import { getDb } from '../client.js';
import { settings } from '../schema.js';
import { eq } from 'drizzle-orm';

export interface Setting {
  key: string;
  value: string;
  updatedAt: number;
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const rows = db.select().from(settings).where(eq(settings.key, key)).all();
  return rows.length > 0 ? rows[0].value : null;
}

export function getSettingParsed<T>(key: string, defaultValue: T): T {
  const raw = getSetting(key);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key: string, value: string): Setting {
  const db = getDb();
  const now = Date.now();

  const existing = db.select().from(settings).where(eq(settings.key, key)).all();
  if (existing.length > 0) {
    db.update(settings).set({ value, updatedAt: now }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value, updatedAt: now }).run();
  }

  return { key, value, updatedAt: now };
}

export function setSettingJson(key: string, value: unknown): Setting {
  return setSetting(key, JSON.stringify(value));
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.delete(settings).where(eq(settings.key, key)).run();
}

export function listSettings(): Setting[] {
  const db = getDb();
  return db.select().from(settings).all();
}
