import React, { useState, useMemo } from 'react';
import { Plus, Play, X, Trash2, Moon, User, CheckCircle } from 'lucide-react';
import { useTaskStore, TaskStatus, Task } from '@focus-gtd/core';
import { TaskItem } from '../TaskItem';
import { cn } from '../../lib/utils';

// GTD preset contexts
const PRESET_CONTEXTS = ['@home', '@work', '@errands', '@computer', '@phone', '@anywhere'];

interface ListViewProps {
    title: string;
    statusFilter: TaskStatus | 'all';
}

type ProcessingStep = 'actionable' | 'twomin' | 'decide' | 'context';

export function ListView({ title, statusFilter }: ListViewProps) {
    const { tasks, addTask, updateTask, deleteTask, moveTask } = useTaskStore();
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedContext, setSelectedContext] = useState<string | null>(null);

    // Inbox processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingTask, setProcessingTask] = useState<Task | null>(null);
    const [processingStep, setProcessingStep] = useState<ProcessingStep>('actionable');

    // Get all unique contexts (merge presets with task contexts)
    const allContexts = useMemo(() => {
        const taskContexts = tasks.flatMap(t => t.contexts || []);
        return Array.from(new Set([...PRESET_CONTEXTS, ...taskContexts])).sort();
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (selectedContext && !t.contexts?.includes(selectedContext)) return false;
            return true;
        });
    }, [tasks, statusFilter, selectedContext]);

    const contextCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.filter(t => statusFilter === 'all' || t.status === statusFilter).forEach(t => {
            (t.contexts || []).forEach(ctx => {
                counts[ctx] = (counts[ctx] || 0) + 1;
            });
        });
        return counts;
    }, [tasks, statusFilter]);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskTitle.trim()) {
            addTask(newTaskTitle);
            setNewTaskTitle('');
        }
    };

    // Inbox processing handlers
    const startProcessing = () => {
        const inboxTasks = tasks.filter(t => t.status === 'inbox');
        if (inboxTasks.length > 0) {
            setProcessingTask(inboxTasks[0]);
            setProcessingStep('actionable');
            setIsProcessing(true);
        }
    };

    const processNext = () => {
        const inboxTasks = tasks.filter(t => t.status === 'inbox');
        if (inboxTasks.length > 0) {
            setProcessingTask(inboxTasks[0]);
            setProcessingStep('actionable');
        } else {
            setIsProcessing(false);
            setProcessingTask(null);
        }
    };

    const handleNotActionable = (action: 'trash' | 'someday') => {
        if (!processingTask) return;
        if (action === 'trash') {
            deleteTask(processingTask.id);
        } else {
            moveTask(processingTask.id, 'someday');
        }
        processNext();
    };

    const handleActionable = () => setProcessingStep('twomin');

    const handleTwoMinDone = () => {
        if (processingTask) {
            moveTask(processingTask.id, 'done');
        }
        processNext();
    };

    const handleTwoMinNo = () => setProcessingStep('decide');

    const handleDelegate = () => {
        if (processingTask) {
            moveTask(processingTask.id, 'waiting');
        }
        processNext();
    };

    const handleDefer = () => setProcessingStep('context');

    const handleSetContext = (context: string | null) => {
        if (processingTask) {
            updateTask(processingTask.id, {
                status: 'next',
                contexts: context ? [context] : []
            });
        }
        processNext();
    };

    const showContextFilter = ['next', 'todo', 'all'].includes(statusFilter);
    const isInbox = statusFilter === 'inbox';
    const inboxCount = tasks.filter(t => t.status === 'inbox').length;

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                <span className="text-muted-foreground text-sm">
                    {filteredTasks.length} tasks
                    {selectedContext && <span className="ml-1 text-primary">• {selectedContext}</span>}
                </span>
            </header>

            {/* Inbox Processing Bar */}
            {isInbox && inboxCount > 0 && !isProcessing && (
                <button
                    onClick={startProcessing}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    <Play className="w-4 h-4" />
                    Process Inbox ({inboxCount} items)
                </button>
            )}

            {/* Inbox Processing Wizard */}
            {isProcessing && processingTask && (
                <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">📋 Process Item</h3>
                        <button
                            onClick={() => setIsProcessing(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                        <p className="font-medium">{processingTask.title}</p>
                    </div>

                    {processingStep === 'actionable' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">Is this actionable?</p>
                            <p className="text-center text-sm text-muted-foreground">
                                Can you take a physical action on this?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleActionable}
                                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90"
                                >
                                    ✅ Yes, it's actionable
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center pt-2">If not actionable:</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleNotActionable('trash')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-2 rounded-lg font-medium hover:bg-destructive/20"
                                >
                                    <Trash2 className="w-4 h-4" /> Trash
                                </button>
                                <button
                                    onClick={() => handleNotActionable('someday')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-purple-500/10 text-purple-600 py-2 rounded-lg font-medium hover:bg-purple-500/20"
                                >
                                    <Moon className="w-4 h-4" /> Someday
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'twomin' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">⏱️ Will it take less than 2 minutes?</p>
                            <p className="text-center text-sm text-muted-foreground">
                                If yes, do it now!
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleTwoMinDone}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600"
                                >
                                    <CheckCircle className="w-4 h-4" /> Done it!
                                </button>
                                <button
                                    onClick={handleTwoMinNo}
                                    className="flex-1 bg-muted py-3 rounded-lg font-medium hover:bg-muted/80"
                                >
                                    Takes longer
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'decide' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">What's next?</p>
                            <p className="text-center text-sm text-muted-foreground">
                                Should you do it, or delegate it?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDefer}
                                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90"
                                >
                                    📋 I'll do it
                                </button>
                                <button
                                    onClick={handleDelegate}
                                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600"
                                >
                                    <User className="w-4 h-4" /> Delegate
                                </button>
                            </div>
                        </div>
                    )}

                    {processingStep === 'context' && (
                        <div className="space-y-4">
                            <p className="text-center font-medium">Where will you do this?</p>
                            <p className="text-center text-sm text-muted-foreground">
                                Add a context to find it later
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <button
                                    onClick={() => handleSetContext(null)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90"
                                >
                                    Skip & Add to Next
                                </button>
                                {PRESET_CONTEXTS.map(ctx => (
                                    <button
                                        key={ctx}
                                        onClick={() => handleSetContext(ctx)}
                                        className="px-4 py-2 bg-muted rounded-full text-sm font-medium hover:bg-muted/80"
                                    >
                                        {ctx}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-center text-muted-foreground pt-2">
                        {tasks.filter(t => t.status === 'inbox').length} items remaining
                    </p>
                </div>
            )}

            {/* Context Filter Bar */}
            {showContextFilter && !isProcessing && (
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setSelectedContext(null)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                            selectedContext === null
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        )}
                    >
                        All
                    </button>
                    {allContexts.map(context => (
                        <button
                            key={context}
                            onClick={() => setSelectedContext(context)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                                selectedContext === context
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            )}
                        >
                            {context}
                            {contextCounts[context] > 0 && (
                                <span className="ml-1 opacity-70">({contextCounts[context]})</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={handleAddTask} className="relative">
                <input
                    type="text"
                    placeholder={`Add a task to ${title}...`}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
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

            <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>
                            {selectedContext
                                ? `No tasks with ${selectedContext} in ${title}.`
                                : `No tasks found in ${title}.`}
                        </p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                    ))
                )}
            </div>
        </div>
    );
}
