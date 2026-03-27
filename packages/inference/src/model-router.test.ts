/**
 * Unit tests for ModelRouter.
 * Tests model selection heuristics and fallback chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./providers/registry.js', () => ({
  providerRegistry: {
    getActive: vi.fn(),
  },
}));

import { providerRegistry } from './providers/registry.js';
import { ModelRouter } from './model-router.js';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ModelRouter', () => {
  describe('selectModel', () => {
    const router = new ModelRouter({
      defaultModel: 'deepseek-r1:8b',
      fastModel: 'llama3.2:1b',
      codeModel: 'qwen2.5-coder:7b',
      embedModel: 'nomic-embed-text',
    });

    it('returns defaultModel for long messages with no task type', () => {
      expect(router.selectModel({ messageLength: 500 })).toBe('deepseek-r1:8b');
    });

    it('returns fastModel for short messages', () => {
      expect(router.selectModel({ messageLength: 50 })).toBe('llama3.2:1b');
    });

    it('returns codeModel when hasCode is true', () => {
      expect(router.selectModel({ hasCode: true })).toBe('qwen2.5-coder:7b');
    });

    it('respects explicit taskType over heuristics', () => {
      expect(router.selectModel({ taskType: 'fast', hasCode: true })).toBe('llama3.2:1b');
      expect(router.selectModel({ taskType: 'code', messageLength: 50 })).toBe('qwen2.5-coder:7b');
      expect(router.selectModel({ taskType: 'embed' })).toBe('nomic-embed-text');
      expect(router.selectModel({ taskType: 'general', messageLength: 10 })).toBe('deepseek-r1:8b');
    });

    it('prioritizes hasCode over short message heuristic', () => {
      // hasCode=true should override short-message fast-model selection
      expect(router.selectModel({ messageLength: 50, hasCode: true })).toBe('qwen2.5-coder:7b');
    });
  });

  describe('selectModelWithFallback', () => {
    it('returns primary model when available', async () => {
      const provider = { checkModel: vi.fn().mockResolvedValue(true) };
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const router = new ModelRouter({ defaultModel: 'primary-model' });
      const model = await router.selectModelWithFallback();

      expect(model).toBe('primary-model');
      expect(provider.checkModel).toHaveBeenCalledWith('primary-model');
    });

    it('falls back to first available model in chain', async () => {
      let callCount = 0;
      const provider = {
        checkModel: vi.fn().mockImplementation(async (name: string) => {
          callCount++;
          // Primary fails, fallback-1 fails, fallback-2 succeeds
          if (name === 'primary') return false;
          if (name === 'fallback-1') return false;
          return true;
        }),
      };
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const router = new ModelRouter({
        defaultModel: 'primary',
        fallbackChain: ['fallback-1', 'fallback-2'],
      });

      const model = await router.selectModelWithFallback();
      expect(model).toBe('fallback-2');
    });

    it('returns primary model if all fallbacks fail', async () => {
      const provider = { checkModel: vi.fn().mockResolvedValue(false) };
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const router = new ModelRouter({
        defaultModel: 'primary',
        fallbackChain: ['fallback-1'],
      });

      const model = await router.selectModelWithFallback();
      // Should still return primary even though unavailable
      expect(model).toBe('primary');
    });

    it('returns primary model when checkModel throws', async () => {
      const provider = { checkModel: vi.fn().mockRejectedValue(new Error('Connection failed')) };
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const router = new ModelRouter({ defaultModel: 'primary' });
      const model = await router.selectModelWithFallback();

      expect(model).toBe('primary');
    });
  });

  describe('updateConfig', () => {
    it('updates model config at runtime', () => {
      const router = new ModelRouter({ defaultModel: 'old-model' });
      router.updateConfig({ defaultModel: 'new-model' });

      expect(router.selectModel()).toBe('new-model');
    });

    it('preserves unmodified config values', () => {
      const router = new ModelRouter({
        defaultModel: 'default',
        codeModel: 'code-model',
      });
      router.updateConfig({ defaultModel: 'new-default' });

      expect(router.selectModel({ hasCode: true })).toBe('code-model');
    });
  });

  describe('toProviderTools', () => {
    it('converts ToolDefinition array to provider tool format', () => {
      const router = new ModelRouter();
      const tools = [
        {
          name: 'bash',
          description: 'Run bash commands',
          input_schema: { type: 'object', properties: { command: { type: 'string' } } },
        },
      ];

      const providerTools = router.toProviderTools(tools);

      expect(providerTools).toHaveLength(1);
      expect(providerTools[0]).toEqual({
        type: 'function',
        function: {
          name: 'bash',
          description: 'Run bash commands',
          parameters: tools[0].input_schema,
        },
      });
    });
  });
});
