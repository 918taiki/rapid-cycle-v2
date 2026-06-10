// デッキ・フォルダ・学習記録への操作。ローカル state の更新と
// クラウド同期のトリガー（useCloudSync）をここで対にする。

import { useMemo } from "react";

export function useAppActions(app, cloud) {
  const { decks, setDecks, folders, setFolders, setStats, setSettings } = app;

  return useMemo(() => {
    const actions = {
      /** 新しい単語帳を作成して即時クラウド同期する */
      createDeck(name, words, folderId = null) {
        const id = Date.now().toString(36);
        const siblings = decks.filter((d) => (d.folderId ?? null) === (folderId ?? null));
        const maxOrder = siblings.reduce((m, d) => Math.max(m, d.order ?? -1), -1);
        const newDeck = { id, name, words, createdAt: Date.now(), folderId, order: maxOrder + 1 };
        setDecks((prev) => [newDeck, ...prev]);
        cloud.deckCreated(newDeck);
        return newDeck;
      },

      deleteDeck(deckId) {
        setDecks((prev) => prev.filter((d) => d.id !== deckId));
        cloud.deckDeleted(deckId);
      },

      /** 単語の追加・編集・削除。クラウドへはデバウンス送信 */
      updateDeckWords(deckId, words) {
        setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, words } : d)));
        cloud.deckChangedDebounced(deckId);
      },

      renameDeck(deckId, name) {
        setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, name } : d)));
        cloud.deckChangedDebounced(deckId);
      },

      moveDeckToFolder(deckId, folderId) {
        const targetSiblings = decks.filter(
          (d) => d.id !== deckId && (d.folderId ?? null) === (folderId ?? null)
        );
        const maxOrder = targetSiblings.reduce((m, d) => Math.max(m, d.order ?? -1), -1);
        const newOrder = maxOrder + 1;
        setDecks((prev) =>
          prev.map((d) => (d.id === deckId ? { ...d, folderId, order: newOrder } : d))
        );
        const target = decks.find((d) => d.id === deckId);
        if (target) {
          cloud.deckChangedImmediate({ ...target, folderId, order: newOrder });
        }
      },

      createFolder(name) {
        const id = Date.now().toString(36) + "f";
        const maxOrder = folders.reduce((m, f) => Math.max(m, f.order ?? -1), -1);
        const folder = { id, name, order: maxOrder + 1 };
        setFolders((prev) => [...prev, folder]);
        cloud.metaChanged();
        return folder;
      },

      /** フォルダ削除。中の単語帳はフォルダ外（未分類）へ移動する */
      deleteFolder(folderId) {
        const affectedDecks = decks
          .filter((d) => d.folderId === folderId)
          .map((d) => ({ ...d, folderId: null }));
        setDecks((prev) => prev.map((d) => (d.folderId === folderId ? { ...d, folderId: null } : d)));
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        cloud.metaChangedWithDecks(affectedDecks);
      },

      /** 学習記録の全リセット。クラウドの各デッキファイルからも stats を消す */
      resetStats() {
        setStats({});
        cloud.statsReset();
      },

      /** ローカル全データの JSON（クリップボードバックアップ用、v1 互換構造） */
      buildLocalBackup(stats, settings) {
        return JSON.stringify({
          decks,
          stats,
          folders,
          settings: { ...settings, gasUrl: undefined },
          v: 1,
        });
      },

      /** クリップバックアップからの復元。gasUrl は現在の値を保持する */
      restoreLocalBackup(text) {
        const d = JSON.parse(text);
        if (d.decks) setDecks(d.decks);
        if (d.stats) setStats(d.stats);
        if (d.folders) setFolders(d.folders);
        if (d.settings) setSettings((prev) => ({ ...prev, ...d.settings, gasUrl: prev.gasUrl }));
      },
    };
    return actions;
  }, [decks, folders, setDecks, setFolders, setStats, setSettings, cloud]);
}
