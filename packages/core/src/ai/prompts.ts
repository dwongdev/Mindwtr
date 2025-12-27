import type { BreakdownInput, ClarifyInput } from './types';

const SYSTEM_PROMPT = [
    'You are a strict GTD coach.',
    'You do not decide for the user; you only clarify and propose options.',
    'Always output valid JSON and nothing else.',
].join(' ');

export function buildClarifyPrompt(input: ClarifyInput): { system: string; user: string } {
    const contexts = (input.contexts || []).filter(Boolean);
    const user = [
        'Task:',
        JSON.stringify({ title: input.title, contexts }),
        'Goal: turn this into a concrete next action.',
        'Rules:',
        '1) If vague, ask a single clarifying question.',
        '2) Suggest 2-4 concrete options.',
        '3) Prefer verbs at the start.',
        'Output JSON with:',
        '{ "question": string, "options": [{ "label": string, "action": string }], "suggestedAction"?: { "title": string, "timeEstimate"?: string, "context"?: string, "isProject"?: boolean } }',
    ].join('\n');

    return { system: SYSTEM_PROMPT, user };
}

export function buildBreakdownPrompt(input: BreakdownInput): { system: string; user: string } {
    const user = [
        'Task:',
        JSON.stringify({ title: input.title, description: input.description || '' }),
        'Goal: break this into 3-8 actionable next steps.',
        'Output JSON with:',
        '{ "steps": [string] }',
    ].join('\n');

    return { system: SYSTEM_PROMPT, user };
}
