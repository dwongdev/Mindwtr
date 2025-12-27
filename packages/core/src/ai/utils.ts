export function parseJson<T>(raw: string): T {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed) as T;
    } catch (error) {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start !== -1 && end > start) {
            const sliced = trimmed.slice(start, end + 1);
            return JSON.parse(sliced) as T;
        }
        throw error;
    }
}
