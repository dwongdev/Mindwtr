import { describe, expect, it } from 'vitest';
import { getContextColor } from './context-color';

describe('getContextColor', () => {
    it('returns a deterministic color for the same context', () => {
        expect(getContextColor('@work')).toBe(getContextColor('@work'));
    });

    it('treats context values case-insensitively', () => {
        expect(getContextColor('@Home')).toBe(getContextColor('  @home  '));
    });

    it('returns a hex color string', () => {
        expect(getContextColor('@errands')).toMatch(/^#[0-9a-f]{6}$/i);
    });
});
