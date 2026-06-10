// 高速周回学習セッションのエンジン。アルゴリズムは v1 と同一:
//
//   R1: 全単語をシャッフル
//   R2 以降: 前ラウンド不正解の全語 + 前ラウンド正解の一部
//     再登場率 = 基本率(R1→R2: reappearR1 / 以降: reappearR2) × 記憶度倍率
//   終了条件: 不正解ゼロ かつ 次ラウンド候補 2 語以下
//   3 語未満のラウンドは正解済みカードで 3 語まで補充
//
// 判定の記録（recordResult）はカード確定（dismiss）時に一元実行する。
// 巻き戻しは同一ラウンド内の直前 1 手のみ。

import { useCallback, useRef, useState } from "react";
import { genId, shuffle } from "../lib/utils.js";
import { statsKey, getReappearMultiplier } from "../lib/memory.js";
import { useLatest } from "./useLatest.js";

export function useStudyEngine({ settings, statsRef, setStats, wordToDeckMap }) {
  // セッション定義（学習対象の単語リストとメタ情報）
  const [session, setSession] = useState(null); // { words, label, deckId }
  const [cards, setCards] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [roundUnknown, setRoundUnknown] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [touchedDeckIds, setTouchedDeckIds] = useState(() => new Set());
  const [canRewind, setCanRewind] = useState(false);
  const sessionIdRef = useRef("");
  const lastActionRef = useRef(null);

  const settingsRef = useLatest(settings);

  /**
   * セッション開始。
   * @param {Array} sourceWords 学習対象の単語
   * @param {{label?: string, deckId?: string|null}} opts
   *   deckId は単一デッキ学習のときのみ指定（横断学習・復習は null）
   */
  const start = useCallback((sourceWords, { label = "", deckId = null } = {}) => {
    setSession({ words: sourceWords, label, deckId });
    setCards(shuffle(sourceWords));
    setCurrentIdx(0);
    setRound(1);
    setRoundUnknown([]);
    setSessionTotal(0);
    setTouchedDeckIds(new Set());
    setCanRewind(false);
    lastActionRef.current = null;
    sessionIdRef.current = genId();
  }, []);

  const recordResult = useCallback((card, correct, peeked, currentRound) => {
    const key = statsKey(card);
    const now = new Date().toISOString();
    setStats((prev) => {
      const old = prev[key] || { seen: 0, correct: 0, correctWithoutPeek: 0, log: [] };
      const log = [
        ...(old.log || []),
        { date: now, correct, peeked, round: currentRound, sid: sessionIdRef.current },
      ].slice(-100);
      return {
        ...prev,
        [key]: {
          seen: old.seen + 1,
          correct: old.correct + (correct ? 1 : 0),
          correctWithoutPeek: old.correctWithoutPeek + (correct && !peeked ? 1 : 0),
          log,
        },
      };
    });
    setSessionTotal((prev) => prev + 1);

    // 学習した単語の所属デッキを記録（学習終了時の差分同期に使う）
    const deckId = wordToDeckMap.get(key);
    if (deckId) {
      setTouchedDeckIds((prev) => {
        if (prev.has(deckId)) return prev;
        const next = new Set(prev);
        next.add(deckId);
        return next;
      });
    }
  }, [setStats, wordToDeckMap]);

  /**
   * カードを確定する。判定の記録・ラウンド遷移・終了判定まで行う。
   * @returns {{ finished: boolean }} セッションが完了したか
   */
  const dismiss = useCallback((card, { correct, peeked, direction }) => {
    // 巻き戻し用スナップショット（recordResult で stats が変わる前に取る）
    const key = statsKey(card);
    const prevEntry = statsRef.current[key];
    lastActionRef.current = {
      prevStatsEntry: prevEntry ? structuredClone(prevEntry) : null,
      statsKey: key,
      card,
      prevCurrentIdx: currentIdx,
      wasInRoundUnknown: roundUnknown.includes(card),
      prevSessionTotal: sessionTotal,
      swipeDirection: direction,
      round,
    };
    setCanRewind(true);

    recordResult(card, correct, peeked, round);
    if (!correct) {
      setRoundUnknown((prev) => [...prev, card]);
    }

    if (currentIdx + 1 < cards.length) {
      setCurrentIdx((prev) => prev + 1);
      return { finished: false };
    }

    // ── ラウンド終了 ──
    const currentRoundKnown = cards.filter((c) => !roundUnknown.includes(c) && c !== card);
    const allKnown = correct ? [...currentRoundKnown, card] : currentRoundKnown;
    const allUnknown = correct ? [...roundUnknown] : [...roundUnknown, card];

    const s = settingsRef.current;
    const baseRate = round === 1 ? s.reappearR1 : s.reappearR2;
    const reappear = allKnown.filter((c) => {
      const mult = getReappearMultiplier(statsRef.current, c, s.memoryReappear);
      const rate = Math.min(baseRate * mult, 1);
      return Math.random() < rate;
    });
    let nextCards = [...allUnknown, ...reappear];

    // ✕ が 1 語でも残っていたら必ず次ラウンドへ。終了は全 ○ のときのみ
    if (allUnknown.length === 0 && nextCards.length <= 2) {
      lastActionRef.current = null;
      setCanRewind(false);
      return { finished: true };
    }

    // 3 語未満のラウンドは正解済みカードで 3 語まで補充
    if (nextCards.length < 3) {
      const inNext = new Set(nextCards.map(statsKey));
      const fillers = shuffle(allKnown.filter((c) => !inNext.has(statsKey(c))));
      while (nextCards.length < 3 && fillers.length > 0) {
        nextCards.push(fillers.pop());
      }
    }

    setCards(shuffle(nextCards));
    setCurrentIdx(0);
    setRoundUnknown([]);
    setRound((r) => r + 1);
    lastActionRef.current = null;
    setCanRewind(false);
    return { finished: false };
  }, [cards, currentIdx, round, roundUnknown, sessionTotal, recordResult, statsRef, settingsRef]);

  /**
   * 直前の判定を取り消す（同一ラウンド内のみ）。
   * @returns {{ fromDirection: "left"|"right" } | null} 復帰アニメーション情報
   */
  const rewind = useCallback(() => {
    const snap = lastActionRef.current;
    if (!snap) return null;
    if (snap.round !== round) {
      lastActionRef.current = null;
      setCanRewind(false);
      return null;
    }

    setStats((prev) => {
      const next = { ...prev };
      if (snap.prevStatsEntry === null) {
        delete next[snap.statsKey];
      } else {
        next[snap.statsKey] = snap.prevStatsEntry;
      }
      return next;
    });
    if (!snap.wasInRoundUnknown) {
      setRoundUnknown((prev) => prev.filter((c) => c !== snap.card));
    }
    setSessionTotal(snap.prevSessionTotal);
    setCurrentIdx(snap.prevCurrentIdx);

    lastActionRef.current = null;
    setCanRewind(false);
    return { fromDirection: snap.swipeDirection };
  }, [round, setStats]);

  return {
    session,
    cards,
    currentIdx,
    currentCard: cards[currentIdx],
    round,
    sessionTotal,
    touchedDeckIds,
    canRewind,
    start,
    dismiss,
    rewind,
  };
}
