const PILE_STORAGE_KEY = 'birdpile_my_pile';

export interface SavedItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  rating?: number;
  notes?: string;
  image?: string;
  savedAt: number;
}

export function getSavedItems(): SavedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveItem(item: Omit<SavedItem, 'savedAt'>): void {
  const items = getSavedItems();
  if (items.some((i) => i.id === item.id)) return;
  items.unshift({ ...item, savedAt: Date.now() });
  localStorage.setItem(PILE_STORAGE_KEY, JSON.stringify(items));
}

export function removeItem(id: string): void {
  const items = getSavedItems().filter((i) => i.id !== id);
  localStorage.setItem(PILE_STORAGE_KEY, JSON.stringify(items));
}

export function isItemSaved(id: string): boolean {
  return getSavedItems().some((i) => i.id === id);
}

export function getSavedCount(): number {
  return getSavedItems().length;
}
