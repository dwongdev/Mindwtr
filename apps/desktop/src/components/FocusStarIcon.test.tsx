import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FocusStarIcon } from './FocusStarIcon';

describe('FocusStarIcon', () => {
    it('uses the project focus star fill style', () => {
        const filled = renderToStaticMarkup(<FocusStarIcon className="h-4 w-4" filled />);
        const unfilled = renderToStaticMarkup(<FocusStarIcon className="h-4 w-4" />);

        expect(filled).toContain('fill="currentColor"');
        expect(filled).toContain('text-focus-star');
        expect(unfilled).toContain('fill="none"');
        expect(unfilled).not.toContain('text-focus-star');
    });
});
