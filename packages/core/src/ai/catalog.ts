import type { AIProviderConfig, AIProviderId, AIReasoningEffort } from './types';

export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

export const OPENAI_MODEL_OPTIONS = [OPENAI_DEFAULT_MODEL];
export const GEMINI_MODEL_OPTIONS = ['gemini-2.5-flash', 'gemini-3-flash-preview'];

export const DEFAULT_REASONING_EFFORT: AIReasoningEffort = 'low';

export function getDefaultAIConfig(provider: AIProviderId): AIProviderConfig {
    return {
        provider,
        apiKey: '',
        model: provider === 'openai' ? OPENAI_DEFAULT_MODEL : GEMINI_DEFAULT_MODEL,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
    };
}

export function getModelOptions(provider: AIProviderId): string[] {
    return provider === 'openai' ? OPENAI_MODEL_OPTIONS : GEMINI_MODEL_OPTIONS;
}
