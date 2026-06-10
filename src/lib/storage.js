// localStorage の薄いラッパー。
// キーは v1 と同一。同一オリジンに配備すれば v1 のデータをそのまま引き継げる。

export const STORAGE_KEYS = {
  decks: "rc_decks",
  stats: "rc_stats",
  settings: "rc_settings",
  folders: "rc_folders",
  migrated: "rc_migrated_v1",
  pending: "rc_pending",
};

export function loadFromStorage(key, fallback) {
  try {
    const raw = window.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage(key, data) {
  try {
    window.localStorage?.setItem(key, JSON.stringify(data));
  } catch {
    // 容量超過などは黙って無視（学習継続を優先）
  }
}
