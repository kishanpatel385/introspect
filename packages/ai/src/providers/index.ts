import type { AiProvider, AiProviderConfig } from '@introspect/core-types';
import { createGroqProvider } from './groq';
import { createAnthropicProvider } from './anthropic';
import { createOpenAiProvider } from './openai';

export function createProvider(config: AiProviderConfig): AiProvider {
  switch (config.name) {
    case 'groq':
      return createGroqProvider(config);
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'openai':
      return createOpenAiProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${config.name}`);
  }
}
