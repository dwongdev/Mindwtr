import type { AIProvider, AIProviderConfig } from './types';
import { createGeminiProvider } from './providers/gemini';
import { createOpenAIProvider } from './providers/openai';

export function createAIProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
        case 'gemini':
            return createGeminiProvider(config);
        case 'openai':
            return createOpenAIProvider(config);
        default:
            throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
}
