import { parseQuickAdd, type Project as CoreProject } from '@mindwtr/core';

import { closeDb, openMindwtrDb, type DbOptions } from './db.js';
import {
  getTask,
  listProjects,
  listTasks,
  type AddTaskInput,
  type GetTaskInput,
  type ListTasksInput,
  type Project,
  type Task,
  type TaskRow,
  type UpdateTaskInput,
} from './queries.js';
import { runCoreService } from './core-adapter.js';

const filterUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
};

const withDb = async <T>(
  options: DbOptions,
  fn: (db: Awaited<ReturnType<typeof openMindwtrDb>>['db']) => T,
): Promise<T> => {
  const { db } = await openMindwtrDb(options);
  try {
    return await fn(db);
  } finally {
    closeDb(db);
  }
};

const buildTaskUpdates = (input: UpdateTaskInput): Partial<Task> => {
  const updates: Partial<Task> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.status !== undefined) updates.status = input.status as any;
  if (input.projectId !== undefined) updates.projectId = input.projectId ?? undefined;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate ?? undefined;
  if (input.startTime !== undefined) updates.startTime = input.startTime ?? undefined;
  if (input.contexts !== undefined) updates.contexts = input.contexts ?? [];
  if (input.tags !== undefined) updates.tags = input.tags ?? [];
  if (input.description !== undefined) updates.description = input.description ?? undefined;
  if (input.priority !== undefined) updates.priority = input.priority ?? undefined;
  if (input.timeEstimate !== undefined) updates.timeEstimate = input.timeEstimate ?? undefined;
  if (input.reviewAt !== undefined) updates.reviewAt = input.reviewAt ?? undefined;
  if (input.isFocusedToday !== undefined) updates.isFocusedToday = input.isFocusedToday;
  return updates;
};

export type MindwtrService = {
  listTasks: (input: ListTasksInput) => Promise<TaskRow[]>;
  listProjects: () => Promise<Project[]>;
  getTask: (input: GetTaskInput) => Promise<TaskRow>;
  addTask: (input: AddTaskInput) => Promise<Task>;
  updateTask: (input: UpdateTaskInput) => Promise<Task>;
  completeTask: (id: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<Task>;
  restoreTask: (id: string) => Promise<Task>;
};

export const createService = (options: DbOptions): MindwtrService => ({
  listTasks: async (input) => withDb(options, (db) => listTasks(db, input)),
  listProjects: async () => withDb(options, (db) => listProjects(db)),
  getTask: async (input) => withDb(options, (db) => getTask(db, input)),
  addTask: async (input) =>
    runCoreService(options, async (core) => {
      if (input.quickAdd) {
        const projects = await withDb(options, (db) => listProjects(db));
        const quick = parseQuickAdd(input.quickAdd, projects as CoreProject[]);
        const title = input.title ?? quick.title ?? input.quickAdd;
        const props = filterUndefined({
          ...quick.props,
          status: (input.status as any) ?? quick.props.status,
          projectId: input.projectId ?? quick.props.projectId,
          dueDate: input.dueDate ?? quick.props.dueDate,
          startTime: input.startTime ?? quick.props.startTime,
          contexts: input.contexts ?? quick.props.contexts,
          tags: input.tags ?? quick.props.tags,
          description: input.description ?? quick.props.description,
          priority: input.priority ?? quick.props.priority,
          timeEstimate: input.timeEstimate ?? quick.props.timeEstimate,
        });
        return core.addTask({ title, props });
      }
      return core.addTask({
        title: input.title ?? '',
        props: filterUndefined({
          status: input.status as any,
          projectId: input.projectId,
          dueDate: input.dueDate,
          startTime: input.startTime,
          contexts: input.contexts,
          tags: input.tags,
          description: input.description,
          priority: input.priority,
          timeEstimate: input.timeEstimate,
        }),
      });
    }),
  updateTask: async (input) =>
    runCoreService(options, async (core) => {
      return core.updateTask({
        id: input.id,
        updates: buildTaskUpdates(input),
      });
    }),
  completeTask: async (id) => runCoreService(options, (core) => core.completeTask(id)),
  deleteTask: async (id) => runCoreService(options, (core) => core.deleteTask(id)),
  restoreTask: async (id) => runCoreService(options, (core) => core.restoreTask(id)),
});
