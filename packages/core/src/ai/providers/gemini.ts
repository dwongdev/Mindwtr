import type { AIProvider, AIProviderConfig, BreakdownInput, BreakdownResponse, ClarifyInput, ClarifyResponse } from '../types';
import { buildBreakdownPrompt, buildClarifyPrompt } from '../prompts';
import { parseJson } from '../utils';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function requestGemini(config: AIProviderConfig, prompt: { system: string; user: string }) {
    const endpoint = config.endpoint || GEMINI_BASE_URL;
    const url = `${endpoint}/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: `${prompt.system}\n\n${prompt.user}` },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini error: ${response.status} ${text}`);
    }

    const result = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Gemini returned no content.');
    }
    return text;
}

export function createGeminiProvider(config: AIProviderConfig): AIProvider {
    return {
        clarifyTask: async (input: ClarifyInput): Promise<ClarifyResponse> => {
            const prompt = buildClarifyPrompt(input);
            const text = await requestGemini(config, prompt);
            return parseJson<ClarifyResponse>(text);
        },
        breakDownTask: async (input: BreakdownInput): Promise<BreakdownResponse> => {
            const prompt = buildBreakdownPrompt(input);
            const text = await requestGemini(config, prompt);
            return parseJson<BreakdownResponse>(text);
        },
    };
}
