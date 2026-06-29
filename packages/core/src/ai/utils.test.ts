import { describe, expect, it } from 'vitest';
import { parseJson } from './utils';

describe('parseJson', () => {
    it('extracts valid JSON from surrounding model text', () => {
        expect(parseJson('Sure:\n{"ok":true}\nDone.')).toEqual({ ok: true });
    });

    it('wraps parse failures from extracted JSON candidates', () => {
        expect(() => parseJson('Sure:\n{"ok":]}\nDone.')).toThrow(/AI JSON parse error:/);
    });

    type Reviewish = { suggestions: Array<{ id: string; action: string; reason: string }> };
    const isReviewish = (value: unknown): value is Reviewish =>
        typeof value === 'object'
        && value !== null
        && Array.isArray((value as Reviewish).suggestions)
        && (value as Reviewish).suggestions.every(
            (s) => s && typeof s.id === 'string' && typeof s.action === 'string' && typeof s.reason === 'string'
        );

    it('salvages complete array elements when the response is truncated mid-array', () => {
        const truncated = '{"suggestions":[{"id":"a","action":"keep","reason":"still valid"},{"id":"b","action":"arch';
        expect(parseJson<Reviewish>(truncated, isReviewish)).toEqual({
            suggestions: [{ id: 'a', action: 'keep', reason: 'still valid' }],
        });
    });

    it('drops a trailing element that is incomplete against the validator', () => {
        // third object has id+action but its reason string was cut off
        const truncated = '{"suggestions":[{"id":"a","action":"keep","reason":"ok"},{"id":"b","action":"archive","reason":"done"},{"id":"c","action":"someday","reason":"la';
        expect(parseJson<Reviewish>(truncated, isReviewish)).toEqual({
            suggestions: [
                { id: 'a', action: 'keep', reason: 'ok' },
                { id: 'b', action: 'archive', reason: 'done' },
            ],
        });
    });

    it('recovers a truncated string array', () => {
        expect(parseJson('{"steps":["step one","step two","step th')).toEqual({
            steps: ['step one', 'step two'],
        });
    });

    it('still parses a complete response without altering it', () => {
        const full = '{"suggestions":[{"id":"a","action":"keep","reason":"ok"}]}';
        expect(parseJson<Reviewish>(full, isReviewish)).toEqual({
            suggestions: [{ id: 'a', action: 'keep', reason: 'ok' }],
        });
    });

    it('throws when no validator-complete element can be salvaged', () => {
        // The first suggestion is cut off before its required fields, so nothing validates.
        expect(() => parseJson<Reviewish>('{"suggestions":[{"id":"a","act', isReviewish)).toThrow(/AI JSON parse error:/);
    });
});
