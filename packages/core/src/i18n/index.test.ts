import { describe, expect, it } from 'vitest';
import { formatI18nTemplate } from './index';

describe('formatI18nTemplate', () => {
    it('replaces repeated named placeholders wherever translators place them', () => {
        expect(formatI18nTemplate('{{name}} löschen? {{ name }}', { name: 'Inbox' })).toBe('Inbox löschen? Inbox');
    });

    it('leaves unknown placeholders intact', () => {
        expect(formatI18nTemplate('Delete {{name}} from {{list}}?', { name: 'Inbox' })).toBe('Delete Inbox from {{list}}?');
    });
});
