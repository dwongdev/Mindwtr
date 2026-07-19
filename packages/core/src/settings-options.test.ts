import { describe, it, expect } from 'vitest';
import { SETTINGS_DENSITY_VALUES, SETTINGS_DENSITY_VALUE_SET } from './settings-options';

describe('settings density options', () => {
    it('exposes comfortable, compact, and condensed as valid density values', () => {
        expect(SETTINGS_DENSITY_VALUES).toEqual(
            expect.arrayContaining(['comfortable', 'compact', 'condensed']),
        );
    });

    it('accepts condensed in the density value set used by the merge sanitizer', () => {
        expect(SETTINGS_DENSITY_VALUE_SET.has('condensed')).toBe(true);
    });
});
