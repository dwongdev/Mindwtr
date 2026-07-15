import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QuickAddSyntaxHint } from './QuickAddSyntaxHint';

describe('QuickAddSyntaxHint', () => {
    it('emphasizes entry tokens and dims placeholder parts', () => {
        const { container } = render(
            <QuickAddSyntaxHint text='Quick add supports /start:<when>, @context, +Project, %"Full Name".' />
        );
        const tokens = Array.from(container.querySelectorAll('span.font-medium')).map((el) => el.textContent);
        expect(tokens).toEqual(['/start:', '@context', '+Project', '%"Full Name"']);
        const meta = Array.from(container.querySelectorAll('span.opacity-70')).map((el) => el.textContent);
        expect(meta).toEqual(['<when>']);
        expect(container.textContent).toBe('Quick add supports /start:<when>, @context, +Project, %"Full Name".');
    });

    it('renders text without recognizable tokens unchanged', () => {
        const { container } = render(<QuickAddSyntaxHint text="Due dates stay date-only." />);
        expect(container.querySelector('span')).toBeNull();
        expect(container.textContent).toBe('Due dates stay date-only.');
    });
});
