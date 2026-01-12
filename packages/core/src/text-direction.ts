import type { Task, TextDirection } from './types';

const RTL_CHAR_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

export function detectTextDirection(text: string): 'ltr' | 'rtl' {
    return RTL_CHAR_REGEX.test(text) ? 'rtl' : 'ltr';
}

export function resolveTextDirection(text: string, direction?: TextDirection): 'ltr' | 'rtl' {
    if (direction === 'rtl' || direction === 'ltr') return direction;
    return detectTextDirection(text);
}

export function resolveTaskTextDirection(task: Task): 'ltr' | 'rtl' {
    const combined = [task.title, task.description].filter(Boolean).join(' ').trim();
    return resolveTextDirection(combined, task.textDirection);
}
