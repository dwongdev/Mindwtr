import {
    type AppData,
    type Language,
    type TaskSortBy,
    safeParseDate,
    safeParseDueDate,
    SUPPORTED_LANGUAGES,
    getTranslationsSync,
    getSequentialFirstTaskIds,
    isTaskInActiveProject,
    loadTranslations,
    sortTasksBy,
} from '@mindwtr/core';
import type { ColorProp } from 'react-native-android-widget';
import { THEME_PRESETS, type ThemePresetName } from '../constants/theme-presets';

export const WIDGET_DATA_KEY = 'mindwtr-data';
export const WIDGET_LANGUAGE_KEY = 'mindwtr-language';
export const IOS_WIDGET_APP_GROUP = 'group.tech.dongdongbh.mindwtr';
export const IOS_WIDGET_PAYLOAD_KEY = 'mindwtr-ios-widget-payload';
export const IOS_WIDGET_PAYLOAD_KEY_SMALL = 'mindwtr-ios-widget-payload-small';
export const IOS_WIDGET_PAYLOAD_KEY_MEDIUM = 'mindwtr-ios-widget-payload-medium';
export const IOS_WIDGET_PAYLOAD_KEY_LARGE = 'mindwtr-ios-widget-payload-large';
export const IOS_WIDGET_PAYLOAD_KEY_EXTRA_LARGE = 'mindwtr-ios-widget-payload-extra-large';
export const IOS_WIDGET_KIND = 'MindwtrTasksWidget';
export const IOS_WIDGET_LOCK_KIND = 'MindwtrFocusLockWidget';
export const WIDGET_FOCUS_URI = 'mindwtr:///focus';
export const WIDGET_QUICK_CAPTURE_URI = 'mindwtr:///capture-quick?mode=text';
const DARK_THEME_MODES = new Set(['dark', 'material3-dark', 'nord', 'oled']);
const LIGHT_THEME_MODES = new Set(['light', 'material3-light', 'eink']);
type ConcreteThemePresetName = Exclude<ThemePresetName, 'default'>;

export type WidgetSystemColorScheme = 'light' | 'dark' | null | undefined;

export interface WidgetTaskItem {
    id: string;
    title: string;
    statusLabel: string;
    dueLabel: string | null;
    dueEmphasis: boolean;
}

export interface WidgetPalette {
    background: ColorProp;
    card: ColorProp;
    border: ColorProp;
    text: ColorProp;
    mutedText: ColorProp;
    accent: ColorProp;
    onAccent: ColorProp;
}

export interface TasksWidgetPayload {
    headerTitle: string;
    subtitle: string;
    inboxLabel: string;
    inboxCount: number;
    focusedCount: number;
    items: WidgetTaskItem[];
    emptyMessage: string;
    captureLabel: string;
    focusUri: string;
    quickCaptureUri: string;
    themeMode?: string;
    palette: WidgetPalette;
}

const TASK_SORT_OPTIONS: TaskSortBy[] = ['default', 'due', 'start', 'review', 'title', 'created', 'created-desc'];

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The widget renderer runs in a headless JS context where Intl may be missing,
// so every Intl call falls back to plain strings.
const formatShortWeekday = (date: Date, language: string): string => {
    try {
        return new Intl.DateTimeFormat(language, { weekday: 'short' }).format(date);
    } catch {
        return FALLBACK_SHORT_WEEKDAYS[date.getDay()];
    }
};

const formatNumericDate = (date: Date, language: string): string => {
    try {
        return new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric' }).format(date);
    } catch {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
};

const computeDueLabel = (
    dueDate: string | undefined | null,
    tr: Record<string, string>,
    language: string,
    startOfToday: Date,
    endOfToday: Date,
): Pick<WidgetTaskItem, 'dueLabel' | 'dueEmphasis'> => {
    const due = safeParseDueDate(dueDate);
    if (!due) return { dueLabel: null, dueEmphasis: false };
    if (due < startOfToday) {
        return { dueLabel: formatNumericDate(due, language), dueEmphasis: true };
    }
    if (due <= endOfToday) {
        return { dueLabel: tr['quickDate.today'] ?? 'Today', dueEmphasis: true };
    }
    const dueDayStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const daysAhead = Math.round((dueDayStart.getTime() - startOfToday.getTime()) / DAY_MS);
    if (daysAhead === 1) {
        return { dueLabel: tr['quickDate.tomorrow'] ?? 'Tomorrow', dueEmphasis: false };
    }
    if (daysAhead <= 6) {
        return { dueLabel: formatShortWeekday(due, language), dueEmphasis: false };
    }
    return { dueLabel: formatNumericDate(due, language), dueEmphasis: false };
};

const resolveWidgetTaskSort = (data: AppData): TaskSortBy => {
    const sortBy = data.settings?.taskSortBy;
    return TASK_SORT_OPTIONS.includes(sortBy as TaskSortBy) ? (sortBy as TaskSortBy) : 'default';
};

export function resolveWidgetLanguage(saved: string | null, setting?: string): Language {
    const candidate = setting && setting !== 'system' ? setting : saved;
    if (candidate && SUPPORTED_LANGUAGES.includes(candidate as Language)) return candidate as Language;
    return 'en';
}

const resolveWidgetPalette = (
    themeMode: string | undefined,
    systemColorScheme: WidgetSystemColorScheme,
): WidgetPalette => {
    const normalizedMode = (themeMode || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(THEME_PRESETS, normalizedMode)) {
        const preset = THEME_PRESETS[normalizedMode as ConcreteThemePresetName];
        return {
            background: preset.cardBg,
            card: preset.taskItemBg,
            border: preset.border,
            text: preset.text,
            mutedText: preset.secondaryText,
            accent: preset.tint,
            onAccent: preset.onTint,
        };
    }

    const isDark = DARK_THEME_MODES.has(normalizedMode)
        ? true
        : LIGHT_THEME_MODES.has(normalizedMode)
            ? false
            : systemColorScheme === 'dark';

    if (isDark) {
        return {
            background: '#111827',
            card: '#1F2937',
            border: '#374151',
            text: '#F9FAFB',
            mutedText: '#CBD5E1',
            accent: '#2563EB',
            onAccent: '#FFFFFF',
        };
    }

    return {
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#CBD5E1',
        text: '#0F172A',
        mutedText: '#475569',
        accent: '#2563EB',
        onAccent: '#FFFFFF',
    };
};

export function buildWidgetPayload(
    data: AppData,
    language: Language,
    options?: { systemColorScheme?: WidgetSystemColorScheme; maxItems?: number }
): TasksWidgetPayload {
    void loadTranslations(language);
    const tr = getTranslationsSync(language);
    const tasks = data.tasks || [];
    const projects = data.projects || [];
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const palette = resolveWidgetPalette(
        typeof data.settings?.theme === 'string' ? data.settings.theme : undefined,
        options?.systemColorScheme,
    );

    const sequentialProjectIds = new Set(
        projects.filter((project) => project.isSequential && !project.deletedAt).map((project) => project.id)
    );
    const sequentialWithinSectionProjectIds = new Set(
        projects
            .filter((project) => project.isSequential && project.sequentialScope === 'section' && !project.deletedAt)
            .map((project) => project.id)
    );

    const activeTasks = tasks.filter((task) => {
        if (task.deletedAt) return false;
        if (task.status === 'archived' || task.status === 'done' || task.status === 'reference') return false;
        if (!isTaskInActiveProject(task, projectById)) return false;
        return true;
    });

    const isPlannedForFuture = (task: AppData['tasks'][number]) => {
        const start = safeParseDate(task.startTime);
        return Boolean(start && start > endOfToday);
    };
    const isScheduleCandidate = (task: AppData['tasks'][number]) => {
        const due = safeParseDueDate(task.dueDate);
        const start = safeParseDate(task.startTime);
        const startsToday = Boolean(
            start
            && start >= startOfToday
            && start <= endOfToday
        );
        return Boolean(due && due <= endOfToday) || startsToday;
    };

    const sequentialFirstTaskIds = getSequentialFirstTaskIds(
        activeTasks.filter((task) => (
            task.status === 'next'
            && (!isPlannedForFuture(task) || isScheduleCandidate(task))
        )),
        sequentialProjectIds,
        { sectionScopedProjectIds: sequentialWithinSectionProjectIds },
    );
    const isSequentialBlocked = (task: AppData['tasks'][number]) => {
        if (!task.projectId) return false;
        if (!sequentialProjectIds.has(task.projectId)) return false;
        return !sequentialFirstTaskIds.has(task.id);
    };

    const scheduleTasks = activeTasks.filter((task) => {
        if (task.status !== 'next') return false;
        if (isSequentialBlocked(task)) return false;
        return isScheduleCandidate(task);
    });

    const scheduleTaskIds = new Set(scheduleTasks.map((task) => task.id));
    const nextTasks = activeTasks.filter((task) => {
        if (task.status !== 'next') return false;
        if (isPlannedForFuture(task)) return false;
        if (isSequentialBlocked(task)) return false;
        return !scheduleTaskIds.has(task.id);
    });

    // Starred tasks mirror core's focusedTasks (activeTasks already excludes
    // done/reference/archived/deleted and inactive projects) and lead the list,
    // so "current focused task" surfaces (lock widget, list head) show the task
    // the user actually starred — including starred waiting/someday tasks,
    // which keep their status by design.
    const starredTasks = activeTasks.filter((task) => (
        task.isFocusedToday === true
        && (!isPlannedForFuture(task) || isScheduleCandidate(task))
    ));
    const starredTaskIds = new Set(starredTasks.map((task) => task.id));
    const focusTasks = [...scheduleTasks, ...nextTasks].filter((task) => !starredTaskIds.has(task.id));
    const widgetSort = resolveWidgetTaskSort(data);
    const listSource = [
        ...sortTasksBy(starredTasks, widgetSort),
        ...sortTasksBy(focusTasks, widgetSort),
    ];

    const maxItems = Number.isFinite(options?.maxItems)
        ? Math.max(1, Math.floor(options?.maxItems as number))
        : 3;

    const items = listSource.slice(0, maxItems).map((task) => ({
        id: task.id,
        title: task.title,
        statusLabel: tr[`status.${task.status}`] || task.status,
        ...computeDueLabel(task.dueDate, tr, language, startOfToday, endOfToday),
    }));
    const hiddenTaskCount = Math.max(listSource.length - items.length, 0);

    const inboxCount = activeTasks.filter((task) => task.status === 'inbox').length;
    const subtitleParts = [`${tr['nav.inbox'] ?? 'Inbox'}: ${inboxCount}`];
    if (hiddenTaskCount > 0) {
        subtitleParts.push(`+${hiddenTaskCount} ${tr['common.more'] ?? 'More'}`);
    }

    return {
        headerTitle: tr['agenda.todaysFocus'] ?? 'Today',
        subtitle: subtitleParts.join(' · '),
        inboxLabel: tr['nav.inbox'] ?? 'Inbox',
        inboxCount,
        focusedCount: starredTasks.length,
        items,
        emptyMessage: tr['agenda.allClear'] ?? 'All clear',
        captureLabel: tr['widget.capture'] ?? 'Quick capture',
        focusUri: WIDGET_FOCUS_URI,
        quickCaptureUri: WIDGET_QUICK_CAPTURE_URI,
        themeMode: typeof data.settings?.theme === 'string' ? data.settings.theme : 'system',
        palette,
    };
}
