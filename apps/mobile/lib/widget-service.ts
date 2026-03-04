import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppData, useTaskStore } from '@mindwtr/core';

import { buildTasksWidgetTree } from '../components/TasksWidget';
import {
    buildWidgetPayload,
    IOS_WIDGET_APP_GROUP,
    IOS_WIDGET_KIND,
    IOS_WIDGET_PAYLOAD_KEY,
    resolveWidgetLanguage,
    type TasksWidgetPayload,
    WIDGET_LANGUAGE_KEY,
} from './widget-data';
import { logError, logWarn } from './app-log';
import { getSystemColorSchemeForWidget } from './system-color-scheme';

export function isAndroidWidgetSupported(): boolean {
    return Platform.OS === 'android';
}

export function isIosWidgetSupported(): boolean {
    return Platform.OS === 'ios';
}

type AndroidWidgetApi = {
    requestWidgetUpdate: (params: {
        widgetName: string;
        renderWidget: () => unknown;
    }) => Promise<void>;
};

type IosWidgetApi = {
    setItem: (key: string, value: string, appGroup: string) => Promise<void>;
    reloadTimelines?: (ofKind: string) => void;
    reloadAllTimelines?: () => void;
};

async function getAndroidWidgetApi(): Promise<AndroidWidgetApi | null> {
    if (Platform.OS !== 'android') return null;
    try {
        // Use require to avoid dynamic import issues in Hermes
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const api = require('react-native-android-widget');
        return api as AndroidWidgetApi;
    } catch (error) {
        if (__DEV__) {
            void logWarn('[RNWidget] Android widget API unavailable', {
                scope: 'widget',
                extra: { error: error instanceof Error ? error.message : String(error) },
            });
        }
        return null;
    }
}

async function getIosWidgetApi(): Promise<IosWidgetApi | null> {
    if (Platform.OS !== 'ios') return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const api = require('react-native-widgetkit');
        return api as IosWidgetApi;
    } catch (error) {
        if (__DEV__) {
            void logWarn('[RNWidget] iOS widget API unavailable', {
                scope: 'widget',
                extra: { error: error instanceof Error ? error.message : String(error) },
            });
        }
        return null;
    }
}

async function buildPayloadFromData(data: AppData): Promise<TasksWidgetPayload> {
    const languageValue = await AsyncStorage.getItem(WIDGET_LANGUAGE_KEY);
    const language = resolveWidgetLanguage(languageValue, data.settings?.language);
    const maxItems = Platform.OS === 'ios' ? 8 : undefined;
    return buildWidgetPayload(data, language, {
        systemColorScheme: getSystemColorSchemeForWidget(),
        maxItems,
    });
}

async function updateAndroidWidgetFromPayload(payload: TasksWidgetPayload): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const widgetApi = await getAndroidWidgetApi();
    if (!widgetApi) return false;

    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                await widgetApi.requestWidgetUpdate({
                    widgetName: 'TasksWidget',
                    renderWidget: () => buildTasksWidgetTree(payload),
                });
                return true;
            } catch (error) {
                if (attempt < 1) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    continue;
                }
                if (__DEV__) {
                    void logWarn('[RNWidget] Failed to update Android widget', {
                        scope: 'widget',
                        extra: { error: error instanceof Error ? error.message : String(error) },
                    });
                }
                void logError(error, { scope: 'widget', extra: { platform: 'android', attempt: String(attempt + 1) } });
                return false;
            }
        }
        return false;
    } catch (error) {
        if (__DEV__) {
            void logWarn('[RNWidget] Failed to update Android widget', {
                scope: 'widget',
                extra: { error: error instanceof Error ? error.message : String(error) },
            });
        }
        void logError(error, { scope: 'widget', extra: { platform: 'android', attempt: 'setup' } });
        return false;
    }
}

async function updateIosWidgetFromPayload(payload: TasksWidgetPayload): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    const widgetApi = await getIosWidgetApi();
    if (!widgetApi) return false;

    try {
        await widgetApi.setItem(
            IOS_WIDGET_PAYLOAD_KEY,
            JSON.stringify(payload),
            IOS_WIDGET_APP_GROUP,
        );
        if (typeof widgetApi.reloadTimelines === 'function') {
            widgetApi.reloadTimelines(IOS_WIDGET_KIND);
        } else if (typeof widgetApi.reloadAllTimelines === 'function') {
            widgetApi.reloadAllTimelines();
        }
        return true;
    } catch (error) {
        if (__DEV__) {
            void logWarn('[RNWidget] Failed to update iOS widget', {
                scope: 'widget',
                extra: { error: error instanceof Error ? error.message : String(error) },
            });
        }
        void logError(error, { scope: 'widget', extra: { platform: 'ios' } });
        return false;
    }
}

export async function updateMobileWidgetFromData(data: AppData): Promise<boolean> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
    const payload = await buildPayloadFromData(data);
    if (Platform.OS === 'android') {
        return await updateAndroidWidgetFromPayload(payload);
    }
    return await updateIosWidgetFromPayload(payload);
}

export async function updateMobileWidgetFromStore(): Promise<boolean> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
    const { _allTasks, _allProjects, _allSections, _allAreas, tasks, projects, sections, areas, settings } = useTaskStore.getState();
    const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    const allTasks = ensureArray<AppData['tasks'][number]>(_allTasks);
    const allProjects = ensureArray<AppData['projects'][number]>(_allProjects);
    const allSections = ensureArray<AppData['sections'][number]>(_allSections);
    const allAreas = ensureArray<AppData['areas'][number]>(_allAreas);
    const visibleTasks = ensureArray<AppData['tasks'][number]>(tasks);
    const visibleProjects = ensureArray<AppData['projects'][number]>(projects);
    const visibleSections = ensureArray<AppData['sections'][number]>(sections);
    const visibleAreas = ensureArray<AppData['areas'][number]>(areas);
    const data: AppData = {
        tasks: allTasks.length ? allTasks : visibleTasks,
        projects: allProjects.length ? allProjects : visibleProjects,
        sections: allSections.length ? allSections : visibleSections,
        areas: allAreas.length ? allAreas : visibleAreas,
        settings: settings ?? {},
    };
    return await updateMobileWidgetFromData(data);
}

// Backwards-compatible aliases for older imports.
export const updateAndroidWidgetFromData = updateMobileWidgetFromData;
export const updateAndroidWidgetFromStore = updateMobileWidgetFromStore;

export async function requestPinAndroidWidget(): Promise<boolean> {
    return false;
}
