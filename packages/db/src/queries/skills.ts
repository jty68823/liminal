import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { skills } from '../schema.js';

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

export interface AddSkillData {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  content: string;
  riskScore?: number;
  sourceUrl?: string;
}

export function addSkill(data: AddSkillData): Skill {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.insert(skills).values({
    id,
    name: data.name,
    description: data.description ?? null,
    version: data.version ?? '1.0.0',
    author: data.author ?? null,
    content: data.content,
    riskScore: data.riskScore ?? 0,
    sourceUrl: data.sourceUrl ?? null,
    enabled: 1,
    installedAt: now,
    updatedAt: now,
  }).run();
  return db.select().from(skills).where(eq(skills.id, id)).get() as Skill;
}

export function listSkills(): Skill[] {
  const db = getDb();
  return db.select().from(skills).orderBy(desc(skills.installedAt)).all();
}

export function getSkill(id: string): Skill | undefined {
  const db = getDb();
  return db.select().from(skills).where(eq(skills.id, id)).get();
}

export function updateSkill(id: string, updates: Partial<Pick<Skill, 'enabled' | 'content' | 'riskScore'>>): void {
  const db = getDb();
  db.update(skills).set({ ...updates, updatedAt: Date.now() }).where(eq(skills.id, id)).run();
}

export function deleteSkill(id: string): void {
  const db = getDb();
  db.delete(skills).where(eq(skills.id, id)).run();
}
