export const TAB_IDS = ['overview', 'ai', 'energy', 'finance'] as const;

export type TabId = (typeof TAB_IDS)[number];

export const DEFAULT_TAB: TabId = 'overview';

export function parseTabFromHash(hash: string): TabId {
  const match = /^#\/?([a-z-]+)/i.exec(hash);
  const id = match?.[1] as TabId | undefined;
  return id != null && (TAB_IDS as ReadonlyArray<string>).includes(id) ? id : DEFAULT_TAB;
}

export function tabToHash(tab: TabId): string {
  return tab === DEFAULT_TAB ? '#/' : `#/${tab}`;
}
