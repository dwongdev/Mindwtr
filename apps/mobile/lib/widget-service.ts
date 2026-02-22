import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppData, useTaskStore } from '@mindwtr/core';

import { buildTasksWidgetTree } from '../components/TasksWidget';
import { buildWidgetPayload, resolveWidgetLanguage, WIDGET_LANGUAGE_KEY } from './widget-data';
import { logError, logWarn } from './app-log';

export function isAndroidWidgetSupported(): boolean {
    return Platform.OS === 'android';
}

const getSystemColorScheme = (): 'light' | 'dark' | undefined => {
    try {
        const scheme = Appearance.getColorScheme();
        if (scheme === 'light' || scheme === 'dark') return scheme;
        return undefined;
    } catch {
        return undefined;
    }
};

async function getWidgetApi() {
    if (Platform.OS !== 'android') return null;
    try {
        // Use require to avoid dynamic import issues in Hermes
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const api = require('react-native-android-widget');
        return api;
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

export async function updateAndroidWidgetFromData(data: AppData): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const widgetApi = await getWidgetApi();
    if (!widgetApi) return false;

    try {
        const languageValue = await AsyncStorage.getItem(WIDGET_LANGUAGE_KEY);
        const language = resolveWidgetLanguage(languageValue, data.settings?.language);
        const payload = buildWidgetPayload(data, language, {
            systemColorScheme: getSystemColorScheme(),
        });
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

export async function updateAndroidWidgetFromStore(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
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
    return await updateAndroidWidgetFromData(data);
}

export async function requestPinAndroidWidget(): Promise<boolean> {
    return false;
}
