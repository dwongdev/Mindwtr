import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TaskInput } from './TaskInput';

describe('TaskInput autocomplete', () => {
    it('suggests custom contexts for @ trigger', () => {
        const onChange = vi.fn();
        const { getByRole } = render(
            <TaskInput
                value="@per"
                onChange={onChange}
                projects={[]}
                contexts={['@home', '@work', '@personal']}
            />
        );
        const input = getByRole('combobox') as HTMLInputElement;
        input.setSelectionRange(input.value.length, input.value.length);
        fireEvent.click(input);

        expect(getByRole('option', { name: '@personal' })).toBeInTheDocument();
    });

    it('suggests tags for # trigger and inserts selected tag', () => {
        const onChange = vi.fn();
        const { getByRole } = render(
            <TaskInput
                value="#urg"
                onChange={onChange}
                projects={[]}
                contexts={['#urgent', '#ops', '@work']}
            />
        );
        const input = getByRole('combobox') as HTMLInputElement;
        input.setSelectionRange(input.value.length, input.value.length);
        fireEvent.click(input);

        fireEvent.click(getByRole('option', { name: '#urgent' }));

        expect(onChange).toHaveBeenCalledWith('#urgent');
    });
});
