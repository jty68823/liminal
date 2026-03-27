#!/usr/bin/env node
// Database initialization script
// Run: node scripts/init-db.mjs

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const dbPath = process.env.DATABASE_PATH || join(rootDir, 'data', 'liminal.db');
const sqlPath = join(rootDir, 'packages', 'db', 'src', 'migrations', '0001_init.sql');

console.log(`Initializing database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const sql = readFileSync(sqlPath, 'utf-8');
db.exec(sql);
db.close();

console.log('Database initialized successfully!');
