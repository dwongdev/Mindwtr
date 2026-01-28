export function isTauriRuntime(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
}

export function isFlatpakRuntime(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).__MINDWTR_FLATPAK__);
}
