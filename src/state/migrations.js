// 起動時マイグレーション（v1 と同じ変換を初回レンダー前に同期実行する）。
//
// 1. ID マイグレーション: id を持たない単語に genId() を付与し、
//    word キーの stats を id キーへコピーする（rc_migrated_v1 フラグで冪等化）
// 2. order マイグレーション: フォルダ/デッキに order フィールドを付与する

import { genId } from "../lib/utils.js";
import { STORAGE_KEYS, loadFromStorage, saveToStorage } from "../lib/storage.js";

export function migrateWordIds(decks, stats) {
  let changed = false;
  const newDecks = decks.map((deck) => {
    const newWords = deck.words.map((w) => {
      if (w.id) return w;
      changed = true;
      return { ...w, id: genId() };
    });
    return { ...deck, words: newWords };
  });
  if (!changed) return { decks, stats, changed };

  const newStats = { ...stats };
  for (const deck of newDecks) {
    for (const w of deck.words) {
      if (newStats[w.word] && !newStats[w.id]) {
        newStats[w.id] = newStats[w.word];
      }
    }
  }
  return { decks: newDecks, stats: newStats, changed };
}

export function migrateOrders(decks, folders) {
  let changed = false;

  let newFolders = folders;
  if (folders.some((f) => typeof f.order !== "number")) {
    changed = true;
    newFolders = folders.map((f, i) => ({ ...f, order: typeof f.order === "number" ? f.order : i }));
  }

  let newDecks = decks;
  if (decks.some((d) => typeof d.order !== "number")) {
    changed = true;
    const groups = {};
    newDecks = decks.map((d) => {
      if (typeof d.order === "number") return d;
      const key = d.folderId ?? "__unfiled__";
      groups[key] = (groups[key] ?? -1) + 1;
      return { ...d, order: groups[key] };
    });
  }

  return { decks: newDecks, folders: newFolders, changed };
}

/** localStorage から読み込み、必要なマイグレーションを適用して返す */
export function loadMigratedData() {
  let decks = loadFromStorage(STORAGE_KEYS.decks, []);
  let stats = loadFromStorage(STORAGE_KEYS.stats, {});
  let folders = loadFromStorage(STORAGE_KEYS.folders, []);

  if (!loadFromStorage(STORAGE_KEYS.migrated, false)) {
    const idResult = migrateWordIds(decks, stats);
    if (idResult.changed) {
      decks = idResult.decks;
      stats = idResult.stats;
      saveToStorage(STORAGE_KEYS.decks, decks);
      saveToStorage(STORAGE_KEYS.stats, stats);
    }
    saveToStorage(STORAGE_KEYS.migrated, true);
  }

  const orderResult = migrateOrders(decks, folders);
  if (orderResult.changed) {
    decks = orderResult.decks;
    folders = orderResult.folders;
    saveToStorage(STORAGE_KEYS.decks, decks);
    saveToStorage(STORAGE_KEYS.folders, folders);
  }

  return { decks, stats, folders };
}
