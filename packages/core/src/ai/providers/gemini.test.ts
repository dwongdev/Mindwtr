import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiProvider } from './gemini';

const originalFetch = globalThis.fetch;

const mockGeminiSuccess = (content: unknown) =>
    new Response(
        JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [{ text: JSON.stringify(content) }],
                    },
                },
            ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('gemini provider request behavior', () => {
    it('uses a larger output budget for structured JSON responses', async () => {
        const fetchMock = vi.fn(async () => mockGeminiSuccess({ steps: ['Pick a date'] }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const provider = createGeminiProvider({
            provider: 'gemini',
            apiKey: 'test-key',
            model: 'gemini-2.5-flash',
        });

        const result = await provider.breakDownTask({ title: 'Plan trip' });
        expect(result.steps).toEqual(['Pick a date']);

        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const body = JSON.parse(String(requestInit?.body ?? '{}')) as {
            generationConfig?: { maxOutputTokens?: number };
        };
        expect(body.generationConfig?.maxOutputTokens).toBe(4096);
    });

    const readThinkingConfig = (fetchMock: ReturnType<typeof vi.fn>) => {
        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const body = JSON.parse(String(requestInit?.body ?? '{}')) as {
            generationConfig?: { thinkingConfig?: { thinkingBudget?: number } };
        };
        return body.generationConfig?.thinkingConfig;
    };

    it('disables thinking on thinking-capable models when no budget is set so the answer is not truncated', async () => {
        const fetchMock = vi.fn(async () => mockGeminiSuccess({ steps: ['Pick a date'] }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const provider = createGeminiProvider({ provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash' });
        await provider.breakDownTask({ title: 'Plan trip' });

        expect(readThinkingConfig(fetchMock)).toEqual({ thinkingBudget: 0 });
    });

    it('honors an explicit thinking budget', async () => {
        const fetchMock = vi.fn(async () => mockGeminiSuccess({ steps: ['Pick a date'] }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const provider = createGeminiProvider({ provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash', thinkingBudget: 512 });
        await provider.breakDownTask({ title: 'Plan trip' });

        expect(readThinkingConfig(fetchMock)).toEqual({ thinkingBudget: 512 });
    });

    it('omits thinkingConfig for models that do not support thinking', async () => {
        const fetchMock = vi.fn(async () => mockGeminiSuccess({ steps: ['Pick a date'] }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const provider = createGeminiProvider({ provider: 'gemini', apiKey: 'k', model: 'gemini-1.5-flash' });
        await provider.breakDownTask({ title: 'Plan trip' });

        expect(readThinkingConfig(fetchMock)).toBeUndefined();
    });
});
