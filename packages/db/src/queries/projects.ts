import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { projects } from '../schema.js';

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export interface CreateProjectData {
  name: string;
  description?: string;
  systemPrompt?: string;
  rootPath?: string;
  metadata?: string;
}

export function createProject(data: CreateProjectData): Project {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const row: NewProject = {
    id,
    name: data.name,
    description: data.description ?? null,
    systemPrompt: data.systemPrompt ?? null,
    rootPath: data.rootPath ?? null,
    createdAt: now,
    updatedAt: now,
    metadata: data.metadata ?? null,
  };
  db.insert(projects).values(row).run();
  return db.select().from(projects).where(eq(projects.id, id)).get() as Project;
}

export function getProject(id: string): Project | null {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
}

export function updateProject(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): void {
  const db = getDb();
  db.update(projects)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(projects.id, id))
    .run();
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}
