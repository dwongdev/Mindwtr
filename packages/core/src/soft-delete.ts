export type SoftDeletable = {
    deletedAt?: string | null;
};

export function filterNotDeleted<T extends SoftDeletable>(items: readonly T[]): T[] {
    return items.filter((item) => !item.deletedAt);
}
