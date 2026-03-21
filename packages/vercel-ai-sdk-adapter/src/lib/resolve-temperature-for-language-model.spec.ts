import type { LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';
import { resolveTemperatureForLanguageModel } from './resolve-temperature-for-language-model.js';

function mockModel(provider: string, modelId: string): LanguageModel {
  return { provider, modelId } as LanguageModel;
}

describe('resolveTemperatureForLanguageModel', () => {
  it('drops temperature for OpenAI gpt-5.x models', () => {
    expect(
      resolveTemperatureForLanguageModel(
        mockModel('openai.responses', 'gpt-5.4'),
        0
      )
    ).toBeUndefined();
    expect(
      resolveTemperatureForLanguageModel(
        mockModel('openai.responses', 'gpt-5-mini'),
        0.5
      )
    ).toBeUndefined();
  });

  it('drops temperature for OpenAI o-series reasoning models', () => {
    expect(
      resolveTemperatureForLanguageModel(mockModel('openai.chat', 'o3-mini'), 1)
    ).toBeUndefined();
  });

  it('keeps temperature for non-reasoning OpenAI models', () => {
    expect(
      resolveTemperatureForLanguageModel(
        mockModel('openai.chat', 'gpt-4o'),
        0.7
      )
    ).toBe(0.7);
  });

  it('keeps temperature for non-OpenAI providers', () => {
    expect(
      resolveTemperatureForLanguageModel(
        mockModel('anthropic.messages', 'claude-3-5-sonnet-20241022'),
        0.2
      )
    ).toBe(0.2);
  });

  it('passes through undefined', () => {
    expect(
      resolveTemperatureForLanguageModel(
        mockModel('openai.responses', 'gpt-5.4'),
        undefined
      )
    ).toBeUndefined();
  });

  it('drops temperature for string shorthand OpenAI reasoning models', () => {
    expect(
      resolveTemperatureForLanguageModel('openai/gpt-5.4' as LanguageModel, 0)
    ).toBeUndefined();
  });
});
