import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReviewListControls } from './ReviewHeader';

const translations: Record<string, string> = {
    'list.details': 'Details',
    'list.groupBy': 'Group',
    'list.groupByArea': 'Area',
    'list.groupByContext': 'Context',
    'list.groupByNone': 'No grouping',
    'list.groupByProject': 'Project',
    'projects.noTags': 'No tags',
    'sort.default': 'Default',
    'sort.label': 'Sort',
    'taskEdit.statusLabel': 'Status',
    'taskEdit.tab.view': 'View',
    'taskEdit.tagsLabel': 'Tags',
};

describe('ReviewListControls', () => {
    it('keeps selection separate while placing display settings in an accessible popover', () => {
        const onChangeSortBy = vi.fn();
        const onToggleDetails = vi.fn();

        render(
            <ReviewListControls
                selectionMode={false}
                onToggleSelection={vi.fn()}
                sortBy="default"
                onChangeSortBy={onChangeSortBy}
                groupBy="none"
                onChangeGroupBy={vi.fn()}
                showListDetails={false}
                onToggleDetails={onToggleDetails}
                disableStatusGrouping
                t={(key) => translations[key] ?? key}
                labels={{ select: 'Select', exitSelect: 'Exit select' }}
            />
        );

        const viewButton = screen.getByRole('button', { name: 'View' });
        expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'View' })).not.toBeInTheDocument();

        fireEvent.click(viewButton);

        expect(screen.getByRole('dialog', { name: 'View' })).toBeInTheDocument();
        const sortSelect = screen.getByRole('combobox', { name: 'Sort' });
        const groupSelect = screen.getByRole('combobox', { name: 'Group' });
        expect(within(groupSelect).getByRole('option', { name: 'Status' })).toBeDisabled();

        fireEvent.change(sortSelect, { target: { value: 'title' } });
        expect(onChangeSortBy).toHaveBeenCalledWith('title');

        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(onToggleDetails).toHaveBeenCalledOnce();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'View' })).not.toBeInTheDocument();
        expect(viewButton).toHaveFocus();
    });
});
