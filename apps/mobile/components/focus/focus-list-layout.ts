export const FOCUS_ESTIMATED_LIST_HEADER_HEIGHT = 64;
export const FOCUS_ESTIMATED_SECTION_HEADER_HEIGHT = 46;
export const FOCUS_ESTIMATED_GROUP_HEADER_HEIGHT = 48;
export const FOCUS_ESTIMATED_TASK_HEIGHT = 94;
export const FOCUS_ESTIMATED_PROJECT_HEIGHT = 88;

export const FOCUS_LIST_HEADER_LAYOUT_KEY = 'focus-list-header';

type FocusLayoutRevision = string | number | null | undefined;

export type FocusLayoutListItem =
  | { type: 'task'; task: { id: string; rev?: FocusLayoutRevision; updatedAt?: string | null } }
  | { type: 'project'; project: { id: string; rev?: FocusLayoutRevision; updatedAt?: string | null } }
  | { type: 'groupHeader'; id: string; count: number };

export type FocusLayoutSection = {
  type: string;
  totalCount: number;
  expanded: boolean;
  data: readonly FocusLayoutListItem[];
};

export type FocusListLayoutFrame = { length: number; offset: number };

export function focusSectionHeaderLayoutKey(
  section: Pick<FocusLayoutSection, 'type' | 'totalCount' | 'expanded'>,
  isFirstVisible: boolean,
): string {
  return [
    'section-header',
    section.type,
    isFirstVisible ? 'first' : 'rest',
    section.expanded ? 'expanded' : 'collapsed',
    section.totalCount,
  ].join(':');
}

export function focusItemLayoutKey(sectionType: string, item: FocusLayoutListItem): string {
  if (item.type === 'task') {
    return `${sectionType}:task:${item.task.id}@${item.task.rev ?? item.task.updatedAt ?? ''}`;
  }
  if (item.type === 'project') {
    return `${sectionType}:project:${item.project.id}@${item.project.rev ?? item.project.updatedAt ?? ''}`;
  }
  return `${sectionType}:group:${item.id}:${item.count}`;
}

function estimateFocusItemHeight(item: FocusLayoutListItem): number {
  if (item.type === 'task') return FOCUS_ESTIMATED_TASK_HEIGHT;
  if (item.type === 'project') return FOCUS_ESTIMATED_PROJECT_HEIGHT;
  return FOCUS_ESTIMATED_GROUP_HEADER_HEIGHT;
}

type BuildFocusListLayoutFramesOptions = {
  measuredHeights: Readonly<Record<string, number>>;
  firstVisibleSectionType: string | null;
};

// SectionList flattens every section as [header, ...items, footer], so each
// section contributes data.length + 2 flat indices; the footer slot renders
// null here (no renderSectionFooter) and is always zero-height. Offsets start
// after the measured ListHeaderComponent because VirtualizedList cell frames
// are content-relative and include the header.
export function buildFocusListLayoutFrames(
  sections: readonly FocusLayoutSection[],
  { measuredHeights, firstVisibleSectionType }: BuildFocusListLayoutFramesOptions,
): FocusListLayoutFrame[] {
  let offset = measuredHeights[FOCUS_LIST_HEADER_LAYOUT_KEY] ?? FOCUS_ESTIMATED_LIST_HEADER_HEIGHT;
  const frames: FocusListLayoutFrame[] = [];
  const push = (length: number) => {
    frames.push({ length, offset });
    offset += length;
  };
  for (const section of sections) {
    if (section.totalCount === 0) {
      // renderSectionHeader returns null for empty sections.
      push(0);
    } else {
      const headerKey = focusSectionHeaderLayoutKey(section, section.type === firstVisibleSectionType);
      push(measuredHeights[headerKey] ?? FOCUS_ESTIMATED_SECTION_HEADER_HEIGHT);
    }
    for (const item of section.data) {
      push(measuredHeights[focusItemLayoutKey(section.type, item)] ?? estimateFocusItemHeight(item));
    }
    push(0);
  }
  return frames;
}

export function collectFocusListLayoutKeys(
  sections: readonly FocusLayoutSection[],
  firstVisibleSectionType: string | null,
): Set<string> {
  const keys = new Set<string>([FOCUS_LIST_HEADER_LAYOUT_KEY]);
  for (const section of sections) {
    keys.add(focusSectionHeaderLayoutKey(section, section.type === firstVisibleSectionType));
    for (const item of section.data) {
      keys.add(focusItemLayoutKey(section.type, item));
    }
  }
  return keys;
}
