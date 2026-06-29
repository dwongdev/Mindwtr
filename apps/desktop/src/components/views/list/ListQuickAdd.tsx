import type { FormEvent, RefObject } from 'react';
import type { Area, Project } from '@mindwtr/core';
import { Mic, Plus } from 'lucide-react';
import { TaskInput } from '../../Task/TaskInput';
import { FocusStarIcon } from '../../FocusStarIcon';
import { cn } from '../../../lib/utils';

type ListQuickAddProps = {
    t: (key: string) => string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onOpenAudio: () => void;
    onCreateProject: (title: string) => Promise<string | null>;
    inputRef: RefObject<HTMLInputElement | null>;
    projects: Project[];
    areas: Area[];
    contexts: string[];
    onResetCopilot: () => void;
    focusNewTask: boolean;
    canFocusNewTask: boolean;
    focusNewTaskDisabledReason?: string;
    onToggleFocusNewTask: () => void;
    dense?: boolean;
};

export function ListQuickAdd({
    t,
    value,
    onChange,
    onSubmit,
    onOpenAudio,
    onCreateProject,
    inputRef,
    projects,
    areas,
    contexts,
    onResetCopilot,
    focusNewTask,
    canFocusNewTask,
    focusNewTaskDisabledReason,
    onToggleFocusNewTask,
    dense = false,
}: ListQuickAddProps) {
    const iconButtonClass = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    const focusDisabled = !focusNewTask && !canFocusNewTask;
    const focusLabel = focusNewTask
        ? t('agenda.removeFromFocus')
        : (focusDisabled ? (focusNewTaskDisabledReason || t('agenda.addToFocus')) : t('agenda.addToFocus'));

    return (
        <form onSubmit={onSubmit} className="relative">
            <TaskInput
                inputRef={inputRef}
                value={value}
                projects={projects}
                contexts={contexts}
                areas={areas}
                onCreateProject={onCreateProject}
                onChange={(next) => {
                    onChange(next);
                    onResetCopilot();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        inputRef.current?.blur();
                    }
                }}
                placeholder={`${t('nav.addTask')}... ${t('quickAdd.example')}`}
                className={cn(
                    "w-full rounded-lg border border-border bg-card shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/30",
                    dense ? "py-2 pl-3 pr-36 text-sm" : "py-3 pl-4 pr-36"
                )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggleFocusNewTask}
                    disabled={focusDisabled}
                    className={cn(
                        iconButtonClass,
                        focusNewTask
                            ? "border-amber-400/70 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                        focusDisabled && "cursor-not-allowed opacity-50 hover:bg-muted/50 hover:text-muted-foreground"
                    )}
                    aria-label={focusLabel}
                    aria-pressed={focusNewTask}
                    title={focusLabel}
                >
                    <FocusStarIcon filled={focusNewTask} className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={onOpenAudio}
                    className={cn(iconButtonClass, "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}
                    aria-label={t('quickAdd.audioCaptureLabel')}
                >
                    <Mic className="w-4 h-4" />
                </button>
                <button
                    type="submit"
                    disabled={!value.trim()}
                    className={cn(iconButtonClass, "border-primary bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50")}
                    aria-label={t('common.add')}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </form>
    );
}
