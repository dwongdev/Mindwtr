import { describe, expect, it } from 'vitest';
import { parseJson } from './utils';

describe('parseJson', () => {
    it('extracts valid JSON from surrounding model text', () => {
        expect(parseJson('Sure:\n{"ok":true}\nDone.')).toEqual({ ok: true });
    });

    it('wraps parse failures from extracted JSON candidates', () => {
        expect(() => parseJson('Sure:\n{"ok":]}\nDone.')).toThrow(/AI JSON parse error:/);
    });
});
