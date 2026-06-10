// 記憶度スコアの算出と関連ヘルパー。
// アルゴリズムは v1 と同一:
//   weight = ラウンド減衰(1/round) × 時間減衰(セッション間隔による)
//   score  = 正解率(加重) × 0.6 + 非ピーク正解率(加重) × 0.4

/** stats のキー。id があれば id、なければ word（旧データ後方互換） */
export function statsKey(w) {
  return w.id || w.word;
}

export function getWordStats(stats, w) {
  const key = typeof w === "string" ? w : statsKey(w);
  return stats[key] || { seen: 0, correct: 0, correctWithoutPeek: 0, log: [] };
}

export function getLastStudied(stats, w) {
  const st = getWordStats(stats, w);
  if (!st.log || st.log.length === 0) return null;
  return st.log[st.log.length - 1].date;
}

function getIntervalDecay(hours) {
  if (hours < 1) return 0.6;
  if (hours < 3) return 0.7;
  if (hours < 6) return 0.8;
  if (hours < 12) return 0.9;
  if (hours < 24) return 0.95;
  return 1.0;
}

/** 記憶度スコア（0〜1）を計算する純粋関数 */
export function computeMemoryScore(stats, w) {
  const key = typeof w === "object" ? statsKey(w) : w;
  const st = stats[key];
  if (!st || !st.log || st.log.length === 0) return 0;
  const log = st.log.slice(-100);

  // 各エントリの時間減衰: 「その単語の前回セッション終了 → 今回セッション開始」の
  // 間隔で決まり、同一セッション内の全エントリで共有される。
  let prevSessionEndTime = null;
  let currentSid = null;
  let currentTimeDecay = 1.0;
  const timeDecays = new Array(log.length);

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    const entryTime = new Date(entry.date).getTime();
    const sid = entry.sid || `legacy_${i}`;

    if (sid !== currentSid) {
      if (currentSid !== null) {
        prevSessionEndTime = new Date(log[i - 1].date).getTime();
      }
      if (prevSessionEndTime !== null) {
        const gapHours = (entryTime - prevSessionEndTime) / 3600000;
        currentTimeDecay = getIntervalDecay(gapHours);
      } else {
        currentTimeDecay = 1.0;
      }
      currentSid = sid;
    }
    timeDecays[i] = currentTimeDecay;
  }

  let accuracySum = 0;
  let peekSum = 0;
  let totalWeight = 0.5; // 平滑化: 少数エントリでスコアが暴れないようにする

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    const roundDecay = 1 / (entry.round || 1);
    const weight = roundDecay * timeDecays[i];

    totalWeight += weight;
    if (entry.correct) {
      accuracySum += weight;
      if (!entry.peeked) {
        peekSum += weight;
      }
    }
  }

  if (totalWeight === 0) return 0;
  return (accuracySum / totalWeight) * 0.6 + (peekSum / totalWeight) * 0.4;
}

// 記憶度レベル: 0=未学習 / 1=要復習 / 2=あと少し / 3=定着
export const MEMORY_LEVELS = {
  0: { level: 0, key: "unseen", label: "未学習" },
  1: { level: 1, key: "weak", label: "要復習" },
  2: { level: 2, key: "almost", label: "あと少し" },
  3: { level: 3, key: "mastered", label: "定着" },
};

function levelForScore(score) {
  if (score >= 0.85) return 3;
  if (score >= 0.55) return 2;
  return 1;
}

/** 記憶度レベル情報 { level, key, label, score } を返す */
export function getMemoryLevel(stats, w) {
  const key = typeof w === "object" ? statsKey(w) : w;
  const st = stats[key];
  if (!st || st.seen === 0) return { ...MEMORY_LEVELS[0], score: 0 };
  const score = computeMemoryScore(stats, w);
  return { ...MEMORY_LEVELS[levelForScore(score)], score };
}

/**
 * 記憶度に応じた再登場率の倍率。
 * 定着 ×0.3 / あと少し ×0.7 / 要復習 ×1.3 / 未学習 ×1
 */
export function getReappearMultiplier(stats, w, enabled) {
  if (!enabled) return 1;
  const score = computeMemoryScore(stats, w);
  if (score >= 0.85) return 0.3;
  if (score >= 0.55) return 0.7;
  if (score > 0) return 1.3;
  return 1;
}

/**
 * 単語リストの記憶度内訳（statsKey で重複排除）。
 * 戻り値: { total, counts: [l0, l1, l2, l3], avgScore }
 * avgScore は学習済み単語のみのスコア平均（未学習のみなら null）。
 */
export function getMemoryBreakdown(stats, words) {
  const seen = new Set();
  const counts = [0, 0, 0, 0];
  let scoreSum = 0;
  let studiedCount = 0;
  for (const w of words) {
    const k = statsKey(w);
    if (seen.has(k)) continue;
    seen.add(k);
    const mem = getMemoryLevel(stats, w);
    counts[mem.level]++;
    if (mem.level > 0) {
      scoreSum += mem.score;
      studiedCount++;
    }
  }
  return {
    total: seen.size,
    counts,
    avgScore: studiedCount === 0 ? null : scoreSum / studiedCount,
  };
}
