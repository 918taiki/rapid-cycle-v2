// アプリ全体の永続状態（デッキ・学習記録・フォルダ・設定・同期ペンディング）。
// localStorage のキーとデータ構造は v1 と同一。

import { useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, loadFromStorage, saveToStorage } from "../lib/storage.js";
import { statsKey } from "../lib/memory.js";
import { useLatest } from "../hooks/useLatest.js";
import { loadMigratedData } from "./migrations.js";

export const DEFAULT_SETTINGS = {
  reappearR1: 0.33,
  reappearR2: 0.5,
  memoryReappear: true,
  theme: "dark",
  gasUrl: "",
  reviewIntervalScale: 1.0,
};

export const DEFAULT_PENDING = {
  deletedDeckIds: [],
  metaDirty: false,
  dirtyDeckIds: [],
};

export function useAppState() {
  const [initial] = useState(loadMigratedData);
  const [decks, setDecks] = useState(initial.decks);
  const [stats, setStats] = useState(initial.stats);
  const [folders, setFolders] = useState(initial.folders);
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadFromStorage(STORAGE_KEYS.settings, {}),
  }));
  const [pending, setPending] = useState(() =>
    loadFromStorage(STORAGE_KEYS.pending, DEFAULT_PENDING)
  );

  useEffect(() => { saveToStorage(STORAGE_KEYS.decks, decks); }, [decks]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.stats, stats); }, [stats]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.folders, folders); }, [folders]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.settings, settings); }, [settings]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.pending, pending); }, [pending]);

  // 非同期コールバック（デバウンス同期など）から最新値を読むための ref
  const decksRef = useLatest(decks);
  const statsRef = useLatest(stats);
  const foldersRef = useLatest(folders);

  // 単語キー → 所属デッキ ID の逆引き（横断学習のデッキ追跡用）
  const wordToDeckMap = useMemo(() => {
    const m = new Map();
    for (const d of decks) {
      for (const w of d.words) {
        m.set(statsKey(w), d.id);
      }
    }
    return m;
  }, [decks]);

  return {
    decks, setDecks, decksRef,
    stats, setStats, statsRef,
    folders, setFolders, foldersRef,
    settings, setSettings,
    pending, setPending,
    wordToDeckMap,
  };
}

/** フォルダ内のデッキを order 順に返す（folderId=null で未分類） */
export function decksInFolder(decks, folderId) {
  return decks
    .filter((d) => (folderId === null ? !d.folderId : d.folderId === folderId))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

export function sortedFolders(folders) {
  return [...folders].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}
