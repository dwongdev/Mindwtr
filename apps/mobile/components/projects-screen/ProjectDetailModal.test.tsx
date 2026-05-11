import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-community/datetimepicker', () => ({
    __esModule: true,
    default: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

vi.mock('react-native-gesture-handler', () => ({
    GestureHandlerRootView: ({ children }: any) => children,
}));

vi.mock('react-native-draggable-flatlist', () => ({
    NestableScrollContainer: ({ children }: any) => children,
}));

vi.mock('../../components/keyboard-accessory-host', () => ({
    KeyboardAccessoryHost: ({ children }: any) => children,
}));

vi.mock('../../components/expanded-markdown-editor', () => ({
    ExpandedMarkdownEditor: () => null,
}));

vi.mock('../../components/markdown-format-toolbar', () => ({
    MarkdownFormatToolbar: () => null,
}));

vi.mock('../../components/markdown-reference-autocomplete', () => ({
    MarkdownReferenceAutocomplete: () => null,
}));

vi.mock('../../components/markdown-text', () => ({
    MarkdownText: () => null,
}));

vi.mock('../../components/task-list', () => ({
    TaskList: () => null,
}));

vi.mock('../../components/AttachmentProgressIndicator', () => ({
    AttachmentProgressIndicator: () => null,
}));

import { getProjectDetailModalSafeAreaEdges } from './ProjectDetailModal';

describe('ProjectDetailModal safe area handling', () => {
    it('reserves the top inset for Android full-screen release modals', () => {
        expect(getProjectDetailModalSafeAreaEdges('fullScreen')).toEqual(['top', 'left', 'right', 'bottom']);
    });

    it('preserves the existing page-sheet header spacing path', () => {
        expect(getProjectDetailModalSafeAreaEdges('pageSheet')).toEqual(['left', 'right', 'bottom']);
    });
});
