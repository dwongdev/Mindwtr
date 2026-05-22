import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RichMarkdown } from './RichMarkdown';

describe('RichMarkdown', () => {
    it('renders markdown headings with desktop heading styles', () => {
        render(<RichMarkdown markdown={'# Heading\n\n## Section\n\nBody'} />);

        expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toHaveClass('text-lg', 'font-semibold');
        expect(screen.getByRole('heading', { level: 2, name: 'Section' })).toHaveClass('text-base', 'font-semibold');
        expect(screen.getByText('Body')).toBeInTheDocument();
    });
});
