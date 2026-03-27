// ts-node ESM loader registration for Node.js v18.19+ / v20+
// Replaces the deprecated --loader flag
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

// Load .env BEFORE any application modules are imported,
// so providers can read env vars during singleton construction.
config({ path: new URL('../../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

register('ts-node/esm', pathToFileURL('./'));
