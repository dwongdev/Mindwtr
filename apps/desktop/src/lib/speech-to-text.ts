import type {
    SpeechToTaskCaptureConfig,
    SpeechToTaskResult,
} from '@mindwtr/core';
import {
    buildSpeechToTaskPrompt,
    normalizeSpeechLanguage,
    parseSpeechToTaskResult,
    resolveGeminiModel,
    runSpeechToTaskCapture,
} from '@mindwtr/core';

import { isTauriRuntime } from './runtime';
import { logWarn } from './app-log';

export type SpeechToTextResult = SpeechToTaskResult;

export type SpeechToTextConfig = SpeechToTaskCaptureConfig & {
    apiKey?: string;
    model: string;
    parseModel?: string;
    modelPath?: string;
};

export type AudioInput = {
    bytes: Uint8Array;
    mimeType: string;
    name?: string;
    path?: string;
};

type FetchOptions = {
    timeoutMs?: number;
    signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const bytesToBase64 = (bytes: Uint8Array) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i] ?? 0;
        const b1 = bytes[i + 1];
        const b2 = bytes[i + 2];

        const hasB1 = typeof b1 === 'number';
        const hasB2 = typeof b2 === 'number';

        const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);

        out += alphabet[(triplet >> 18) & 0x3f];
        out += alphabet[(triplet >> 12) & 0x3f];
        out += hasB1 ? alphabet[(triplet >> 6) & 0x3f] : '=';
        out += hasB2 ? alphabet[triplet & 0x3f] : '=';
    }
    return out;
};

const normalizeLocalAsrTranscript = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const parseCandidate = (candidate: string) => {
        try {
            const parsed = JSON.parse(candidate) as unknown;
            if (!parsed || typeof parsed !== 'object') return null;
            const text = (parsed as { text?: unknown; transcript?: unknown }).text
                ?? (parsed as { transcript?: unknown }).transcript;
            return typeof text === 'string' ? text.trim() : null;
        } catch {
            return null;
        }
    };

    const direct = parseCandidate(trimmed);
    if (direct !== null) return direct;

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
        const embedded = parseCandidate(trimmed.slice(objectStart, objectEnd + 1));
        if (embedded !== null) return embedded;
    }

    return trimmed;
};

const fetchJson = async (url: string, init: RequestInit, options?: FetchOptions) => {
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (options?.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || `Request failed (${response.status})`);
        }
        const data = await response.json();
        return data as Promise<unknown>;
    } finally {
        clearTimeout(handle);
    }
};

const transcribeOpenAI = async (audio: AudioInput, config: SpeechToTextConfig) => {
    if (!config.apiKey) {
        throw new Error('OpenAI API key missing');
    }
    const bytes = new Uint8Array(audio.bytes);
    const blob = new Blob([bytes], { type: audio.mimeType });
    const fileName = audio.name || 'audio.wav';
    const file = new File([blob], fileName, { type: audio.mimeType });
    const form = new FormData();
    form.append('file', file);
    form.append('model', config.model);
    const language = normalizeSpeechLanguage(config.language);
    if (language !== 'auto') {
        form.append('language', language);
    }
    form.append('response_format', 'json');

    const result = await fetchJson(
        OPENAI_TRANSCRIBE_URL,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: form,
        },
        { timeoutMs: DEFAULT_TIMEOUT_MS }
    );
    const text = typeof (result as { text?: unknown }).text === 'string'
        ? (result as { text: string }).text
        : '';
    return text.trim();
};

const resolveOpenAIParseModel = (value?: string) => {
    if (!value) return 'gpt-4o-mini';
    const lower = value.toLowerCase();
    if (lower.startsWith('gpt-5')) return 'gpt-4o-mini';
    return value;
};

const extractResponsesText = (result: unknown) => {
    const direct = typeof (result as { output_text?: string }).output_text === 'string'
        ? (result as { output_text: string }).output_text
        : undefined;
    if (direct && direct.trim()) return direct;
    const output = (result as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output;
    if (!Array.isArray(output)) return undefined;
    for (const item of output) {
        if (!item || item.type !== 'message') continue;
        const content = item.content;
        if (!Array.isArray(content)) continue;
        const textPart = content.find((part) => part?.type === 'output_text' || part?.type === 'text');
        if (textPart?.text && textPart.text.trim()) return textPart.text;
    }
    return undefined;
};

const parseWithOpenAIResponses = async (transcript: string, config: SpeechToTextConfig, overrideModel?: string) => {
    if (!config.apiKey) {
        throw new Error('OpenAI API key missing');
    }
    const now = config.now ?? new Date();
    const prompt = buildSpeechToTaskPrompt({
        fieldStrategy: config.fieldStrategy ?? 'smart',
        language: normalizeSpeechLanguage(config.language),
        now,
        timeZone: config.timeZone,
    });
    const parserModel = resolveOpenAIParseModel(overrideModel ?? config.parseModel);
    const result = await fetchJson(
        OPENAI_RESPONSES_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: parserModel,
                temperature: 0.2,
                input: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: transcript },
                ],
                text: { format: { type: 'json_object' } },
            }),
        },
        { timeoutMs: DEFAULT_TIMEOUT_MS }
    );
    const content = extractResponsesText(result);
    if (!content) {
        throw new Error('OpenAI returned no content.');
    }
    return parseSpeechToTaskResult(content);
};

const parseWithOpenAIChat = async (transcript: string, config: SpeechToTextConfig, overrideModel?: string) => {
    if (!config.apiKey) {
        throw new Error('OpenAI API key missing');
    }
    const now = config.now ?? new Date();
    const prompt = buildSpeechToTaskPrompt({
        fieldStrategy: config.fieldStrategy ?? 'smart',
        language: normalizeSpeechLanguage(config.language),
        now,
        timeZone: config.timeZone,
    });
    const parserModel = resolveOpenAIParseModel(overrideModel ?? config.parseModel);
    const result = await fetchJson(
        OPENAI_CHAT_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: parserModel,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: transcript },
                ],
            }),
        },
        { timeoutMs: DEFAULT_TIMEOUT_MS }
    );
    const content = (result as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenAI returned no content.');
    }
    return parseSpeechToTaskResult(content);
};

const parseWithOpenAI = async (transcript: string, config: SpeechToTextConfig, overrideModel?: string) => {
    try {
        return await parseWithOpenAIResponses(transcript, config, overrideModel);
    } catch (error) {
        void logWarn('OpenAI responses parse failed, retrying with chat completions', {
            scope: 'speech',
            extra: { error: error instanceof Error ? error.message : String(error) },
        });
        return parseWithOpenAIChat(transcript, config, overrideModel);
    }
};

const requestGemini = async (audio: AudioInput, config: SpeechToTextConfig, prompt: string) => {
    if (!config.apiKey) {
        throw new Error('Gemini API key missing');
    }
    const base64Audio = bytesToBase64(audio.bytes);
    const geminiModel = resolveGeminiModel(config.model);
    const url = `${GEMINI_BASE_URL}/${geminiModel}:generateContent`;
    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: audio.mimeType,
                            data: base64Audio,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 20,
            candidateCount: 1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
        },
    };
    const result = await fetchJson(
        url,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey,
            },
            body: JSON.stringify(body),
        },
        { timeoutMs: DEFAULT_TIMEOUT_MS }
    );
    const text = (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        .candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Gemini returned no content.');
    }
    return parseSpeechToTaskResult(text);
};

const transcribeWhisper = async (audio: AudioInput, config: SpeechToTextConfig) => {
    if (!config.modelPath) {
        throw new Error('Whisper model path missing');
    }
    if (!audio.path) {
        throw new Error('Whisper requires a local audio path');
    }
    if (!isTauriRuntime()) {
        throw new Error('Whisper is only available in the desktop app');
    }
    const language = normalizeSpeechLanguage(config.language);
    const { invoke } = await import('@tauri-apps/api/core');
    const text = await invoke<string>('transcribe_whisper', {
        modelPath: config.modelPath,
        audioPath: audio.path,
        language: language === 'auto' ? null : language,
    });
    return normalizeLocalAsrTranscript(text);
};


const transcribeParakeet = async (audio: AudioInput, config: SpeechToTextConfig) => {
    if (!config.modelPath) {
        throw new Error('Parakeet model directory missing');
    }
    if (!audio.path) {
        throw new Error('Parakeet requires a local audio path');
    }
    if (!isTauriRuntime()) {
        throw new Error('Parakeet is only available in the desktop app');
    }
    const language = normalizeSpeechLanguage(config.language);
    const { invoke } = await import('@tauri-apps/api/core');
    const text = await invoke<string>('transcribe_parakeet', {
        modelPath: config.modelPath,
        audioPath: audio.path,
        language: language === 'auto' ? null : language,
    });
    return normalizeLocalAsrTranscript(text);
};

export async function processAudioCapture(
    audio: AudioInput,
    config: SpeechToTextConfig
): Promise<SpeechToTextResult> {
    return runSpeechToTaskCapture(config, {
        transcribe: () => {
            if (config.provider === 'whisper') {
                return transcribeWhisper(audio, config);
            }
            if (config.provider === 'parakeet') {
                return transcribeParakeet(audio, config);
            }
            return transcribeOpenAI(audio, config);
        },
        direct: (prompt) => requestGemini(audio, config, prompt),
        parse: (transcript, overrideModel) =>
            parseWithOpenAI(transcript, config, overrideModel),
        onParseFallback: (error) => {
            void logWarn('OpenAI smart parse failed, falling back to transcript', {
                scope: 'speech',
                extra: { error: error.message },
            });
        },
    });
}
