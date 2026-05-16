import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { labelFallback } from './labels';
import { SettingsAdvancedPage } from './SettingsAdvancedPage';

const baseProps: Parameters<typeof SettingsAdvancedPage>[0] = {
    t: labelFallback.en,
    isTauri: true,
    localApiStatus: {
        enabled: false,
        running: false,
        port: 3456,
        url: null,
        error: null,
    },
    localApiPortInput: '3456',
    localApiBusy: false,
    localApiPortError: '',
    onLocalApiToggle: vi.fn(),
    onLocalApiPortInputChange: vi.fn(),
    onLocalApiPortCommit: vi.fn(),
};

describe('SettingsAdvancedPage', () => {
    it('toggles the local API server', () => {
        const onLocalApiToggle = vi.fn();
        const { getByRole } = render(
            <SettingsAdvancedPage
                {...baseProps}
                onLocalApiToggle={onLocalApiToggle}
            />,
        );

        fireEvent.click(getByRole('button', { name: 'Enable local API server' }));

        expect(onLocalApiToggle).toHaveBeenCalledWith(true);
    });

    it('commits the local API port on blur', () => {
        const onLocalApiPortInputChange = vi.fn();
        const onLocalApiPortCommit = vi.fn();
        const { getByRole } = render(
            <SettingsAdvancedPage
                {...baseProps}
                onLocalApiPortInputChange={onLocalApiPortInputChange}
                onLocalApiPortCommit={onLocalApiPortCommit}
            />,
        );

        const input = getByRole('spinbutton', { name: 'Port' });
        fireEvent.change(input, { target: { value: '4567' } });
        fireEvent.blur(input);

        expect(onLocalApiPortInputChange).toHaveBeenCalledWith('4567');
        expect(onLocalApiPortCommit).toHaveBeenCalled();
    });
});
