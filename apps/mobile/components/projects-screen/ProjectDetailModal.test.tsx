import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@mindwtr/core';

vi.mock('@react-native-community/datetimepicker', () => ({
    __esModule: true,
    default: () => null,
}));

vi.mock('@expo/vector-icons', () => ({
    Ionicons: () => null,
}));

vi.mock('lucide-react-native', () => ({
    CheckCircle2: () => null,
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

import { ProjectDetailModal, getProjectDetailModalSafeAreaEdges, getProjectDetailTaskListOptions } from './ProjectDetailModal';

const project = (status: Project['status']): Project => ({
    id: 'project-1',
    title: 'Launch',
    status,
    color: '#3b82f6',
    order: 0,
    tagIds: [],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
});

const themeColors = {
    bg: '#0f172a',
    cardBg: '#111827',
    taskItemBg: '#1f2937',
    text: '#f8fafc',
    secondaryText: '#94a3b8',
    icon: '#94a3b8',
    border: '#334155',
    tint: '#60a5fa',
    onTint: '#0f172a',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#60a5fa',
    inputBg: '#1e293b',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    filterBg: '#1e293b',
};

const originalPlatformOs = Platform.OS;

const setPlatform = (os: typeof Platform.OS) => {
    Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: os,
    });
};

const createProjectDetailModalProps = (overrides: Partial<React.ComponentProps<typeof ProjectDetailModal>> = {}) => ({
    addProjectFileAttachment: vi.fn(),
    closeProjectDetail: vi.fn(),
    commitSelectedProjectNotes: vi.fn(),
    formatProjectDate: (value: string | undefined, fallback: string) => value || fallback,
    handleArchiveSelectedProject: vi.fn(),
    handleSelectedProjectNotesApplyAction: vi.fn(() => ({ value: '', selection: { start: 0, end: 0 } })),
    handleSelectedProjectNotesApplyAutocomplete: vi.fn(),
    handleSelectedProjectNotesChange: vi.fn(),
    handleSelectedProjectNotesSelectionChange: vi.fn(),
    handleSelectedProjectNotesUndo: vi.fn(),
    handleSetProjectStatus: vi.fn(),
    isSelectedProjectNotesFocused: false,
    modalHeaderStyle: [{}],
    notesExpanded: true,
    notesFullscreen: false,
    onCloseNotesFullscreen: vi.fn(),
    onDuplicateProject: vi.fn(),
    onDownloadAttachment: vi.fn(),
    onOpenAreaPicker: vi.fn(),
    onOpenAttachment: vi.fn(),
    onOpenTagPicker: vi.fn(),
    onRemoveProjectAttachment: vi.fn(),
    onSetLinkInput: vi.fn(),
    onSetLinkModalVisible: vi.fn(),
    onSetNotesExpanded: vi.fn(),
    onSetSelectedProject: vi.fn(),
    onSetSelectedProjectNotesFocused: vi.fn(),
    onSetShowDueDatePicker: vi.fn(),
    onSetShowNotesFullscreen: vi.fn(),
    onSetShowNotesPreview: vi.fn(),
    onSetShowProjectMeta: vi.fn(),
    onSetShowReviewPicker: vi.fn(),
    onSetShowStatusMenu: vi.fn(),
    onToggleShowCompletedTasks: vi.fn(),
    overlayVisible: true,
    presentationStyle: 'fullScreen' as const,
    selectedProject: { ...project('active'), supportNotes: 'Draft' },
    selectedProjectAreaName: 'No Area',
    selectedProjectNotes: 'Draft',
    selectedProjectNotesDirection: 'ltr' as const,
    selectedProjectNotesInputRef: { current: null },
    selectedProjectNotesSelection: { start: 5, end: 5 },
    selectedProjectNotesTextDirectionStyle: {},
    selectedProjectNotesUndoDepth: 0,
    showCompletedTasks: false,
    showDueDatePicker: false,
    showNotesPreview: false,
    showProjectMeta: true,
    showReviewPicker: false,
    showStatusMenu: false,
    statusPalette: {
        active: { bg: '#1d4ed822', border: '#1d4ed8', text: '#1d4ed8' },
        waiting: { bg: '#f59e0b22', border: '#f59e0b', text: '#f59e0b' },
        someday: { bg: '#a855f722', border: '#a855f7', text: '#a855f7' },
        archived: { bg: '#334155', border: '#334155', text: '#94a3b8' },
    },
    t: (key: string) => ({
        'attachments.addFile': 'Add file',
        'attachments.addLink': 'Add link',
        'attachments.title': 'Attachments',
        'common.back': 'Back',
        'common.clear': 'Clear',
        'common.hideCompleted': 'Hide completed',
        'common.loading': 'Loading',
        'common.none': 'None',
        'common.notSet': 'Not set',
        'common.showCompleted': 'Show completed',
        'markdown.edit': 'Edit',
        'markdown.expand': 'Expand',
        'markdown.preview': 'Preview',
        'project.notes': 'Project notes',
        'projects.archive': 'Archive',
        'projects.areaLabel': 'Area',
        'projects.duplicate': 'Duplicate',
        'projects.notesPlaceholder': 'Notes',
        'projects.noArea': 'No Area',
        'projects.reactivate': 'Reactivate',
        'projects.reviewAt': 'Review',
        'projects.sequentialAcrossSections': 'Across sections',
        'projects.sequentialScope': 'Sequential Scope',
        'projects.sequentialWithinSections': 'Within sections',
        'projects.statusLabel': 'Status',
        'status.active': 'Active',
        'status.someday': 'Someday',
        'status.waiting': 'Waiting',
        'taskEdit.details': 'Details',
        'taskEdit.dueDateLabel': 'Due Date',
        'taskEdit.tagsLabel': 'Tags',
    }[key] ?? key),
    tc: themeColors,
    updateProject: vi.fn(),
    ...overrides,
});

afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOs,
    });
    vi.restoreAllMocks();
});

describe('ProjectDetailModal safe area handling', () => {
    it('reserves the top inset for Android full-screen release modals', () => {
        expect(getProjectDetailModalSafeAreaEdges('fullScreen')).toEqual(['top', 'left', 'right', 'bottom']);
    });

    it('preserves the existing page-sheet header spacing path', () => {
        expect(getProjectDetailModalSafeAreaEdges('pageSheet')).toEqual(['left', 'right', 'bottom']);
    });
});

describe('ProjectDetailModal notes editing', () => {
    it('commits project notes when the inline notes editor blurs', () => {
        const commitSelectedProjectNotes = vi.fn();
        let tree!: ReturnType<typeof create>;

        act(() => {
            tree = create(<ProjectDetailModal {...createProjectDetailModalProps({ commitSelectedProjectNotes })} />);
        });

        const notesInput = tree.root.findAllByType(TextInput).find((input) => (
            input.props.placeholder === 'Notes'
        ));

        expect(notesInput).toBeTruthy();

        act(() => {
            notesInput?.props.onBlur();
        });

        expect(commitSelectedProjectNotes).toHaveBeenCalledTimes(1);
    });
});

describe('ProjectDetailModal keyboard handling', () => {
    it('uses Android height-based keyboard avoidance for project task quick-add', () => {
        setPlatform('android');
        let tree!: ReturnType<typeof create>;

        act(() => {
            tree = create(<ProjectDetailModal {...createProjectDetailModalProps()} />);
        });

        expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('height');
        expect(tree.root.findByType(ScrollView).props.keyboardDismissMode).toBe('on-drag');
    });
});

describe('ProjectDetailModal archived projects', () => {
    it('shows archived task data without quick-add or reorder controls', () => {
        expect(getProjectDetailTaskListOptions(project('archived'))).toEqual({
            allowAdd: false,
            enableProjectReorder: false,
            includeArchived: true,
            includeDone: true,
        });
    });

    it('keeps normal task controls and hides done tasks for non-archived projects by default', () => {
        expect(getProjectDetailTaskListOptions(project('active'))).toEqual({
            allowAdd: true,
            enableProjectReorder: true,
            includeArchived: false,
            includeDone: false,
        });
    });

    it('shows done tasks for active projects when the completed toggle is on', () => {
        expect(getProjectDetailTaskListOptions(project('active'), true)).toEqual({
            allowAdd: true,
            enableProjectReorder: true,
            includeArchived: false,
            includeDone: true,
        });
    });
});
