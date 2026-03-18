import {
  AI_CONNECT_MODEL_CATALOG,
  getAiConnectModelCatalog,
} from './model-catalog.js';

describe('getAiConnectModelCatalog', () => {
  it.each(['openai', 'anthropic', 'google'] as const)(
    'returns the published catalog for %s',
    (provider) => {
      const catalog = getAiConnectModelCatalog(provider);

      expect(catalog).toBe(AI_CONNECT_MODEL_CATALOG[provider]);
      expect(catalog.length).toBeGreaterThan(0);
      expect(new Set(catalog.map((option) => option.id)).size).toBe(
        catalog.length
      );
      expect(catalog.every((option) => option.label.length > 0)).toBe(true);
    }
  );
});
