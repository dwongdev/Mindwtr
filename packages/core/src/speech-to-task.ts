import type { AudioCaptureMode, AudioFieldStrategy } from './ai/types';

export type SpeechToTaskProvider = 'openai' | 'gemini' | 'whisper' | 'parakeet';

export type SpeechToTaskResult = {
    transcript: string;
    title?: string | null;
    description?: string | null;
    dueDate?: string | null;
    startTime?: string | null;
    projectTitle?: string | null;
    tags?: string[] | null;
    contexts?: string[] | null;
    language?: string | null;
};

export type SpeechToTaskCaptureConfig = {
    provider: SpeechToTaskProvider;
    mode?: AudioCaptureMode;
    fieldStrategy?: AudioFieldStrategy;
    language?: string;
    now?: Date;
    timeZone?: string;
    retryModel?: string;
};

export type SpeechToTaskCapturePorts = {
    transcribe: () => Promise<string>;
    direct?: (prompt: string) => Promise<SpeechToTaskResult>;
    parse?: (transcript: string, overrideModel?: string) => Promise<SpeechToTaskResult>;
    onParseFallback?: (error: Error) => void;
};

export function normalizeSpeechLanguage(value?: string): string {
    if (!value) return 'auto';
    const trimmed = value.trim();
    if (!trimmed) return 'auto';
    const normalized = trimmed.toLowerCase();
    if (normalized === 'auto') return 'auto';
    const base = normalized.split(/[-_]/)[0];
    const aliases: Record<string, string> = {
        english: 'en',
        en: 'en',
        spanish: 'es',
        espanol: 'es',
        es: 'es',
    };
    return aliases[base] ?? base;
}

export function parseSpeechToTaskResult(text: unknown): SpeechToTaskResult {
    if (typeof text !== 'string') {
        throw new Error('Speech parser returned non-text response.');
    }
    const cleaned = text.replace(/```json|```/gi, '').trim();
    if (!cleaned) {
        throw new Error('Speech parser returned empty response.');
    }
    return JSON.parse(cleaned) as SpeechToTaskResult;
}

export function buildSpeechToTaskPrompt({
    fieldStrategy = 'smart',
    language = 'auto',
    now = new Date(),
    timeZone,
}: {
    fieldStrategy?: AudioFieldStrategy;
    language?: string;
    now?: Date;
    timeZone?: string;
}): string {
    return `
You are a personal assistant converting a voice note into a GTD task.

Audio language: ${language === 'auto' ? 'Detect automatically' : language}
Current date/time: ${now.toISOString()}
Time zone: ${timeZone || 'local'}

Return ONLY valid JSON with these keys:
{
  "transcript": "string",
  "title": "string or null",
  "description": "string or null",
  "dueDate": "ISO 8601 string or null",
  "startTime": "ISO 8601 string or null",
  "projectTitle": "string or null",
  "tags": ["#tag"] or [],
  "contexts": ["@context"] or [],
  "language": "detected language name or code"
}

Field strategy: ${fieldStrategy}
- smart: If transcript is short (<= 15 words), use it verbatim as title and leave description empty. If longer, create a concise 3-7 word title and put the full transcript in description.
- title_only: Put the full transcript in title and leave description empty.
- description_only: Keep title empty and put the full transcript in description.

Extract any dates/times and convert to ISO 8601 using the current date/time for relative phrases (e.g., "tomorrow 5pm").
If a field is unknown, return null or an empty array.
  `.trim();
}

export function buildSpeechTranscriptionPrompt(language = 'auto'): string {
    return `
Transcribe the audio into plain text.
Audio language: ${language === 'auto' ? 'Detect automatically' : language}

Return ONLY valid JSON with these keys:
{
  "transcript": "string",
  "language": "detected language name or code"
}
  `.trim();
}

export async function runSpeechToTaskCapture(
    config: SpeechToTaskCaptureConfig,
    ports: SpeechToTaskCapturePorts,
): Promise<SpeechToTaskResult> {
    const mode = config.mode ?? 'smart_parse';
    const language = normalizeSpeechLanguage(config.language);

    if (config.provider === 'whisper' || config.provider === 'parakeet') {
        return { transcript: await ports.transcribe() };
    }

    if (config.provider === 'gemini') {
        if (!ports.direct) {
            throw new Error('Direct speech adapter missing');
        }
        const prompt = mode === 'transcribe_only'
            ? buildSpeechTranscriptionPrompt(language)
            : buildSpeechToTaskPrompt({
                fieldStrategy: config.fieldStrategy,
                language,
                now: config.now,
                timeZone: config.timeZone,
            });
        return ports.direct(prompt);
    }

    const transcript = await ports.transcribe();
    if (mode === 'transcribe_only') {
        return { transcript };
    }
    if (!ports.parse) {
        throw new Error('Speech parser adapter missing');
    }

    try {
        const parsed = await ports.parse(transcript, undefined);
        return { ...parsed, transcript: parsed.transcript || transcript };
    } catch {
        try {
            const parsed = await ports.parse(
                transcript,
                config.retryModel ?? 'gpt-4o-mini',
            );
            return { ...parsed, transcript: parsed.transcript || transcript };
        } catch (error) {
            ports.onParseFallback?.(
                error instanceof Error ? error : new Error(String(error)),
            );
            return { transcript };
        }
    }
}
