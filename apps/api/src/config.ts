import { z } from 'zod';

const envSchema = z.object({
  LIMINAL_DEFAULT_MODEL: z.string().default('Meta-Llama-3.1-8B-Instruct-Q4_K_M'),
  LIMINAL_MODELS_DIR: z.string().default('./data/models'),
  LIMINAL_GPU_LAYERS: z.string().default('-1'),
  DATABASE_PATH: z.string().default('./data/liminal.db'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ENABLE_COMPUTER_USE: z.enum(['0', '1']).default('0'),
  SEARXNG_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nEnvironment variables:');
    console.error('  LIMINAL_DEFAULT_MODEL  (default: Meta-Llama-3.1-8B-Instruct-Q4_K_M)');
    console.error('  LIMINAL_MODELS_DIR     (default: ./data/models)');
    console.error('  DATABASE_PATH          (default: ./data/liminal.db)');
    process.exit(1);
  }

  _config = result.data;
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}
