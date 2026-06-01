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
});
