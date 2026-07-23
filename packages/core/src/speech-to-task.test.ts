import { describe, expect, it, vi } from 'vitest';

import {
    runSpeechToTaskCapture,
    type SpeechToTaskResult,
} from './speech-to-task';

describe('runSpeechToTaskCapture', () => {
    it('uses the direct audio adapter with a transcription prompt in transcribe-only mode', async () => {
        const direct = vi.fn(async (): Promise<SpeechToTaskResult> => ({
            transcript: 'Call Marc tomorrow.',
            language: 'en',
        }));
        const transcribe = vi.fn();
        const parse = vi.fn();

        const result = await runSpeechToTaskCapture(
            {
                provider: 'gemini',
                mode: 'transcribe_only',
                language: 'English',
            },
            { direct, transcribe, parse },
        );

        expect(result).toEqual({
            transcript: 'Call Marc tomorrow.',
            language: 'en',
        });
        expect(direct).toHaveBeenCalledWith(expect.stringContaining('Audio language: en'));
        expect(transcribe).not.toHaveBeenCalled();
        expect(parse).not.toHaveBeenCalled();
    });

    it('returns local transcription without invoking remote parsing', async () => {
        const transcribe = vi.fn(async () => 'Call Marc tomorrow.');
        const parse = vi.fn();

        await expect(runSpeechToTaskCapture(
            { provider: 'whisper', mode: 'smart_parse' },
            { transcribe, parse },
        )).resolves.toEqual({ transcript: 'Call Marc tomorrow.' });
        expect(parse).not.toHaveBeenCalled();
    });

    it('retries smart parsing once and preserves the original transcript when parsing fails', async () => {
        const transcribe = vi.fn(async () => 'Call Marc tomorrow.');
        const parse = vi.fn()
            .mockRejectedValueOnce(new Error('primary failed'))
            .mockRejectedValueOnce(new Error('retry failed'));
        const onParseFallback = vi.fn();

        const result = await runSpeechToTaskCapture(
            { provider: 'openai', mode: 'smart_parse' },
            { transcribe, parse, onParseFallback },
        );

        expect(result).toEqual({ transcript: 'Call Marc tomorrow.' });
        expect(parse).toHaveBeenNthCalledWith(1, 'Call Marc tomorrow.', undefined);
        expect(parse).toHaveBeenNthCalledWith(2, 'Call Marc tomorrow.', 'gpt-4o-mini');
        expect(onParseFallback).toHaveBeenCalledWith(expect.objectContaining({
            message: 'retry failed',
        }));
    });

    it('fills an empty parsed transcript with the original transcription', async () => {
        const result = await runSpeechToTaskCapture(
            { provider: 'openai', mode: 'smart_parse' },
            {
                transcribe: async () => 'Call Marc tomorrow.',
                parse: async () => ({
                    transcript: '',
                    title: 'Call Marc',
                }),
            },
        );

        expect(result).toEqual({
            transcript: 'Call Marc tomorrow.',
            title: 'Call Marc',
        });
    });
});
