import type { AIProvider, AIProviderConfig, BreakdownInput, BreakdownResponse, ClarifyInput, ClarifyResponse } from '../types';
import { buildBreakdownPrompt, buildClarifyPrompt } from '../prompts';
import { parseJson } from '../utils';

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';

async function requestOpenAI(config: AIProviderConfig, prompt: { system: string; user: string }) {
    const url = config.endpoint || OPENAI_BASE_URL;
    const reasoning = config.model.startsWith('gpt-5') && config.reasoningEffort
        ? { effort: config.reasoningEffort }
        : undefined;

    const body = {
        model: config.model,
        messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        ...(reasoning ? { reasoning } : {}),
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${text}`);
    }

    const result = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    const text = result.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('OpenAI returned no content.');
    }
    return text;
}

export function createOpenAIProvider(config: AIProviderConfig): AIProvider {
    return {
        clarifyTask: async (input: ClarifyInput): Promise<ClarifyResponse> => {
            const prompt = buildClarifyPrompt(input);
            const text = await requestOpenAI(config, prompt);
            return parseJson<ClarifyResponse>(text);
        },
        breakDownTask: async (input: BreakdownInput): Promise<BreakdownResponse> => {
            const prompt = buildBreakdownPrompt(input);
            const text = await requestOpenAI(config, prompt);
            return parseJson<BreakdownResponse>(text);
        },
    };
}
