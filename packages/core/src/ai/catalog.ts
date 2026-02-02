import type { AIProviderConfig, AIProviderId, AIReasoningEffort } from './types';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5';
export const OPENAI_COPILOT_DEFAULT_MODEL = 'gpt-4o-mini';
export const GEMINI_COPILOT_DEFAULT_MODEL = 'gemini-2.0-flash-lite';
export const ANTHROPIC_COPILOT_DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_GEMINI_THINKING_BUDGET = 0;
export const DEFAULT_ANTHROPIC_THINKING_BUDGET = 0;

export const OPENAI_MODEL_OPTIONS = [
    'gpt-4o-mini',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-5-mini',
    'gpt-5-nano',
];
export const GEMINI_MODEL_OPTIONS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-3-flash-preview',
];
export const ANTHROPIC_MODEL_OPTIONS = [
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-opus-4-5',
    'claude-opus-4-1',
    'claude-sonnet-4',
    'claude-opus-4',
    'claude-3-7-sonnet',
    'claude-3-5-haiku',
];

export const DEFAULT_REASONING_EFFORT: AIReasoningEffort = 'low';

export function getDefaultAIConfig(provider: AIProviderId): AIProviderConfig {
    return {
        provider,
        apiKey: '',
        model:
            provider === 'openai'
                ? OPENAI_DEFAULT_MODEL
                : provider === 'anthropic'
                    ? ANTHROPIC_DEFAULT_MODEL
                    : GEMINI_DEFAULT_MODEL,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
        ...(provider === 'gemini' ? { thinkingBudget: DEFAULT_GEMINI_THINKING_BUDGET } : {}),
        ...(provider === 'anthropic' ? { thinkingBudget: DEFAULT_ANTHROPIC_THINKING_BUDGET } : {}),
    };
}

export function getModelOptions(provider: AIProviderId): string[] {
    if (provider === 'openai') return OPENAI_MODEL_OPTIONS;
    if (provider === 'anthropic') return ANTHROPIC_MODEL_OPTIONS;
    return GEMINI_MODEL_OPTIONS;
}

export function getDefaultCopilotModel(provider: AIProviderId): string {
    if (provider === 'openai') return OPENAI_COPILOT_DEFAULT_MODEL;
    if (provider === 'anthropic') return ANTHROPIC_COPILOT_DEFAULT_MODEL;
    return GEMINI_COPILOT_DEFAULT_MODEL;
}

export function getCopilotModelOptions(provider: AIProviderId): string[] {
    return getModelOptions(provider);
}
