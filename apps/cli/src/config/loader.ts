import Conf from 'conf';

export interface CliConfig {
  apiUrl: string;
  defaultModel: string;
  theme: 'dark' | 'light';
  autoApproveTools: boolean;
  permissions: Record<string, 'allow' | 'deny'>;
}

const conf = new Conf<CliConfig>({
  projectName: 'liminal',
  defaults: {
    apiUrl: 'http://localhost:3001',
    defaultModel: 'deepseek-r1:8b',
    theme: 'dark',
    autoApproveTools: false,
    permissions: {},
  },
});

export function getConfig(): CliConfig {
  return conf.store;
}

export function setConfig<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
  conf.set(key, value);
}
