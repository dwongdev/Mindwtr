import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Play, X, Trash2, Moon, User, CheckCircle, Filter } from 'lucide-react';
import { useTaskStore, TaskStatus, Task, TaskPriority, TimeEstimate, PRESET_CONTEXTS, PRESET_TAGS, sortTasksBy, Project, parseQuickAdd, matchesHierarchicalToken, safeParseDate, createAIProvider, type AIProviderId } from '@mindwtr/core';
import type { TaskSortBy } from '@mindwtr/core';
import { TaskItem } from '../TaskItem';
import { TaskInput } from '../Task/TaskInput';
import { cn } from '../../lib/utils';
import { PromptModal } from '../PromptModal';
import { useLanguage } from '../../contexts/language-context';
import { useKeybindings } from '../../contexts/keybinding-context';
import { buildCopilotConfig, loadAIKey } from '../../lib/ai-config';


interface ListViewProps {
    title: string;
    statusFilter: TaskStatus | 'all';
}

type ProcessingStep = 'refine' | 'actionable' | 'twomin' | 'decide' | 'context' | 'project' | 'waiting-note';

const EMPTY_PRIORITIES: TaskPriority[] = [];
const EMPTY_ESTIMATES: TimeEstimate[] = [];

export function ListView({ title, statusFilter }: ListViewProps) {
    const { tasks, projects, areas, settings, updateSettings, addTask, addProject, updateTask, deleteTask, moveTask, batchMoveTasks, batchDeleteTasks, batchUpdateTasks, queryTasks, lastDataChangeAt } = useTaskStore();
    const { t } = useLanguage();
    const { registerTaskListScope } = useKeybindings();
    const sortBy = (settings?.taskSortBy ?? 'default') as TaskSortBy;
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
    const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
    const [selectedTimeEstimates, setSelectedTimeEstimates] = useState<TimeEstimate[]>([]);
    const [baseTasks, setBaseTasks] = useState<Task[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [customContext, setCustomContext] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectionMode, setSelectionMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const [tagPromptOpen, setTagPromptOpen] = useState(false);
    const [tagPromptIds, setTagPromptIds] = useState<string[]>([]);
    const addInputRef = useRef<HTMLInputElement>(null);
    const [aiKey, setAiKey] = useState('');
    const [copilotSuggestion, setCopilotSuggestion] = useState<{ context?: string; tags?: string[] } | null>(null);
    const [copilotApplied, setCopilotApplied] = useState(false);
    const [copilotContext, setCopilotContext] = useState<string | null>(null);
    const [copilotTags, setCopilotTags] = useState<string[]>([]);
    const aiEnabled = settings?.ai?.enabled === true;
    const aiProvider = (settings?.ai?.provider ?? 'openai') as AIProviderId;
    const prioritiesEnabled = settings?.features?.priorities === true;
    const timeEstimatesEnabled = settings?.features?.timeEstimates === true;
    const activePriorities = useMemo(
        () => (prioritiesEnabled ? selectedPriorities : EMPTY_PRIORITIES),
        [prioritiesEnabled, selectedPriorities]
    );
    const activeTimeEstimates = useMemo(
        () => (timeEstimatesEnabled ? selectedTimeEstimates : EMPTY_ESTIMATES),
        [timeEstimatesEnabled, selectedTimeEstimates]
    );

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setMultiSelectedIds(new Set());
    }, []);

    // Inbox processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingTask, setProcessingTask] = useState<Task | null>(null);
    const [processingStep, setProcessingStep] = useState<ProcessingStep>('actionable');
    const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
    const [waitingNote, setWaitingNote] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [processingTitle, setProcessingTitle] = useState('');
    const [processingDescription, setProcessingDescription] = useState('');
    const [convertToProject, setConvertToProject] = useState(false);
    const [projectTitleDraft, setProjectTitleDraft] = useState('');
    const [nextActionDraft, setNextActionDraft] = useState('');

    const allContexts = useMemo(() => {
        const taskContexts = tasks.flatMap(t => t.contexts || []);
        return Array.from(new Set([...PRESET_CONTEXTS, ...taskContexts])).sort();
    }, [tasks]);
    const allTags = useMemo(() => {
        const taskTags = tasks.flatMap(t => t.tags || []);
        return Array.from(new Set([...PRESET_TAGS, ...taskTags])).sort();
    }, [tasks]);
    const allTokens = useMemo(() => {
        return Array.from(new Set([...allContexts, ...allTags])).sort();
    }, [allContexts, allTags]);
    const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

    useEffect(() => {
        setAiKey(loadAIKey(aiProvider));
    }, [aiProvider]);

    const copilotAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!aiEnabled || !aiKey) {
            setCopilotSuggestion(null);
            return;
        }
        const title = newTaskTitle.trim();
        if (title.length < 4) {
            setCopilotSuggestion(null);
            return;
        }
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                const provider = createAIProvider(buildCopilotConfig(settings, aiKey));
                if (copilotAbortRef.current) copilotAbortRef.current.abort();
                const abortController = typeof AbortController === 'function' ? new AbortController() : null;
                copilotAbortRef.current = abortController;
                const suggestion = await provider.predictMetadata(
                    { title, contexts: allContexts, tags: allTags },
                    abortController ? { signal: abortController.signal } : undefined
                );
                if (cancelled) return;
                if (!suggestion.context && !suggestion.tags?.length) {
                    setCopilotSuggestion(null);
                } else {
                    setCopilotSuggestion({ context: suggestion.context, tags: suggestion.tags });
                }
            } catch {
                if (!cancelled) setCopilotSuggestion(null);
            }
        }, 800);
        return () => {
            cancelled = true;
            clearTimeout(handle);
            if (copilotAbortRef.current) {
                copilotAbortRef.current.abort();
                copilotAbortRef.current = null;
            }
        };
    }, [aiEnabled, aiKey, newTaskTitle, allContexts, allTags, settings]);

    const projectMap = useMemo(() => {
        return projects.reduce((acc, project) => {
            acc[project.id] = project;
            return acc;
        }, {} as Record<string, Project>);
    }, [projects]);

    const filteredProjects = useMemo(() => {
        if (!projectSearch.trim()) return projects;
        const query = projectSearch.trim().toLowerCase();
        return projects.filter((project) => project.title.toLowerCase().includes(query));
    }, [projects, projectSearch]);

    const hasExactProjectMatch = useMemo(() => {
        if (!projectSearch.trim()) return false;
        const query = projectSearch.trim().toLowerCase();
        return projects.some((project) => project.title.toLowerCase() === query);
    }, [projects, projectSearch]);

    const tasksById = useMemo(() => {
        return tasks.reduce((acc, task) => {
            acc[task.id] = task;
            return acc;
        }, {} as Record<string, Task>);
    }, [tasks]);

    // For sequential projects, get only the first (oldest) task to show in Next view
    const sequentialProjectFirstTasks = useMemo(() => {
        const sequentialIds = new Set(projects.filter(p => p.isSequential).map((p) => p.id));
        if (sequentialIds.size === 0) return new Set<string>();
        const earliestByProject = new Map<string, Task>();

        for (const task of baseTasks) {
            if (task.deletedAt || task.status !== 'next' || !task.projectId) continue;
            if (!sequentialIds.has(task.projectId)) continue;
            const existing = earliestByProject.get(task.projectId);
            if (!existing || new Date(task.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
                earliestByProject.set(task.projectId, task);
            }
        }

        return new Set(Array.from(earliestByProject.values()).map((task) => task.id));
    }, [baseTasks, projects]);

    useEffect(() => {
        let cancelled = false;
        const status = statusFilter === 'all' ? undefined : statusFilter;
        queryTasks({
            status,
            includeArchived: status === 'archived',
            includeDeleted: false,
        }).then((result) => {
            if (!cancelled) setBaseTasks(result);
        }).catch(() => {
            if (!cancelled) setBaseTasks([]);
        });
        return () => {
            cancelled = true;
        };
    }, [statusFilter, queryTasks, lastDataChangeAt]);

    const filteredTasks = useMemo(() => {
        const now = new Date();
        const filtered = baseTasks.filter(t => {
            // Always filter out soft-deleted tasks
            if (t.deletedAt) return false;

            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            // Respect statusFilter (handled above).

            if (statusFilter === 'inbox') {
                const start = safeParseDate(t.startTime);
                if (start && start > now) return false;
            }
            if (statusFilter === 'next') {
                const start = safeParseDate(t.startTime);
                if (start && start > now) return false;
            }

            // Sequential project filter: for 'next' status, only show first task from sequential projects
            if (statusFilter === 'next' && t.projectId) {
                const project = projectMap[t.projectId];
                if (project?.isSequential) {
                    // Only include if this is the first task
                    if (!sequentialProjectFirstTasks.has(t.id)) return false;
                }
            }


            const taskTokens = [...(t.contexts || []), ...(t.tags || [])];
            if (selectedTokens.length > 0) {
                const matchesAll = selectedTokens.every((token) =>
                    taskTokens.some((taskToken) => matchesHierarchicalToken(token, taskToken))
                );
                if (!matchesAll) return false;
            }
            if (activePriorities.length > 0 && (!t.priority || !activePriorities.includes(t.priority))) return false;
            if (activeTimeEstimates.length > 0 && (!t.timeEstimate || !activeTimeEstimates.includes(t.timeEstimate))) return false;
            return true;
        });

        return sortTasksBy(filtered, sortBy);
    }, [baseTasks, projects, statusFilter, selectedTokens, activePriorities, activeTimeEstimates, sequentialProjectFirstTasks, projectMap, sortBy]);

    useEffect(() => {
        setSelectedIndex(0);
        exitSelectionMode();
    }, [statusFilter, selectedTokens, selectedPriorities, selectedTimeEstimates, prioritiesEnabled, timeEstimatesEnabled, exitSelectionMode]);

    useEffect(() => {
        if (filteredTasks.length === 0) {
            setSelectedIndex(0);
            return;
        }
        if (selectedIndex >= filteredTasks.length) {
            setSelectedIndex(filteredTasks.length - 1);
        }
    }, [filteredTasks.length, selectedIndex]);

    useEffect(() => {
        const task = filteredTasks[selectedIndex];
        if (!task) return;
        const el = document.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null;
        if (el && typeof (el as any).scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest' });
        }
    }, [filteredTasks, selectedIndex]);

    const selectNext = useCallback(() => {
        if (filteredTasks.length === 0) return;
        setSelectedIndex((i) => Math.min(i + 1, filteredTasks.length - 1));
    }, [filteredTasks.length]);

    const selectPrev = useCallback(() => {
        setSelectedIndex((i) => Math.max(i - 1, 0));
    }, []);

    const selectFirst = useCallback(() => {
        setSelectedIndex(0);
    }, []);

    const selectLast = useCallback(() => {
        if (filteredTasks.length > 0) {
            setSelectedIndex(filteredTasks.length - 1);
        }
    }, [filteredTasks.length]);

    const editSelected = useCallback(() => {
        const task = filteredTasks[selectedIndex];
        if (!task) return;
        const editTrigger = document.querySelector(
            `[data-task-id="${task.id}"] [data-task-edit-trigger]`
        ) as HTMLElement | null;
        editTrigger?.focus();
        editTrigger?.click();
    }, [filteredTasks, selectedIndex]);

    const toggleDoneSelected = useCallback(() => {
        const task = filteredTasks[selectedIndex];
        if (!task) return;
        moveTask(task.id, task.status === 'done' ? 'inbox' : 'done');
    }, [filteredTasks, selectedIndex, moveTask]);

    const deleteSelected = useCallback(() => {
        const task = filteredTasks[selectedIndex];
        if (!task) return;
        deleteTask(task.id);
    }, [filteredTasks, selectedIndex, deleteTask]);

    useEffect(() => {
        if (isProcessing) {
            registerTaskListScope(null);
            return;
        }

        registerTaskListScope({
            kind: 'taskList',
            selectNext,
            selectPrev,
            selectFirst,
            selectLast,
            editSelected,
            toggleDoneSelected,
            deleteSelected,
            focusAddInput: () => addInputRef.current?.focus(),
        });

        return () => registerTaskListScope(null);
    }, [
        registerTaskListScope,
        isProcessing,
        selectNext,
        selectPrev,
        selectFirst,
        selectLast,
        editSelected,
        toggleDoneSelected,
        deleteSelected,
    ]);

    const tokenCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks
            .filter(t => !t.deletedAt && (statusFilter === 'all' || t.status === statusFilter))
            .forEach(t => {
                const tokens = new Set([...(t.contexts || []), ...(t.tags || [])]);
                tokens.forEach((token) => {
                    counts[token] = (counts[token] || 0) + 1;
                });
            });
        return counts;
    }, [tasks, statusFilter]);

    const toggleMultiSelect = useCallback((taskId: string) => {
        setMultiSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const selectedIdsArray = useMemo(() => Array.from(multiSelectedIds), [multiSelectedIds]);

    const handleBatchMove = useCallback(async (newStatus: TaskStatus) => {
        if (selectedIdsArray.length === 0) return;
        await batchMoveTasks(selectedIdsArray, newStatus);
        exitSelectionMode();
    }, [batchMoveTasks, selectedIdsArray, exitSelectionMode]);

    const handleBatchDelete = useCallback(async () => {
        if (selectedIdsArray.length === 0) return;
        await batchDeleteTasks(selectedIdsArray);
        exitSelectionMode();
    }, [batchDeleteTasks, selectedIdsArray, exitSelectionMode]);

    const handleBatchAddTag = useCallback(async () => {
        if (selectedIdsArray.length === 0) return;
        setTagPromptIds(selectedIdsArray);
        setTagPromptOpen(true);
    }, [batchUpdateTasks, selectedIdsArray, tasksById, t, exitSelectionMode]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskTitle.trim()) {
            const { title: parsedTitle, props, projectTitle } = parseQuickAdd(newTaskTitle, projects);
            const finalTitle = parsedTitle || newTaskTitle;
            const initialProps: Partial<Task> = { ...props };
            if (!initialProps.projectId && projectTitle) {
                const created = await addProject(projectTitle, '#94a3b8');
                initialProps.projectId = created.id;
            }
            // Only set status if we have an explicit filter and parser didn't set one
            if (!initialProps.status && statusFilter !== 'all') {
                initialProps.status = statusFilter;
            }
            if (copilotContext) {
                const existing = initialProps.contexts ?? [];
                initialProps.contexts = Array.from(new Set([...existing, copilotContext]));
            }
            if (copilotTags.length) {
                const existingTags = initialProps.tags ?? [];
                initialProps.tags = Array.from(new Set([...existingTags, ...copilotTags]));
            }
            await addTask(finalTitle, initialProps);
            setNewTaskTitle('');
            setCopilotSuggestion(null);
            setCopilotApplied(false);
            setCopilotContext(null);
            setCopilotTags([]);
        }
    };

    // Inbox processing handlers
    const startProcessing = () => {
        const inboxTasks = tasks.filter(t => t.status === 'inbox');
        if (inboxTasks.length > 0) {
            const nextTask = inboxTasks[0];
            setProcessingTask(nextTask);
            setProcessingStep('refine');
            setSelectedContexts([]);
            setCustomContext('');
            setProjectSearch('');
            setProcessingTitle(nextTask.title);
            setProcessingDescription(nextTask.description || '');
            setConvertToProject(false);
            setProjectTitleDraft(nextTask.title);
            setNextActionDraft('');
            setIsProcessing(true);
        }
    };

    const processNext = () => {
        // Exclude the current task being processed (its status may not have updated in state yet)
        const currentTaskId = processingTask?.id;
        const inboxTasks = tasks.filter(t => t.status === 'inbox' && t.id !== currentTaskId);
        if (inboxTasks.length > 0) {
            const nextTask = inboxTasks[0];
            setProcessingTask(nextTask);
            setProcessingStep('refine');
            setSelectedContexts([]);
            setCustomContext('');
            setProjectSearch('');
            setProcessingTitle(nextTask.title);
            setProcessingDescription(nextTask.description || '');
            setConvertToProject(false);
            setProjectTitleDraft(nextTask.title);
            setNextActionDraft('');
        } else {
            setIsProcessing(false);
            setProcessingTask(null);
            setSelectedContexts([]);
        }
    };

    const applyProcessingEdits = (updates: Partial<Task>) => {
        if (!processingTask) return;
        const trimmedTitle = processingTitle.trim();
        const title = trimmedTitle.length > 0 ? trimmedTitle : processingTask.title;
        const description = processingDescription.trim();
        updateTask(processingTask.id, {
            title,
            description: description.length > 0 ? description : undefined,
            ...updates,
        });
    };

    const handleNotActionable = (action: 'trash' | 'someday') => {
        if (!processingTask) return;
        if (action === 'trash') {
            deleteTask(processingTask.id);
        } else {
            applyProcessingEdits({ status: 'someday' });
        }
        processNext();
    };

    const handleActionable = () => setProcessingStep('twomin');

    const handleTwoMinDone = () => {
        if (processingTask) {
            applyProcessingEdits({ status: 'done' });
        }
        processNext();
    };

    const handleTwoMinNo = () => setProcessingStep('decide');

    const handleDelegate = () => {
        setWaitingNote('');
        setProcessingStep('waiting-note');
    };

    const handleConfirmWaiting = () => {
        if (processingTask) {
            const description = waitingNote.trim().length > 0 ? waitingNote : processingDescription;
            applyProcessingEdits({
                status: 'waiting',
                description: description.trim().length > 0 ? description : undefined,
            });
        }
        setWaitingNote('');
        processNext();
    };

    const handleDefer = () => {
        setSelectedContexts([]);
        setProcessingStep('context');
    };

    const toggleContext = (ctx: string) => {
        setSelectedContexts(prev =>
            prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
        );
    };

    const addCustomContext = () => {
        if (customContext.trim()) {
            const ctx = `@${customContext.trim().replace(/^@/, '')}`;
            if (!selectedContexts.includes(ctx)) {
                setSelectedContexts(prev => [...prev, ctx]);
            }
            setCustomContext('');
        }
    };

    const handleConfirmContexts = () => {
        setProcessingStep('project');
    };

    const handleSetProject = (projectId: string | null) => {
        if (processingTask) {
            applyProcessingEdits({
                status: 'next',
                contexts: selectedContexts,
                projectId: projectId || undefined
            });
        }
        processNext();
    };

    const handleConvertToProject = async () => {
        if (!processingTask) return;
        const projectTitle = projectTitleDraft.trim() || processingTitle.trim();
        const nextAction = nextActionDraft.trim();
        if (!projectTitle) return;
        if (!nextAction) {
            alert(t('process.nextActionRequired'));
            return;
        }
        const existing = projects.find((project) => project.title.toLowerCase() === projectTitle.toLowerCase());
        const project = existing ?? await addProject(projectTitle, '#94a3b8');
        applyProcessingEdits({
            title: nextAction,
            status: 'next',
            contexts: selectedContexts,
            projectId: project.id,
        });
        processNext();
    };

    const showFilters = ['next', 'all'].includes(statusFilter);
    const isInbox = statusFilter === 'inbox';
    const inboxCount = tasks.filter(t => {
        if (t.status !== 'inbox' || t.deletedAt) return false;
        const start = safeParseDate(t.startTime);
        if (start && start > new Date()) return false;
        return true;
    }).length;
    const nextCount = tasks.filter(t => t.status === 'next' && !t.deletedAt).length;
    const isNextView = statusFilter === 'next';
    const NEXT_WARNING_THRESHOLD = 15;
    const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
    const timeEstimateOptions: TimeEstimate[] = ['5min', '10min', '15min', '30min', '1hr', '2hr', '3hr', '4hr', '4hr+'];
    const formatEstimate = (estimate: TimeEstimate) => {
        if (estimate.endsWith('min')) return estimate.replace('min', 'm');
        if (estimate.endsWith('hr+')) return estimate.replace('hr+', 'h+');
        if (estimate.endsWith('hr')) return estimate.replace('hr', 'h');
        return estimate;
    };
    const filterSummary = useMemo(() => {
        return [
            ...selectedTokens,
            ...(prioritiesEnabled ? selectedPriorities.map((priority) => t(`priority.${priority}`)) : []),
            ...(timeEstimatesEnabled ? selectedTimeEstimates.map(formatEstimate) : []),
        ];
    }, [selectedTokens, selectedPriorities, selectedTimeEstimates, prioritiesEnabled, timeEstimatesEnabled, t]);
    const hasFilters = filterSummary.length > 0;
    const filterSummaryLabel = filterSummary.slice(0, 3).join(', ');
    const filterSummarySuffix = filterSummary.length > 3 ? ` +${filterSummary.length - 3}` : '';
    const showFiltersPanel = filtersOpen || hasFilters;
    const toggleTokenFilter = (token: string) => {
        setSelectedTokens((prev) =>
            prev.includes(token) ? prev.filter((item) => item !== token) : [...prev, token]
        );
    };
    const togglePriorityFilter = (priority: TaskPriority) => {
        setSelectedPriorities((prev) =>
            prev.includes(priority) ? prev.filter((item) => item !== priority) : [...prev, priority]
        );
    };
    const toggleTimeFilter = (estimate: TimeEstimate) => {
        setSelectedTimeEstimates((prev) =>
            prev.includes(estimate) ? prev.filter((item) => item !== estimate) : [...prev, estimate]
        );
    };
    const clearFilters = () => {
        setSelectedTokens([]);
        setSelectedPriorities([]);
        setSelectedTimeEstimates([]);
    };

    useEffect(() => {
        if (!prioritiesEnabled && selectedPriorities.length > 0) {
            setSelectedPriorities([]);
        }
    }, [prioritiesEnabled, selectedPriorities.length]);

    useEffect(() => {
        if (!timeEstimatesEnabled && selectedTimeEstimates.length > 0) {
            setSelectedTimeEstimates([]);
        }
    }, [timeEstimatesEnabled, selectedTimeEstimates.length]);

    return (
        <>
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">
                    {title}
                    {isNextView && <span className="ml-2 text-lg font-normal text-muted-foreground">({nextCount})</span>}
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                        {filteredTasks.length} {t('common.tasks')}
                        {hasFilters && (
                            <span className="ml-1 text-primary">• {filterSummaryLabel}{filterSummarySuffix}</span>
                        )}
                    </span>
                    <select
                        value={sortBy}
                        onChange={(e) => updateSettings({ taskSortBy: e.target.value as TaskSortBy })}
                        aria-label={t('sort.label')}
                        className="text-xs bg-muted/50 text-foreground border border-border rounded px-2 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        <option value="default">{t('sort.default')}</option>
                        <option value="due">{t('sort.due')}</option>
                        <option value="start">{t('sort.start')}</option>
                        <option value="review">{t('sort.review')}</option>
                        <option value="title">{t('sort.title')}</option>
                        <option value="created">{t('sort.created')}</option>
                        <option value="created-desc">{t('sort.created-desc')}</option>
                    </select>
                    <button
                        onClick={() => {
                            if (selectionMode) exitSelectionMode();
                            else setSelectionMode(true);
                        }}
                        className={cn(
                            "text-xs px-3 py-1 rounded-md border transition-colors",
                            selectionMode
                                ? "bg-primary/10 text-primary border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {selectionMode ? t('bulk.exitSelect') : t('bulk.select')}
                    </button>
                </div>
            </header>

            {selectionMode && selectedIdsArray.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-3">
                    <span className="text-sm text-muted-foreground">
                        {selectedIdsArray.length} {t('bulk.selected')}
                    </span>
                    <div className="flex items-center gap-2">
                        {(['inbox', 'next', 'waiting', 'someday', 'done'] as TaskStatus[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => handleBatchMove(status)}
                                className="text-xs px-2 py-1 rounded bg-muted/50 hover:bg-muted transition-colors"
                            >
                                {t(`status.${status}`)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleBatchAddTag}
                        className="text-xs px-2 py-1 rounded bg-muted/50 hover:bg-muted transition-colors"
                    >
                        {t('bulk.addTag')}
                    </button>
                    <button
                        onClick={handleBatchDelete}
                        className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                        {t('bulk.delete')}
                    </button>
                </div>
            )}

            {/* Next Actions Warning */}
            {isNextView && nextCount > NEXT_WARNING_THRESHOLD && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-amber-500 text-xl">⚠️</span>
                    <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400">
                            {nextCount} {t('next.warningCount')}
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                            {t('next.warningHint')}
                        </p>
                    </div>
                </div>
            )}

            {/* Inbox Processing Bar */}
            {isInbox && inboxCount > 0 && !isProcessing && (
                <button
                    onClick={startProcessing}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    <Play className="w-4 h-4" />
                    {t('process.btn')} ({inboxCount})
                </button>
            )}

            {/* Inbox Processing Wizard */}
            {isProcessing && processingTask && (
                <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">📋 {t('process.title')}</h3>
                        <button
                            onClick={() => setIsProcessing(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {processingStep === 'refine' ? (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{t('taskEdit.titleLabel')}</label>
                                <input
                                    autoFocus
                                    value={processingTitle}
                                    onChange={(e) => setProcessingTitle(e.target.value)}
                                    className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{t('taskEdit.descriptionLabel')}</label>
                                <textarea
                                    value={processingDescription}
                                    onChange={(e) => setProcessingDescription(e.target.value)}
                                    placeholder={t('taskEdit.descriptionPlaceholder')}
                                    className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                            <p className="font-medium">{processingTitle || processingTask.title}</p>
                            {processingDescription && (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{processingDescription}</p>
                            )}
                        </div>
                    )}

                    {processingStep === 'refine' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.refineTitle')}</p>
                            <p className="text-center text-sm text-muted-foreground">{t('process.refineDesc')}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setProcessingStep('actionable')}
                                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90"
                                >
                                    {t('process.refineNext')}
                                </button>
                                <button
                                    onClick={() => handleNotActionable('trash')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-3 rounded-lg font-medium hover:bg-destructive/20"
                                >
                                    <Trash2 className="w-4 h-4" /> {t('process.refineDelete')}
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'actionable' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.actionable')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.actionableDesc')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleActionable}
                                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90"
                                >
                                    {t('process.yesActionable')}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center pt-2">{t('process.ifNotActionable')}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleNotActionable('trash')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-2 rounded-lg font-medium hover:bg-destructive/20"
                                >
                                    <Trash2 className="w-4 h-4" /> {t('process.trash')}
                                </button>
                                <button
                                    onClick={() => handleNotActionable('someday')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-purple-500/10 text-purple-600 py-2 rounded-lg font-medium hover:bg-purple-500/20"
                                >
                                    <Moon className="w-4 h-4" /> {t('process.someday')}
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'twomin' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.twoMin')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.twoMinDesc')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleTwoMinDone}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600"
                                >
                                    <CheckCircle className="w-4 h-4" /> {t('process.doneIt')}
                                </button>
                                <button
                                    onClick={handleTwoMinNo}
                                    className="flex-1 bg-muted py-3 rounded-lg font-medium hover:bg-muted/80"
                                >
                                    {t('process.takesLonger')}
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'decide' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.nextStep')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.nextStepDesc')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDefer}
                                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90"
                                >
                                    {t('process.doIt')}
                                </button>
                                <button
                                    onClick={handleDelegate}
                                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600"
                                >
                                    <User className="w-4 h-4" /> {t('process.delegate')}
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'waiting-note' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">👤 {t('process.waitingFor')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.waitingForDesc')}
                            </p>
                            <textarea
                                value={waitingNote}
                                onChange={(e) => setWaitingNote(e.target.value)}
                                placeholder={t('process.waitingPlaceholder')}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-primary resize-none"
                                rows={3}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={handleConfirmWaiting}
                                    className="flex-1 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80"
                                >
                                    {t('common.skip')}
                                </button>
                                <button
                                    onClick={handleConfirmWaiting}
                                    className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                                >
                                    ✓ {t('common.done')}
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'context' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.context')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.contextDesc')} {t('process.selectMultipleHint')}
                            </p>

                            {/* Selected contexts display */}
                            {selectedContexts.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center p-3 bg-primary/10 rounded-lg">
                                    <span className="text-xs text-primary font-medium">{t('process.selectedLabel')}</span>
                                    {selectedContexts.map(ctx => (
                                        <span key={ctx} className="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs">
                                            {ctx}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Custom context input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={t('process.newContextPlaceholder')}
                                    value={customContext}
                                    onChange={(e) => setCustomContext(e.target.value)}
                                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addCustomContext();
                                        }
                                    }}
                                />
                                <button
                                    onClick={addCustomContext}
                                    disabled={!customContext.trim()}
                                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>

                            {/* Existing contexts - toggle selection */}
                            {allContexts.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {allContexts.map(ctx => (
                                        <button
                                            key={ctx}
                                            onClick={() => toggleContext(ctx)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedContexts.includes(ctx)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted hover:bg-muted/80'
                                                }`}
                                        >
                                            {ctx}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Next button - go to project step */}
                            <button
                                onClick={handleConfirmContexts}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                            >
                                {selectedContexts.length > 0
                                    ? `${t('process.next')} → (${selectedContexts.length})`
                                    : `${t('process.next')} → (${t('process.noContext')})`}
                            </button>
                        </div>
                    )}

                    {processingStep === 'project' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">{t('process.project')}</p>
                            <p className="text-center text-sm text-muted-foreground">
                                {t('process.projectDesc')}
                            </p>

                            <div className="flex flex-wrap gap-2 justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!convertToProject) {
                                            setProjectTitleDraft(processingTitle);
                                            setNextActionDraft('');
                                        }
                                        setConvertToProject(!convertToProject);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                        convertToProject
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    )}
                                >
                                    {convertToProject ? t('process.useExistingProject') : t('process.makeProject')}
                                </button>
                            </div>

                            {convertToProject ? (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">{t('projects.title')}</label>
                                        <input
                                            value={projectTitleDraft}
                                            onChange={(e) => setProjectTitleDraft(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">{t('process.nextAction')}</label>
                                        <input
                                            value={nextActionDraft}
                                            onChange={(e) => setNextActionDraft(e.target.value)}
                                            placeholder={t('taskEdit.titleLabel')}
                                            className="w-full bg-card border border-border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleConvertToProject}
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                                    >
                                        {t('process.createProject')}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <input
                                            value={projectSearch}
                                            onChange={(e) => setProjectSearch(e.target.value)}
                                            onKeyDown={async (e) => {
                                                if (e.key !== 'Enter') return;
                                                if (!projectSearch.trim()) return;
                                                e.preventDefault();
                                                const title = projectSearch.trim();
                                                const existing = projects.find((project) => project.title.toLowerCase() === title.toLowerCase());
                                                if (existing) {
                                                    handleSetProject(existing.id);
                                                    return;
                                                }
                                                const created = await addProject(title, '#94a3b8');
                                                handleSetProject(created.id);
                                                setProjectSearch('');
                                            }}
                                            placeholder={t('projects.addPlaceholder')}
                                            className="w-full bg-card border border-border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                        {!hasExactProjectMatch && projectSearch.trim() && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const title = projectSearch.trim();
                                                    if (!title) return;
                                                    const created = await addProject(title, '#94a3b8');
                                                    handleSetProject(created.id);
                                                    setProjectSearch('');
                                                }}
                                                className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                                            >
                                                {t('projects.create')} "{projectSearch.trim()}"
                                            </button>
                                        )}
                                    </div>

                                    {/* No project option */}
                                    <button
                                        onClick={() => handleSetProject(null)}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                                    >
                                        ✓ {t('process.noProject')}
                                    </button>

                                    {/* Project list */}
                                    {filteredProjects.length > 0 && (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {filteredProjects.map(project => (
                                                <button
                                                    key={project.id}
                                                    onClick={() => handleSetProject(project.id)}
                                                    className="w-full flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 text-left"
                                                >
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: (project.areaId ? areaById.get(project.areaId)?.color : undefined) || '#6B7280' }}
                                                    />
                                                    <span>{project.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-center text-muted-foreground pt-2">
                        {tasks.filter(t => t.status === 'inbox').length} {t('process.remaining')}
                    </p>
                </div>
            )}

            {/* Filters */}
            {showFilters && !isProcessing && (
                <div className="bg-card border border-border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Filter className="w-4 h-4" />
                            {t('filters.label')}
                        </div>
                        <div className="flex items-center gap-2">
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {t('filters.clear')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setFiltersOpen((prev) => !prev)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showFiltersPanel ? t('filters.hide') : t('filters.show')}
                            </button>
                        </div>
                    </div>
                    {showFiltersPanel && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('filters.contexts')}</div>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {allTokens.map((token) => {
                                        const isActive = selectedTokens.includes(token);
                                        return (
                                            <button
                                                key={token}
                                                type="button"
                                                onClick={() => toggleTokenFilter(token)}
                                                aria-pressed={isActive}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                                    isActive
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                )}
                                            >
                                                {token}
                                                {tokenCounts[token] > 0 && (
                                                    <span className="ml-1 opacity-70">({tokenCounts[token]})</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {prioritiesEnabled && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('filters.priority')}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {priorityOptions.map((priority) => {
                                            const isActive = selectedPriorities.includes(priority);
                                            return (
                                                <button
                                                    key={priority}
                                                    type="button"
                                                    onClick={() => togglePriorityFilter(priority)}
                                                    aria-pressed={isActive}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                                        isActive
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                    )}
                                                >
                                                    {t(`priority.${priority}`)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {timeEstimatesEnabled && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('filters.timeEstimate')}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {timeEstimateOptions.map((estimate) => {
                                            const isActive = selectedTimeEstimates.includes(estimate);
                                            return (
                                                <button
                                                    key={estimate}
                                                    type="button"
                                                    onClick={() => toggleTimeFilter(estimate)}
                                                    aria-pressed={isActive}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                                        isActive
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                    )}
                                                >
                                                    {formatEstimate(estimate)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Only show add task for inbox/next - other views are read-only */}
            {['inbox', 'next'].includes(statusFilter) && (
                <form onSubmit={handleAddTask} className="relative">
                    <TaskInput
                        inputRef={addInputRef}
                        value={newTaskTitle}
                        projects={projects}
                        contexts={allContexts}
                        onCreateProject={async (title) => {
                            const created = await addProject(title, '#94a3b8');
                            return created.id;
                        }}
                        onChange={(next) => {
                            setNewTaskTitle(next);
                            setCopilotApplied(false);
                            setCopilotContext(null);
                            setCopilotTags([]);
                        }}
                        placeholder={`${t('nav.addTask')}... ${t('quickAdd.example')}`}
                        className="w-full bg-card border border-border rounded-lg py-3 pl-4 pr-12 shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!newTaskTitle.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </form>
            )}
            {['inbox', 'next'].includes(statusFilter) && aiEnabled && copilotSuggestion && !copilotApplied && (
                <button
                    type="button"
                    onClick={() => {
                        setCopilotContext(copilotSuggestion.context ?? null);
                        setCopilotTags(copilotSuggestion.tags ?? []);
                        setCopilotApplied(true);
                    }}
                    className="mt-2 text-xs px-2 py-1 rounded bg-muted/30 border border-border text-muted-foreground hover:bg-muted/60 transition-colors text-left"
                >
                    ✨ {t('copilot.suggested')}{' '}
                    {copilotSuggestion.context ? `${copilotSuggestion.context} ` : ''}
                    {copilotSuggestion.tags?.length ? copilotSuggestion.tags.join(' ') : ''}
                    <span className="ml-2 text-muted-foreground/70">{t('copilot.applyHint')}</span>
                </button>
            )}
            {['inbox', 'next'].includes(statusFilter) && aiEnabled && copilotApplied && (
                <div className="mt-2 text-xs px-2 py-1 rounded bg-muted/30 border border-border text-muted-foreground">
                    ✅ {t('copilot.applied')}{' '}
                    {copilotContext ? `${copilotContext} ` : ''}
                    {copilotTags.length ? copilotTags.join(' ') : ''}
                </div>
            )}
            {['inbox', 'next'].includes(statusFilter) && !isProcessing && (
                <p className="text-xs text-muted-foreground">
                    {t('quickAdd.help')}
                </p>
            )}

            <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>
                            {hasFilters ? t('filters.noMatch') : t('list.noTasks') || `${t('contexts.noTasks')}`}
                        </p>
                    </div>
                ) : (
	                    filteredTasks.map((task, index) => (
	                        <TaskItem
	                            key={task.id}
	                            task={task}
	                            project={task.projectId ? projectMap[task.projectId] : undefined}
	                            isSelected={index === selectedIndex}
	                            onSelect={() => {
	                                if (!selectionMode) setSelectedIndex(index);
	                            }}
	                            selectionMode={selectionMode}
	                            isMultiSelected={multiSelectedIds.has(task.id)}
	                            onToggleSelect={() => toggleMultiSelect(task.id)}
	                        />
	                    ))
	                )}
            </div>
        </div>
        <PromptModal
            isOpen={tagPromptOpen}
            title={t('bulk.addTag')}
            description={t('bulk.addTag')}
            placeholder="#tag"
            defaultValue=""
            confirmLabel={t('common.save')}
            cancelLabel={t('common.cancel')}
            onCancel={() => setTagPromptOpen(false)}
            onConfirm={async (value) => {
                const input = value.trim();
                if (!input) return;
                const tag = input.startsWith('#') ? input : `#${input}`;
                await batchUpdateTasks(tagPromptIds.map((id) => {
                    const task = tasksById[id];
                    const existingTags = task?.tags || [];
                    const nextTags = Array.from(new Set([...existingTags, tag]));
                    return { id, updates: { tags: nextTags } };
                }));
                setTagPromptOpen(false);
                exitSelectionMode();
            }}
        />
        </>
    );
}
