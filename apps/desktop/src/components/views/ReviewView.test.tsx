import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ReviewView } from './ReviewView';
import { LanguageProvider } from '../../contexts/language-context';

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <LanguageProvider>
            {ui}
        </LanguageProvider>
    );
};

// Avoid async state updates from calendar fetch effects in review modals.
vi.mock('../../lib/external-calendar-events', () => ({
    fetchExternalCalendarEvents: vi.fn(() => new Promise(() => {})),
}));

describe('ReviewView', () => {
    it('renders the review list with a guide button', () => {
        const { getByRole } = renderWithProviders(<ReviewView />);
        expect(getByRole('heading', { name: /^review$/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /weekly review/i })).toBeInTheDocument();
    });

    it('navigates through the wizard steps', () => {
        const { getByText, getAllByText, queryByText } = renderWithProviders(<ReviewView />);

        // Open guide
        fireEvent.click(getByText('Weekly Review'));
        expect(getByText('Process Inbox')).toBeInTheDocument();
        expect(getByText('Inbox Zero Goal')).toBeInTheDocument();

        // Inbox -> AI or Calendar (AI step is hidden when AI is disabled)
        fireEvent.click(getByText('Next Step'));
        const aiVisible = queryByText('AI insight');
        if (aiVisible) {
            expect(aiVisible).toBeInTheDocument();
            fireEvent.click(getByText('Next Step'));
        }

        // -> Calendar
        expect(getAllByText('Review Calendar').length).toBeGreaterThan(0);
        expect(getByText('Events')).toBeInTheDocument();
        expect(getByText('Look at the next week. What do you need to prepare for? Capture any new next actions.')).toBeInTheDocument();

        // Calendar -> Waiting For
        fireEvent.click(getByText('Next Step'));
        expect(getByText('Waiting For')).toBeInTheDocument();

        // Waiting For -> Contexts (optional) -> Projects
        fireEvent.click(getByText('Next Step'));
        const contextsVisible = queryByText('Contexts');
        if (contextsVisible) {
            expect(contextsVisible).toBeInTheDocument();
            fireEvent.click(getByText('Next Step'));
        }
        expect(getByText('Review Projects')).toBeInTheDocument();

        // Projects -> Someday/Maybe
        fireEvent.click(getByText('Next Step'));
        expect(getByText('Someday/Maybe')).toBeInTheDocument();

        // Someday/Maybe -> Completed
        fireEvent.click(getByText('Next Step'));
        expect(getByText('Review Complete!')).toBeInTheDocument();
        expect(getByText('Finish')).toBeInTheDocument();
    });

    it('can navigate back', () => {
        const { getByText, queryByText } = renderWithProviders(<ReviewView />);

        // Open guide
        fireEvent.click(getByText('Weekly Review'));
        expect(getByText('Process Inbox')).toBeInTheDocument();

        // Go forward then back to Inbox
        fireEvent.click(getByText('Next Step'));
        expect(queryByText('Process Inbox')).not.toBeInTheDocument();
        fireEvent.click(getByText('Back'));
        expect(getByText('Process Inbox')).toBeInTheDocument();
    });
});
