import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import type { TasksWidgetPayload } from '../lib/widget-data';
import { buildTasksWidgetTree } from './TasksWidget';

vi.mock('react-native-android-widget', () => ({
    FlexWidget: 'FlexWidget',
    TextWidget: 'TextWidget',
}));

type WidgetElement = ReactElement<{
    children?: WidgetElement | WidgetElement[];
    text?: string;
    style?: {
        flex?: number;
        fontSize?: number;
        height?: number;
        color?: string;
        flexDirection?: string;
    };
    maxLines?: number;
    truncate?: string;
}>;

const asWidgetChildren = (children: WidgetElement['props']['children']): WidgetElement[] => {
    if (!children) return [];
    return Array.isArray(children) ? children : [children];
};

const collectTexts = (
    node: WidgetElement,
    acc: Array<{ text: string; style?: WidgetElement['props']['style'] }> = [],
): Array<{ text: string; style?: WidgetElement['props']['style'] }> => {
    if (typeof node.props.text === 'string') {
        acc.push({ text: node.props.text, style: node.props.style });
    }
    for (const child of asWidgetChildren(node.props.children)) {
        collectTexts(child, acc);
    }
    return acc;
};

const dueItemPayload = (overrides: { dueLabel: string | null; dueEmphasis?: boolean }): TasksWidgetPayload => ({
    ...basePayload,
    items: [
        {
            id: 'task-1',
            title: 'Review waiting item',
            statusLabel: 'Next',
            dueLabel: overrides.dueLabel,
            dueEmphasis: overrides.dueEmphasis ?? false,
        },
    ],
});

const basePayload: TasksWidgetPayload = {
    headerTitle: 'Today',
    subtitle: 'Inbox: 1',
    inboxLabel: 'Inbox',
    inboxCount: 1,
    focusedCount: 0,
    items: [
        {
            id: 'task-1',
            title: 'Review waiting item',
            statusLabel: 'Next',
            dueLabel: null,
            dueEmphasis: false,
        },
    ],
    emptyMessage: 'No tasks',
    captureLabel: 'Quick capture',
    focusUri: 'mindwtr:///focus',
    quickCaptureUri: 'mindwtr:///capture-quick?mode=text',
    palette: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#CBD5E1',
        text: '#0F172A',
        mutedText: '#475569',
        accent: '#2563EB',
        onAccent: '#FFFFFF',
    },
};

describe('TasksWidget', () => {
    it('uses the larger task title font size in widget rows', () => {
        const tree = buildTasksWidgetTree(basePayload) as WidgetElement;
        const [content] = asWidgetChildren(tree.props.children);
        const contentChildren = content ? asWidgetChildren(content.props.children) : [];
        const taskItem = contentChildren.find(
            (child) => (child as ReactElement<{ text?: string }>).props.text === '• Review waiting item'
        ) as ReactElement<{ style: { fontSize: number } }> | undefined;

        expect(taskItem).toBeDefined();
        expect(taskItem?.props.style.fontSize).toBe(13);
    });

    it('anchors quick capture below the task content area', () => {
        const tree = buildTasksWidgetTree(basePayload) as WidgetElement;
        const [content, button] = asWidgetChildren(tree.props.children);

        expect(content?.props.style?.height).toBe(0);
        expect(content?.props.style?.flex).toBe(1);
        expect(button?.props.text).toBe('Quick capture');
        expect(button?.props.maxLines).toBe(1);
        expect(button?.props.truncate).toBe('END');
    });

    it('renders a right-aligned due label in standard mode when set', () => {
        const tree = buildTasksWidgetTree(dueItemPayload({ dueLabel: 'Today', dueEmphasis: true })) as WidgetElement;
        const [content] = asWidgetChildren(tree.props.children);
        const contentChildren = content ? asWidgetChildren(content.props.children) : [];
        const row = contentChildren.find((child) => child.props.style?.flexDirection === 'row');

        expect(row).toBeDefined();
        const texts = row ? collectTexts(row) : [];
        expect(texts.map((t) => t.text)).toEqual(['• Review waiting item', 'Today']);
        const titleWrapper = row ? asWidgetChildren(row.props.children)[0] : undefined;
        const due = texts.find((t) => t.text === 'Today');
        expect(titleWrapper?.props.style?.flex).toBe(1);
        expect(due?.style?.color).toBe(basePayload.palette.accent);
        expect(due?.style?.fontSize).toBe(12);
    });

    it('uses muted color for a non-emphasized due label', () => {
        const tree = buildTasksWidgetTree(dueItemPayload({ dueLabel: 'Fri', dueEmphasis: false })) as WidgetElement;
        const due = collectTexts(tree).find((t) => t.text === 'Fri');
        expect(due?.style?.color).toBe(basePayload.palette.mutedText);
    });

    it('omits the due label in compact mode even when set', () => {
        const tree = buildTasksWidgetTree(dueItemPayload({ dueLabel: 'Fri', dueEmphasis: false }), {
            layoutMode: 'compact',
        }) as WidgetElement;
        const texts = collectTexts(tree).map((t) => t.text);
        expect(texts).toContain('• Review waiting item');
        expect(texts).not.toContain('Fri');
    });

    it('omits the due label when dueLabel is null', () => {
        const tree = buildTasksWidgetTree(dueItemPayload({ dueLabel: null })) as WidgetElement;
        const [content] = asWidgetChildren(tree.props.children);
        const contentChildren = content ? asWidgetChildren(content.props.children) : [];
        expect(contentChildren.some((child) => child.props.style?.flexDirection === 'row')).toBe(false);
    });

    it('uses a compact layout for narrow Android widgets', () => {
        const tree = buildTasksWidgetTree(basePayload, { layoutMode: 'compact' }) as WidgetElement;
        const children = asWidgetChildren(tree.props.children);
        const [content, button] = children;
        const contentChildren = content ? asWidgetChildren(content.props.children) : [];
        const taskItem = contentChildren.find(
            (child) => (child as ReactElement<{ text?: string }>).props.text === '• Review waiting item'
        ) as ReactElement<{ style: { fontSize: number } }> | undefined;

        expect(children).toHaveLength(2);
        expect(taskItem?.props.style.fontSize).toBe(12);
        expect(button?.props.style?.fontSize).toBe(10);
    });
});
