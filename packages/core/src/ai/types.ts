import type { TimeEstimate } from '../types';

export type AIProviderId = 'gemini' | 'openai';

export type AIReasoningEffort = 'low' | 'medium' | 'high';

export interface ClarifyOption {
    label: string;
    action: string;
}

export interface ClarifySuggestion {
    title: string;
    timeEstimate?: TimeEstimate;
    context?: string;
    isProject?: boolean;
}

export interface ClarifyResponse {
    question: string;
    options: ClarifyOption[];
    suggestedAction?: ClarifySuggestion;
}

export interface BreakdownResponse {
    steps: string[];
}

export interface ClarifyInput {
    title: string;
    contexts?: string[];
}

export interface BreakdownInput {
    title: string;
    description?: string;
}

export interface AIProviderConfig {
    provider: AIProviderId;
    apiKey: string;
    model: string;
    endpoint?: string;
    reasoningEffort?: AIReasoningEffort;
}

export interface AIProvider {
    clarifyTask: (input: ClarifyInput) => Promise<ClarifyResponse>;
    breakDownTask: (input: BreakdownInput) => Promise<BreakdownResponse>;
}
