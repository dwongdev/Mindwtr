import { useEffect, useRef } from 'react';

import { useTaskStore } from '@mindwtr/core';

import {
  buildContextAutomationNotificationCopy,
  CONTEXT_AUTOMATION_NOTIFICATION_KIND,
  parseContextAutomationUrl,
  selectContextNextActions,
} from '@/lib/context-automation';
import { sendMobileImmediateNotification } from '@/lib/notification-service';

type ResolveText = (key: string, fallback: string) => string;

type UseRootLayoutContextAutomationParams = {
  dataReady: boolean;
  incomingUrl: string | null;
  returnToBackground?: () => void;
  resolveText: ResolveText;
};

const RECENT_CONTEXT_AUTOMATION_TTL_MS = 10_000;
const recentlyHandledContextAutomation = new Map<string, number>();

const wasRecentlyHandled = (key: string, nowMs: number): boolean => {
  for (const [handledKey, handledAtMs] of recentlyHandledContextAutomation.entries()) {
    if (nowMs - handledAtMs > RECENT_CONTEXT_AUTOMATION_TTL_MS) {
      recentlyHandledContextAutomation.delete(handledKey);
    }
  }

  const previousHandledAtMs = recentlyHandledContextAutomation.get(key);
  if (previousHandledAtMs !== undefined && nowMs - previousHandledAtMs <= RECENT_CONTEXT_AUTOMATION_TTL_MS) {
    return true;
  }

  recentlyHandledContextAutomation.set(key, nowMs);
  return false;
};

export function __resetContextAutomationDedupeForTests(): void {
  recentlyHandledContextAutomation.clear();
}

export function useRootLayoutContextAutomation({
  dataReady,
  incomingUrl,
  returnToBackground,
  resolveText,
}: UseRootLayoutContextAutomationParams) {
  const lastHandledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!dataReady) return;
    if (!incomingUrl) return;
    if (lastHandledUrl.current === incomingUrl) return;

    const payload = parseContextAutomationUrl(incomingUrl);
    if (!payload) return;

    const dedupeKey = `${payload.action}:${payload.context}`;
    if (wasRecentlyHandled(dedupeKey, Date.now())) {
      lastHandledUrl.current = incomingUrl;
      returnToBackground?.();
      return;
    }

    lastHandledUrl.current = incomingUrl;

    if (payload.action === 'deactivate') {
      returnToBackground?.();
      return;
    }

    const state = useTaskStore.getState();
    const matchingTasks = selectContextNextActions(state.tasks ?? [], state.projects ?? [], payload.context);
    if (matchingTasks.length === 0) {
      returnToBackground?.();
      return;
    }

    const copy = buildContextAutomationNotificationCopy(payload.context, matchingTasks, {
      noTasksTitle: resolveText('contextAutomation.noNextActionsTitle', 'No {{context}} next actions'),
      noTasksMessage: resolveText('contextAutomation.noNextActionsBody', 'Mindwtr did not find any /next tasks for {{context}}.'),
      oneTaskTitle: resolveText('contextAutomation.oneNextActionTitle', '{{context}} next action'),
      manyTasksTitle: resolveText('contextAutomation.manyNextActionsTitle', '{{count}} {{context}} next actions'),
      moreTasksLine: resolveText('contextAutomation.moreTasksLine', '+{{count}} more'),
    });

    void sendMobileImmediateNotification(copy.title, copy.message, {
      kind: CONTEXT_AUTOMATION_NOTIFICATION_KIND,
      context: payload.context,
    }).finally(() => {
      returnToBackground?.();
    });
  }, [dataReady, incomingUrl, resolveText, returnToBackground]);
}
