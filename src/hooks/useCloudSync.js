// GAS クラウド同期エンジン。
//
// v1 と同じ同期戦略:
//   - デッキ作成/削除/フォルダ移動 → 即時送信、失敗したらペンディングに積む
//   - 単語編集・リネーム → デッキ単位で 3 秒デバウンス送信
//   - 学習終了 → 触れたデッキだけ差分送信（5 分スロットル）
//   - 起動 1 秒後にペンディングをリトライ
//   - 手動バックアップ → クラウドの孤立デッキを検出してユーザーに確認
//   - 手動復元 → 概要を提示して確認後、全デッキを取得して一括適用
//
// ペイロード構造は lib/gasClient.js（v1 完全互換）に集約している。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGasClient } from "../lib/gasClient.js";
import { DEFAULT_PENDING } from "../state/useAppState.js";
import { useLatest } from "./useLatest.js";

const DECK_SYNC_DEBOUNCE_MS = 3000;
const AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

const isAbort = (err) => err && err.name === "AbortError";

export function useCloudSync(app) {
  const {
    decksRef, statsRef, foldersRef,
    setDecks, setStats, setFolders,
    settings, pending, setPending,
  } = app;

  const client = useMemo(() => createGasClient(settings.gasUrl), [settings.gasUrl]);
  const clientRef = useLatest(client);

  // ── 通信・タイマー管理 ──
  const abortRef = useRef(null); // バックアップ/復元/一括同期の重複防止
  const debounceTimersRef = useRef(new Map()); // deckId → timer id
  const timersRef = useRef(new Set());

  const scheduleTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  // ── UI ステート ──
  const [backupPhase, setBackupPhase] = useState(null); // null | checking | confirming | syncing | done | error
  const [orphanSummaries, setOrphanSummaries] = useState([]);
  const orphanResolveRef = useRef(null);
  const [restorePhase, setRestorePhase] = useState(null); // null | checking | confirming | fetching | applying | done | error
  const [restoreSummary, setRestoreSummary] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState({ current: 0, total: 0, message: "" });
  const [restoreError, setRestoreError] = useState("");
  const restoreResolveRef = useRef(null);

  // ── ペンディングキュー ──
  const pendingRef = useLatest(pending);

  const addPendingDeletion = useCallback((deckId) => {
    setPending((prev) => ({
      ...prev,
      deletedDeckIds: prev.deletedDeckIds.includes(deckId)
        ? prev.deletedDeckIds
        : [...prev.deletedDeckIds, deckId],
      dirtyDeckIds: prev.dirtyDeckIds.filter((id) => id !== deckId),
    }));
  }, [setPending]);

  const addPendingDirtyDeck = useCallback((deckId) => {
    setPending((prev) => {
      if (prev.deletedDeckIds.includes(deckId)) return prev;
      if (prev.dirtyDeckIds.includes(deckId)) return prev;
      return { ...prev, dirtyDeckIds: [...prev.dirtyDeckIds, deckId] };
    });
  }, [setPending]);

  const markMetaDirty = useCallback(() => {
    setPending((prev) => (prev.metaDirty ? prev : { ...prev, metaDirty: true }));
  }, [setPending]);

  // ── 単発送信ヘルパー（失敗時はペンディングへ） ──
  const syncDeckNow = useCallback(async (deck, signal) => {
    const c = clientRef.current;
    if (!c) return;
    try {
      await c.updateDeck(deck, statsRef.current, signal);
    } catch (err) {
      if (isAbort(err)) return;
      console.warn(`syncDeck failed for ${deck.id}, adding to pending`, err);
      addPendingDirtyDeck(deck.id);
    }
  }, [clientRef, statsRef, addPendingDirtyDeck]);

  const syncMetaNow = useCallback(async (signal) => {
    const c = clientRef.current;
    if (!c) return;
    try {
      await c.updateMeta(foldersRef.current, signal);
    } catch (err) {
      if (isAbort(err)) return;
      console.warn("syncMeta failed, marking pending", err);
      markMetaDirty();
    }
  }, [clientRef, foldersRef, markMetaDirty]);

  // ── ペンディングのリトライ ──
  const processPending = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    const snapshot = {
      deletedDeckIds: [...pendingRef.current.deletedDeckIds],
      metaDirty: pendingRef.current.metaDirty,
      dirtyDeckIds: [...pendingRef.current.dirtyDeckIds],
    };
    for (const deckId of snapshot.deletedDeckIds) {
      try {
        await c.deleteDeck(deckId);
        setPending((prev) => ({
          ...prev,
          deletedDeckIds: prev.deletedDeckIds.filter((id) => id !== deckId),
        }));
      } catch (err) {
        if (isAbort(err)) return;
        console.warn(`pending deleteDeck failed for ${deckId}`, err);
      }
    }
    for (const deckId of snapshot.dirtyDeckIds) {
      const deck = decksRef.current.find((d) => d.id === deckId);
      const clear = () =>
        setPending((prev) => ({
          ...prev,
          dirtyDeckIds: prev.dirtyDeckIds.filter((id) => id !== deckId),
        }));
      if (!deck) { clear(); continue; }
      try {
        await c.updateDeck(deck, statsRef.current);
        clear();
      } catch (err) {
        if (isAbort(err)) return;
        console.warn(`pending syncDeck failed for ${deckId}`, err);
      }
    }
    if (snapshot.metaDirty) {
      try {
        await c.updateMeta(foldersRef.current);
        setPending((prev) => (prev.metaDirty ? { ...prev, metaDirty: false } : prev));
      } catch (err) {
        if (isAbort(err)) return;
        console.warn("pending syncMeta failed", err);
      }
    }
  }, [clientRef, pendingRef, decksRef, statsRef, foldersRef, setPending]);

  const processPendingInBackground = useCallback(() => {
    processPending().catch((err) => console.warn("processPending error", err));
  }, [processPending]);

  // 起動 1 秒後にペンディングをリトライ（v1 同等）
  useEffect(() => {
    const id = scheduleTimeout(processPendingInBackground, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アンマウント時の後始末
  useEffect(() => {
    const timers = timersRef.current;
    const debouncers = debounceTimersRef.current;
    return () => {
      abortRef.current?.abort();
      timers.forEach(clearTimeout);
      timers.clear();
      debouncers.forEach(clearTimeout);
      debouncers.clear();
      orphanResolveRef.current?.("cancel");
      orphanResolveRef.current = null;
      restoreResolveRef.current?.("cancel");
      restoreResolveRef.current = null;
    };
  }, []);

  // ── 変更イベント API ──
  const deckCreated = useCallback((deck) => {
    if (!clientRef.current) return;
    syncDeckNow(deck);
  }, [syncDeckNow, clientRef]);

  const deckDeleted = useCallback((deckId) => {
    const c = clientRef.current;
    if (!c) return;
    c.deleteDeck(deckId).catch((err) => {
      if (isAbort(err)) return;
      console.warn("deleteDeck failed, adding to pending", err);
      addPendingDeletion(deckId);
    });
  }, [addPendingDeletion, clientRef]);

  /** 単語編集・リネーム用: デッキ単位の 3 秒デバウンス送信 */
  const deckChangedDebounced = useCallback((deckId) => {
    if (!clientRef.current) return;
    const timers = debounceTimersRef.current;
    const existing = timers.get(deckId);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.delete(deckId);
    }
    const tid = scheduleTimeout(() => {
      timers.delete(deckId);
      const latest = decksRef.current.find((d) => d.id === deckId);
      if (!latest) return;
      syncDeckNow(latest);
    }, DECK_SYNC_DEBOUNCE_MS);
    timers.set(deckId, tid);
  }, [decksRef, scheduleTimeout, syncDeckNow, clientRef]);

  /** フォルダ移動など: 更新後のデッキを即時送信 */
  const deckChangedImmediate = useCallback((deck) => {
    if (!clientRef.current) return;
    syncDeckNow(deck);
  }, [syncDeckNow, clientRef]);

  /** フォルダ作成/削除/並び替え: meta.json を次 tick で送信（最新 state を参照） */
  const metaChanged = useCallback(() => {
    if (!clientRef.current) return;
    scheduleTimeout(() => syncMetaNow(), 0);
  }, [scheduleTimeout, syncMetaNow, clientRef]);

  /** フォルダ削除: meta 更新 + 所属デッキの folderId 変更を送信 */
  const metaChangedWithDecks = useCallback((affectedDecks) => {
    if (!clientRef.current) return;
    scheduleTimeout(() => {
      syncMetaNow();
      for (const d of affectedDecks) {
        syncDeckNow(d);
      }
    }, 0);
  }, [scheduleTimeout, syncMetaNow, syncDeckNow, clientRef]);

  /** 学習記録リセット: 全デッキを dirty にして空 stats で上書きさせる */
  const statsReset = useCallback(() => {
    if (!clientRef.current) return;
    for (const deck of decksRef.current) {
      addPendingDirtyDeck(deck.id);
    }
    // 1 tick 遅延: setStats({}) 反映後の statsRef で送信させる
    scheduleTimeout(processPendingInBackground, 0);
  }, [decksRef, addPendingDirtyDeck, scheduleTimeout, processPendingInBackground, clientRef]);

  /** 並び替え確定: 差分のあったデッキ + meta を送信 */
  const reorderCommitted = useCallback((changedDeckIds, folderOrderChanged) => {
    if (!clientRef.current) return;
    if (changedDeckIds.length === 0 && !folderOrderChanged) return;
    for (const id of changedDeckIds) addPendingDirtyDeck(id);
    if (folderOrderChanged) markMetaDirty();
    scheduleTimeout(processPendingInBackground, 0);
  }, [addPendingDirtyDeck, markMetaDirty, scheduleTimeout, processPendingInBackground, clientRef]);

  // ── 学習終了時の自動同期（触れたデッキのみ・5 分スロットル） ──
  const lastAutoSyncAtRef = useRef(0);
  const syncDecksAfterStudy = useCallback(async (deckIds) => {
    if (!clientRef.current || deckIds.size === 0) return;
    const now = Date.now();
    if (now - lastAutoSyncAtRef.current < AUTO_SYNC_MIN_INTERVAL_MS) return;
    lastAutoSyncAtRef.current = now;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    for (const deckId of deckIds) {
      if (controller.signal.aborted) return;
      const deck = decksRef.current.find((d) => d.id === deckId);
      if (!deck) continue;
      await syncDeckNow(deck, controller.signal);
    }
    processPendingInBackground();
  }, [decksRef, syncDeckNow, processPendingInBackground, clientRef]);

  // ── 手動バックアップ（孤立デッキ検出つき） ──
  const runCloudBackup = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // フェーズ 1: クラウドにあってローカルにないデッキを検出
      setBackupPhase("checking");
      const cloudDeckIds = await c.listDecks(controller.signal);
      const localIds = new Set(decksRef.current.map((d) => d.id));
      const orphanIds = cloudDeckIds.filter((id) => !localIds.has(id));

      // フェーズ 2: 孤立デッキの処理をユーザーに確認
      let deleteOrphans = false;
      if (orphanIds.length > 0) {
        const summaries = await c.getDeckSummaries(orphanIds, controller.signal);
        const choice = await new Promise((resolve) => {
          setOrphanSummaries(summaries);
          setBackupPhase("confirming");
          orphanResolveRef.current = resolve;
        });
        setOrphanSummaries([]);
        if (choice === "cancel") {
          setBackupPhase(null);
          return false;
        }
        deleteOrphans = choice === "delete";
      }

      // フェーズ 3: 同期実行
      setBackupPhase("syncing");
      if (deleteOrphans) {
        for (const deckId of orphanIds) {
          if (controller.signal.aborted) return false;
          try {
            await c.deleteDeck(deckId, controller.signal);
          } catch (err) {
            if (isAbort(err)) return false;
            console.warn(`orphan delete failed for ${deckId}`, err);
          }
        }
      }
      for (const deck of decksRef.current) {
        if (controller.signal.aborted) return false;
        await c.updateDeck(deck, statsRef.current, controller.signal);
      }
      if (!controller.signal.aborted) {
        await c.updateMeta(foldersRef.current, controller.signal);
      }
      processPendingInBackground();

      setBackupPhase("done");
      scheduleTimeout(() => setBackupPhase(null), 3000);
      return true;
    } catch (err) {
      if (isAbort(err)) {
        setBackupPhase(null);
        return false;
      }
      console.warn("runCloudBackup failed", err);
      setBackupPhase("error");
      scheduleTimeout(() => setBackupPhase(null), 3000);
      return false;
    }
  }, [decksRef, statsRef, foldersRef, processPendingInBackground, scheduleTimeout, clientRef]);

  const resolveOrphanChoice = useCallback((choice) => {
    orphanResolveRef.current?.(choice);
    orphanResolveRef.current = null;
  }, []);

  // ── 復元 ──
  const applyCloudData = useCallback((meta, fetchedDecks, fetchedStats) => {
    setDecks(fetchedDecks);
    setStats(fetchedStats);
    setFolders((meta && meta.folders) || []);
    setPending(DEFAULT_PENDING);
  }, [setDecks, setStats, setFolders, setPending]);

  const runCloudRestore = useCallback(async (opts = {}) => {
    const c = clientRef.current;
    if (!c) return false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // silent モード（起動時の自動復元）: 確認なしの簡易フロー
    if (opts.silent === true) {
      try {
        const meta = await c.getMeta(controller.signal);
        const deckIds = await c.listDecks(controller.signal);
        const fetchedDecks = [];
        const fetchedStats = {};
        for (const deckId of deckIds) {
          if (controller.signal.aborted) return false;
          const data = await c.getDeck(deckId, controller.signal);
          if (data) {
            fetchedDecks.push(data.deck);
            Object.assign(fetchedStats, data.stats || {});
          }
        }
        applyCloudData(meta, fetchedDecks, fetchedStats);
        return true;
      } catch {
        return false;
      }
    }

    try {
      // フェーズ 1: クラウド概要の取得
      setRestorePhase("checking");
      setRestoreError("");
      const summary = await c.getSummary(controller.signal);

      // フェーズ 2: ユーザー確認
      const choice = await new Promise((resolve) => {
        setRestoreSummary(summary);
        setRestorePhase("confirming");
        restoreResolveRef.current = resolve;
      });
      if (choice === "cancel") {
        setRestorePhase(null);
        setRestoreSummary(null);
        return false;
      }

      // フェーズ 3: 取得（ローカルはまだ変更しない）
      setRestorePhase("fetching");
      setRestoreProgress({ current: 0, total: 0, message: "メタ情報を取得中..." });
      const meta = await c.getMeta(controller.signal);
      if (controller.signal.aborted) return false;

      setRestoreProgress({ current: 0, total: 0, message: "単語帳一覧を取得中..." });
      const deckIds = await c.listDecks(controller.signal);
      if (controller.signal.aborted) return false;

      const fetchedDecks = [];
      const fetchedStats = {};
      for (let i = 0; i < deckIds.length; i++) {
        if (controller.signal.aborted) return false;
        setRestoreProgress({
          current: i + 1,
          total: deckIds.length,
          message: `単語帳を取得中... (${i + 1}/${deckIds.length})`,
        });
        const data = await c.getDeck(deckIds[i], controller.signal);
        if (!data) throw new Error(`デッキ ${deckIds[i]} の取得に失敗しました`);
        fetchedDecks.push(data.deck);
        Object.assign(fetchedStats, data.stats || {});
      }

      // フェーズ 4: 一括適用
      setRestorePhase("applying");
      setRestoreProgress({ current: 0, total: 0, message: "適用中..." });
      applyCloudData(meta, fetchedDecks, fetchedStats);

      setRestorePhase("done");
      scheduleTimeout(() => {
        setRestorePhase(null);
        setRestoreSummary(null);
        setRestoreProgress({ current: 0, total: 0, message: "" });
      }, 3000);
      return true;
    } catch (err) {
      if (isAbort(err)) {
        setRestorePhase(null);
        setRestoreSummary(null);
        return false;
      }
      console.warn("runCloudRestore failed", err);
      setRestoreError(err.message || "復元に失敗しました");
      setRestorePhase("error");
      scheduleTimeout(() => {
        setRestorePhase(null);
        setRestoreSummary(null);
        setRestoreError("");
      }, 5000);
      return false;
    }
  }, [applyCloudData, scheduleTimeout, clientRef]);

  const resolveRestoreChoice = useCallback((choice) => {
    restoreResolveRef.current?.(choice);
    restoreResolveRef.current = null;
  }, []);

  const cancelCloudOperation = useCallback(() => {
    abortRef.current?.abort();
    setRestorePhase(null);
    setRestoreProgress({ current: 0, total: 0, message: "" });
  }, []);

  return {
    enabled: !!client,
    // 変更イベント
    deckCreated, deckDeleted, deckChangedDebounced, deckChangedImmediate,
    metaChanged, metaChangedWithDecks, statsReset, reorderCommitted,
    syncDecksAfterStudy, processPendingInBackground,
    // 手動バックアップ / 復元
    runCloudBackup, backupPhase, orphanSummaries, resolveOrphanChoice,
    runCloudRestore, restorePhase, restoreSummary, restoreProgress, restoreError,
    resolveRestoreChoice, cancelCloudOperation,
  };
}
