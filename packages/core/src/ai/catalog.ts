import type { AIProviderConfig, AIProviderId, AIReasoningEffort } from './types';

// GPT-5.4/5.5 family (current as of 2026-07). mini is the cost-efficient default
// for well-defined task work, nano the fast/high-frequency tier (copilot metadata),
// and 5.5 the smart tier for harder planning. Older gpt-4o/gpt-5 ids still work if a
// user types them into the model field — they are just no longer suggested.
export const OPENAI_DEFAULT_MODEL = 'gpt-5.4-mini';
export const OPENAI_FAST_MODEL = 'gpt-5.4-nano';
export const OPENAI_SMART_MODEL = 'gpt-5.5';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5';
export const OPENAI_COPILOT_DEFAULT_MODEL = OPENAI_FAST_MODEL;
export const GEMINI_COPILOT_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const ANTHROPIC_COPILOT_DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_GEMINI_THINKING_BUDGET = 0;
export const DEFAULT_ANTHROPIC_THINKING_BUDGET = 0;

export const OPENAI_MODEL_OPTIONS = [
    OPENAI_SMART_MODEL,
    'gpt-5.4',
    OPENAI_DEFAULT_MODEL,
    OPENAI_FAST_MODEL,
];
export const GEMINI_MODEL_OPTIONS = [
    GEMINI_DEFAULT_MODEL,
    'gemini-3.5-flash',
    GEMINI_COPILOT_DEFAULT_MODEL,
];
export const ANTHROPIC_MODEL_OPTIONS = [
    ANTHROPIC_DEFAULT_MODEL,
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-opus-4-8',
    'claude-opus-4-7',
];


// Providers retire model ids on their own schedules (Google pulled
// gemini-2.5-flash on 2026-07-09, three months before its announced date;
// Anthropic's claude-3-5-haiku/3-7-sonnet 404 since 2026-02-19). Saved
// settings and stale defaults must keep working, so requests remap retired
// ids to the closest current tier at call time. User-typed ids that are not
// in these maps pass through untouched.
const RETIRED_GEMINI_MODELS: Record<string, string> = {
    'gemini-1.5-flash': GEMINI_DEFAULT_MODEL,
    'gemini-1.5-flash-8b': GEMINI_COPILOT_DEFAULT_MODEL,
    'gemini-1.5-pro': GEMINI_DEFAULT_MODEL,
    'gemini-2.0-flash': GEMINI_DEFAULT_MODEL,
    'gemini-2.0-flash-lite': GEMINI_COPILOT_DEFAULT_MODEL,
    'gemini-2.5-flash': GEMINI_DEFAULT_MODEL,
    'gemini-2.5-flash-lite': GEMINI_COPILOT_DEFAULT_MODEL,
    'gemini-3-flash-preview': GEMINI_DEFAULT_MODEL,
};

export function resolveGeminiModel(model?: string | null): string {
    const id = String(model ?? '').trim();
    if (!id) return GEMINI_DEFAULT_MODEL;
    return RETIRED_GEMINI_MODELS[id.toLowerCase()] ?? id;
}

const RETIRED_ANTHROPIC_MODELS: Record<string, string> = {
    'claude-2.0': ANTHROPIC_DEFAULT_MODEL,
    'claude-2.1': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-sonnet-20240229': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-5-sonnet-20240620': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-5-sonnet-20241022': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-7-sonnet': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-7-sonnet-20250219': ANTHROPIC_DEFAULT_MODEL,
    'claude-3-haiku-20240307': ANTHROPIC_COPILOT_DEFAULT_MODEL,
    'claude-3-5-haiku': ANTHROPIC_COPILOT_DEFAULT_MODEL,
    'claude-3-5-haiku-20241022': ANTHROPIC_COPILOT_DEFAULT_MODEL,
    'claude-3-opus-20240229': 'claude-opus-4-8',
    'claude-opus-4': 'claude-opus-4-8',
    'claude-opus-4-0': 'claude-opus-4-8',
    'claude-opus-4-20250514': 'claude-opus-4-8',
    'claude-opus-4-1': 'claude-opus-4-8',
    'claude-opus-4-1-20250805': 'claude-opus-4-8',
    'claude-sonnet-4': ANTHROPIC_DEFAULT_MODEL,
    'claude-sonnet-4-0': ANTHROPIC_DEFAULT_MODEL,
    'claude-sonnet-4-20250514': ANTHROPIC_DEFAULT_MODEL,
};

export function resolveAnthropicModel(model?: string | null): string {
    const id = String(model ?? '').trim();
    if (!id) return ANTHROPIC_DEFAULT_MODEL;
    return RETIRED_ANTHROPIC_MODELS[id.toLowerCase()] ?? id;
}

export const DEFAULT_REASONING_EFFORT: AIReasoningEffort = 'low';
// The copilot runs on every debounced keystroke, so keep reasoning minimal to
// protect type-ahead latency on GPT-5 reasoning models (the fast/copilot default).
export const COPILOT_REASONING_EFFORT: AIReasoningEffort = 'minimal';

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
