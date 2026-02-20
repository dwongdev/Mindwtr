export const GLOBAL_QUICK_ADD_SHORTCUT_DISABLED = 'disabled';
export const GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT = 'Control+Alt+M';
export const GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N = 'Control+Alt+N';
export const GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q = 'Control+Alt+Q';
export const GLOBAL_QUICK_ADD_SHORTCUT_LEGACY = 'CommandOrControl+Shift+A';

export type GlobalQuickAddShortcutSetting =
    | typeof GLOBAL_QUICK_ADD_SHORTCUT_DISABLED
    | typeof GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT
    | typeof GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N
    | typeof GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q
    | typeof GLOBAL_QUICK_ADD_SHORTCUT_LEGACY;

type ShortcutOption = {
    value: GlobalQuickAddShortcutSetting;
    label: string;
};

const ALLOWED_SHORTCUTS = new Set<GlobalQuickAddShortcutSetting>([
    GLOBAL_QUICK_ADD_SHORTCUT_DISABLED,
    GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT,
    GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N,
    GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q,
    GLOBAL_QUICK_ADD_SHORTCUT_LEGACY,
]);

export function normalizeGlobalQuickAddShortcut(value?: string | null): GlobalQuickAddShortcutSetting {
    if (!value) return GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT;
    if (ALLOWED_SHORTCUTS.has(value as GlobalQuickAddShortcutSetting)) {
        return value as GlobalQuickAddShortcutSetting;
    }
    return GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT;
}

export function getGlobalQuickAddShortcutOptions(isMac: boolean): ShortcutOption[] {
    return [
        {
            value: GLOBAL_QUICK_ADD_SHORTCUT_DEFAULT,
            label: isMac ? 'Ctrl+Option+M (recommended)' : 'Ctrl+Alt+M (recommended)',
        },
        {
            value: GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N,
            label: isMac ? 'Ctrl+Option+N' : 'Ctrl+Alt+N',
        },
        {
            value: GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q,
            label: isMac ? 'Ctrl+Option+Q' : 'Ctrl+Alt+Q',
        },
        {
            value: GLOBAL_QUICK_ADD_SHORTCUT_LEGACY,
            label: isMac ? 'Cmd+Shift+A (legacy)' : 'Ctrl+Shift+A (legacy)',
        },
        {
            value: GLOBAL_QUICK_ADD_SHORTCUT_DISABLED,
            label: 'Disabled',
        },
    ];
}

export function formatGlobalQuickAddShortcutForDisplay(
    shortcut: GlobalQuickAddShortcutSetting,
    isMac: boolean
): string {
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_DISABLED) {
        return 'Disabled';
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_LEGACY) {
        return isMac ? 'Cmd+Shift+A' : 'Ctrl+Shift+A';
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N) {
        return isMac ? 'Ctrl+Option+N' : 'Ctrl+Alt+N';
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q) {
        return isMac ? 'Ctrl+Option+Q' : 'Ctrl+Alt+Q';
    }
    return isMac ? 'Ctrl+Option+M' : 'Ctrl+Alt+M';
}

export function matchesGlobalQuickAddShortcut(
    event: KeyboardEvent,
    shortcut: GlobalQuickAddShortcutSetting
): boolean {
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_DISABLED) {
        return false;
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_LEGACY) {
        return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === 'KeyA';
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_N) {
        return event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && event.code === 'KeyN';
    }
    if (shortcut === GLOBAL_QUICK_ADD_SHORTCUT_ALTERNATE_Q) {
        return event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && event.code === 'KeyQ';
    }
    return event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && event.code === 'KeyM';
}
