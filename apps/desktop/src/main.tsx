import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { setStorageAdapter } from '@mindwtr/core';
import { LanguageProvider } from './contexts/language-context';
import { isTauriRuntime } from './lib/runtime';
import { reportError } from './lib/report-error';
import { webStorage } from './lib/storage-adapter-web';
import { setupGlobalErrorLogging } from './lib/app-log';
import { THEME_STORAGE_KEY, applyThemeMode, coerceDesktopThemeMode, resolveNativeTheme } from './lib/theme';

// Initialize theme immediately before React renders to prevent flash
const savedTheme = coerceDesktopThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
applyThemeMode(savedTheme);

const diagnosticsEnabled = typeof window !== 'undefined'
    && (window as any).__MINDWTR_DIAGNOSTICS__ === true;
if (diagnosticsEnabled) {
    setupGlobalErrorLogging();
}

const nativeTheme = resolveNativeTheme(savedTheme);
if (isTauriRuntime()) {
    import('@tauri-apps/api/app')
        .then(({ setTheme }) => setTheme(nativeTheme))
        .catch(() => undefined);
}

async function initStorage() {
    if (isTauriRuntime()) {
        const { tauriStorage } = await import('./lib/storage-adapter');
        setStorageAdapter(tauriStorage);
        return;
    }

    setStorageAdapter(webStorage);
}

async function bootstrap() {
    await initStorage();
    setupGlobalErrorLogging();

    if (!isTauriRuntime() && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </React.StrictMode>,
    );
}

bootstrap().catch((error) => reportError('Failed to start app', error));
