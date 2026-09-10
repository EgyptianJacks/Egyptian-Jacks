// Safe LocalStorage persistence engine for Egyptian Jacks

export const STORAGE_KEYS = {
  COMPLETED_LESSONS: 'ej_completed_lessons',
  SOUND_ENABLED: 'ej_sound_enabled',
  CPU_DIFFICULTY: 'ej_cpu_difficulty',
} as const;

/**
 * Generic getter with fallback and safe error handling for localStorage.
 */
export function storageGet<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Egyptian Jacks Persistence] Failed to read key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Generic setter with safe error handling for localStorage.
 */
export function storageSet<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[Egyptian Jacks Persistence] Failed to write key "${key}":`, err);
    return false;
  }
}

/**
 * Removes a specific key from localStorage.
 */
export function storageRemove(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[Egyptian Jacks Persistence] Failed to remove key "${key}":`, err);
    return false;
  }
}

/**
 * Clears all Egyptian Jacks storage keys.
 */
export function storageClear(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    Object.values(STORAGE_KEYS).forEach((k) => {
      window.localStorage.removeItem(k);
    });
    return true;
  } catch (err) {
    console.warn('[Egyptian Jacks Persistence] Failed to clear storage:', err);
    return false;
  }
}
