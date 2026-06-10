// 間隔反復（SRS）の復習期限ロジック。アルゴリズムは v1 と同一。
//
// セッションごとの「初見判定」（round=1 の最初のエントリ）を成績として扱い、
// 非ピーク正解の連続数（streak）で次回復習までの間隔を決める。

import { statsKey, computeMemoryScore } from "./memory.js";

const DAY = 24 * 60 * 60 * 1000;

/** セッションごとの R1 初回判定を時系列で返す */
export function getSessionVerdicts(stats, w) {
  const key = typeof w === "object" ? statsKey(w) : w;
  const st = stats[key];
  if (!st || !st.log || st.log.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const entry of st.log) {
    if ((entry.round || 1) !== 1) continue;
    const sid = entry.sid || `legacy_${entry.date}`;
    if (seen.has(sid)) continue;
    seen.add(sid);
    out.push({ sid, correct: !!entry.correct, peeked: !!entry.peeked, date: entry.date });
  }
  return out;
}

/** 次回復習期限のタイムスタンプ（未学習なら null） */
export function computeNextDueAt(stats, w, settings) {
  const verdicts = getSessionVerdicts(stats, w);
  if (verdicts.length === 0) return null;

  // 間隔決定に使う判定: 直近の非ピーク判定。なければ最新の判定
  let chosen = null;
  for (let i = verdicts.length - 1; i >= 0; i--) {
    if (!verdicts[i].peeked) {
      chosen = verdicts[i];
      break;
    }
  }
  const allPeeked = chosen === null;
  if (allPeeked) chosen = verdicts[verdicts.length - 1];

  // streak: ピークのセッションは飛ばし、非ピーク正解で +1、非ピーク不正解で打ち切り
  let streak = 0;
  for (let i = verdicts.length - 1; i >= 0; i--) {
    const v = verdicts[i];
    if (v.peeked) continue;
    if (v.correct) streak++;
    else break;
  }

  let intervalMs;
  if (!chosen.correct) {
    intervalMs = 10 * 60 * 1000; // 10分
  } else if (allPeeked) {
    intervalMs = 1 * DAY;
  } else if (streak <= 1) {
    intervalMs = 1 * DAY;
  } else if (streak === 2) {
    intervalMs = 3 * DAY;
  } else if (streak === 3) {
    intervalMs = 7 * DAY;
  } else if (streak === 4) {
    intervalMs = 14 * DAY;
  } else if (streak === 5) {
    intervalMs = 30 * DAY;
  } else {
    intervalMs = 60 * DAY;
  }

  const scale =
    settings && typeof settings.reviewIntervalScale === "number"
      ? settings.reviewIntervalScale
      : 1.0;
  intervalMs *= scale;

  // 記憶度による補正: 定着は伸ばし、弱い単語は早める
  const score = computeMemoryScore(stats, w);
  if (score >= 0.85) intervalMs *= 1.4;
  else if (score < 0.4) intervalMs *= 0.6;

  const key = typeof w === "object" ? statsKey(w) : w;
  const log = stats[key].log;
  const lastSessionDate = log[log.length - 1].date;
  return new Date(lastSessionDate).getTime() + intervalMs;
}

export function getOverdueMs(stats, w, settings, now = Date.now()) {
  const due = computeNextDueAt(stats, w, settings);
  if (due === null) return null;
  return now - due;
}

/** 超過時間の区分: "due"（期限到来）/ "1day" / "3days"。期限前は null */
export function getOverdueBucket(stats, w, settings, now = Date.now()) {
  const od = getOverdueMs(stats, w, settings, now);
  if (od === null || od < 0) return null;
  if (od < 1 * DAY) return "due";
  if (od < 3 * DAY) return "1day";
  return "3days";
}

/** 全デッキから復習期限が来た単語を、超過が大きい順に集める（重複排除） */
export function collectDueWords(decks, stats, settings, now = Date.now()) {
  const seen = new Set();
  const items = [];
  for (const d of decks) {
    for (const w of d.words) {
      const k = statsKey(w);
      if (seen.has(k)) continue;
      seen.add(k);
      const od = getOverdueMs(stats, w, settings, now);
      if (od === null || od < 0) continue;
      items.push({ w, overdue: od });
    }
  }
  items.sort((a, b) => b.overdue - a.overdue);
  return items.map((it) => it.w);
}
