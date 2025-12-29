import type { AIProvider, AIProviderConfig, BreakdownInput, BreakdownResponse, ClarifyInput, ClarifyResponse, CopilotInput, CopilotResponse, ReviewAnalysisInput, ReviewAnalysisResponse } from '../types';
import { buildBreakdownPrompt, buildClarifyPrompt, buildCopilotPrompt, buildReviewAnalysisPrompt } from '../prompts';
import { normalizeTags, normalizeTimeEstimate, parseJson } from '../utils';
import { isBreakdownResponse, isClarifyResponse, isCopilotResponse, isReviewAnalysisResponse } from '../validators';

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const abortController = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = abortController ? setTimeout(() => abortController.abort(), timeoutMs) : null;
    try {
        return await fetch(url, { ...init, signal: abortController?.signal ?? init.signal });
    } catch (error) {
        if (abortController?.signal.aborted) {
            throw new Error('OpenAI request timed out');
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function requestOpenAI(config: AIProviderConfig, prompt: { system: string; user: string }) {
    if (!config.apiKey) {
        throw new Error('OpenAI API key is required.');
    }
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

    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            response = await fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`,
                    },
                    body: JSON.stringify(body),
                },
                config.timeoutMs ?? DEFAULT_TIMEOUT_MS
            );
        } catch (error) {
            if (attempt < MAX_RETRIES) {
                await sleep(400 * Math.pow(2, attempt));
                continue;
            }
            throw error;
        }

        if (!response.ok) {
            if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
                await sleep(400 * Math.pow(2, attempt));
                continue;
            }
            const text = await response.text();
            throw new Error(`OpenAI error: ${response.status} ${text}`);
        }
        break;
    }

    if (!response) {
        throw new Error('OpenAI request failed to start.');
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
            return parseJson<ClarifyResponse>(text, isClarifyResponse);
        },
        breakDownTask: async (input: BreakdownInput): Promise<BreakdownResponse> => {
            const prompt = buildBreakdownPrompt(input);
            const text = await requestOpenAI(config, prompt);
            return parseJson<BreakdownResponse>(text, isBreakdownResponse);
        },
        analyzeReview: async (input: ReviewAnalysisInput): Promise<ReviewAnalysisResponse> => {
            const prompt = buildReviewAnalysisPrompt(input.items);
            const text = await requestOpenAI(config, prompt);
            return parseJson<ReviewAnalysisResponse>(text, isReviewAnalysisResponse);
        },
        predictMetadata: async (input: CopilotInput): Promise<CopilotResponse> => {
            const prompt = buildCopilotPrompt(input);
            const text = await requestOpenAI(config, prompt);
            const parsed = parseJson<CopilotResponse>(text, isCopilotResponse);
            const context = typeof parsed.context === 'string' ? parsed.context : undefined;
            const timeEstimate = typeof parsed.timeEstimate === 'string' ? parsed.timeEstimate : undefined;
            const tags = Array.isArray(parsed.tags) ? normalizeTags(parsed.tags) : [];
            return {
                context,
                timeEstimate: normalizeTimeEstimate(timeEstimate) as CopilotResponse['timeEstimate'],
                tags,
            };
        },
    };
}
