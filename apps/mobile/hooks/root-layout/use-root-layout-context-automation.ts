import { useEffect, useRef } from 'react';

import { useTaskStore } from '@mindwtr/core';

import type { ToastOptions } from '@/contexts/toast-context';
import {
  buildContextAutomationNotificationCopy,
  CONTEXT_AUTOMATION_NOTIFICATION_KIND,
  parseContextAutomationUrl,
  selectContextNextActions,
} from '@/lib/context-automation';
import { sendMobileImmediateNotification } from '@/lib/notification-service';

type ResolveText = (key: string, fallback: string) => string;

type RouterLike = {
  replace: (...args: any[]) => void;
};

type UseRootLayoutContextAutomationParams = {
  dataReady: boolean;
  incomingUrl: string | null;
  resolveText: ResolveText;
  router: RouterLike;
  showToast: (options: ToastOptions) => void;
};

export function useRootLayoutContextAutomation({
  dataReady,
  incomingUrl,
  resolveText,
  router,
  showToast,
}: UseRootLayoutContextAutomationParams) {
  const lastHandledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!dataReady) return;
    if (!incomingUrl) return;
    if (lastHandledUrl.current === incomingUrl) return;

    const payload = parseContextAutomationUrl(incomingUrl);
    if (!payload) return;

    lastHandledUrl.current = incomingUrl;
    router.replace({
      pathname: '/contexts',
      params: { token: payload.context },
    });

    if (payload.action === 'deactivate') {
      showToast({
        title: resolveText('contextAutomation.deactivatedTitle', 'Context deactivated'),
        message: resolveText('contextAutomation.deactivatedBody', '{{context}} is no longer active.')
          .replace('{{context}}', payload.context),
        tone: 'success',
      });
      return;
    }

    const state = useTaskStore.getState();
    const matchingTasks = selectContextNextActions(state.tasks ?? [], state.projects ?? [], payload.context);
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
    });
  }, [dataReady, incomingUrl, resolveText, router, showToast]);
}
