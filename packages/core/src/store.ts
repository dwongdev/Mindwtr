import { create } from 'zustand';
import { generateUUID as uuidv4 } from './uuid';
import { Task, TaskStatus, AppData, Project } from './types';
import { StorageAdapter, noopStorage } from './storage';

let storage: StorageAdapter = noopStorage;

export const setStorageAdapter = (adapter: StorageAdapter) => {
    storage = adapter;
};

interface TaskStore {
    tasks: Task[];
    projects: Project[];
    settings: AppData['settings'];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchData: () => Promise<void>;
    addTask: (title: string, initialProps?: Partial<Task>) => Promise<void>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    moveTask: (id: string, newStatus: TaskStatus) => Promise<void>;

    // Project Actions
    addProject: (title: string, color: string) => Promise<void>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    toggleProjectFocus: (id: string) => Promise<void>;

    // Settings Actions
    updateSettings: (updates: Partial<AppData['settings']>) => Promise<void>;
}

// Debounce save helper - captures data snapshot immediately to prevent race conditions
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (data: AppData) => {
    // Capture snapshot of data immediately to prevent stale state saves
    const dataSnapshot = { ...data, tasks: [...data.tasks], projects: [...data.projects] };

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        storage.saveData(dataSnapshot).catch(console.error);
        saveTimeout = null;
    }, 1000);
};

export const useTaskStore = create<TaskStore>((set, get) => ({
    tasks: [],
    projects: [],
    settings: {},
    isLoading: false,
    error: null,

    fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await storage.getData();
            // Filter out soft-deleted items for UI display
            const activeTasks = data.tasks.filter(t => !t.deletedAt);
            const activeProjects = (data.projects || []).filter(p => !p.deletedAt);
            // Preserve settings from storage
            set({ tasks: activeTasks, projects: activeProjects, settings: data.settings || {}, isLoading: false });
        } catch (err) {
            set({ error: 'Failed to fetch data', isLoading: false });
        }
    },

    addTask: async (title: string, initialProps?: Partial<Task>) => {
        const newTask: Task = {
            id: uuidv4(),
            title,
            status: 'inbox',
            tags: [],
            contexts: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...initialProps,
        };

        const newTasks = [...get().tasks, newTask];
        set({ tasks: newTasks });
        debouncedSave({ tasks: newTasks, projects: get().projects, settings: get().settings });
    },

    updateTask: async (id: string, updates: Partial<Task>) => {
        const newTasks = get().tasks.map((task) =>
            task.id === id
                ? { ...task, ...updates, updatedAt: new Date().toISOString() }
                : task
        );
        set({ tasks: newTasks });
        debouncedSave({ tasks: newTasks, projects: get().projects, settings: get().settings });
    },

    deleteTask: async (id: string) => {
        // Soft-delete: set deletedAt instead of removing
        const now = new Date().toISOString();
        const allTasks = get().tasks.map((task) =>
            task.id === id
                ? { ...task, deletedAt: now, updatedAt: now }
                : task
        );
        // Filter for UI state (hide deleted)
        const visibleTasks = allTasks.filter(t => !t.deletedAt);
        set({ tasks: visibleTasks });
        // Save with all data (including deleted for sync)
        debouncedSave({ tasks: allTasks, projects: get().projects, settings: get().settings });
    },

    moveTask: async (id: string, newStatus: TaskStatus) => {
        const newTasks = get().tasks.map((task) =>
            task.id === id
                ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
                : task
        );
        set({ tasks: newTasks });
        debouncedSave({ tasks: newTasks, projects: get().projects, settings: get().settings });
    },

    addProject: async (title: string, color: string) => {
        const newProject: Project = {
            id: uuidv4(),
            title,
            color,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const newProjects = [...get().projects, newProject];
        set({ projects: newProjects });
        debouncedSave({ tasks: get().tasks, projects: newProjects, settings: get().settings });
    },

    updateProject: async (id: string, updates: Partial<Project>) => {
        const newProjects = get().projects.map((project) =>
            project.id === id ? { ...project, ...updates, updatedAt: new Date().toISOString() } : project
        );
        set({ projects: newProjects });
        debouncedSave({ tasks: get().tasks, projects: newProjects, settings: get().settings });
    },

    deleteProject: async (id: string) => {
        // Soft-delete: set deletedAt instead of removing
        const now = new Date().toISOString();
        const allProjects = get().projects.map((project) =>
            project.id === id
                ? { ...project, deletedAt: now, updatedAt: now }
                : project
        );
        // Also soft-delete tasks that belonged to this project
        const allTasks = get().tasks.map(task =>
            task.projectId === id && !task.deletedAt
                ? { ...task, deletedAt: now, updatedAt: now }
                : task
        );
        // Filter for UI state (hide deleted)
        const visibleProjects = allProjects.filter(p => !p.deletedAt);
        const visibleTasks = allTasks.filter(t => !t.deletedAt);
        set({ projects: visibleProjects, tasks: visibleTasks });
        // Save with all data (including deleted for sync)
        debouncedSave({ tasks: allTasks, projects: allProjects, settings: get().settings });
    },

    toggleProjectFocus: async (id: string) => {
        const projects = get().projects;
        const project = projects.find(p => p.id === id);
        if (!project) return;

        // If turning on focus, check if we already have 5 focused
        const focusedCount = projects.filter(p => p.isFocused && !p.deletedAt).length;
        const isCurrentlyFocused = project.isFocused;

        // Don't allow more than 5 focused projects
        if (!isCurrentlyFocused && focusedCount >= 5) {
            return; // Already at max
        }

        const newProjects = projects.map(p =>
            p.id === id
                ? { ...p, isFocused: !p.isFocused, updatedAt: new Date().toISOString() }
                : p
        );
        set({ projects: newProjects });
        debouncedSave({ tasks: get().tasks, projects: newProjects, settings: get().settings });
    },

    updateSettings: async (updates: Partial<AppData['settings']>) => {
        const newSettings = { ...get().settings, ...updates };
        set({ settings: newSettings });
        debouncedSave({ tasks: get().tasks, projects: get().projects, settings: newSettings });
    },
}));
