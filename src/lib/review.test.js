import { describe, it, expect } from "vitest";
import { getSessionVerdicts, computeNextDueAt, getOverdueBucket, collectDueWords } from "./review.js";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

function entry({ date, correct = true, peeked = false, round = 1, sid }) {
  return { date: new Date(date).toISOString(), correct, peeked, round, sid };
}

function statsWith(log) {
  return { w: { seen: log.length, correct: 0, correctWithoutPeek: 0, log } };
}

const SETTINGS = { reviewIntervalScale: 1.0 };

describe("getSessionVerdicts", () => {
  it("各セッションの R1 最初の判定のみ採用する", () => {
    const base = Date.now();
    const log = [
      entry({ date: base, correct: false, sid: "s1" }),
      entry({ date: base + 1000, correct: true, round: 2, sid: "s1" }), // R2 は無視
      entry({ date: base + 2000, correct: true, sid: "s1" }), // 同一 sid の 2 個目は無視
      entry({ date: base + DAY, correct: true, sid: "s2" }),
    ];
    const verdicts = getSessionVerdicts(statsWith(log), "w");
    expect(verdicts).toHaveLength(2);
    expect(verdicts[0].correct).toBe(false);
    expect(verdicts[1].correct).toBe(true);
  });
});

describe("computeNextDueAt の間隔テーブル (v1 同一)", () => {
  const base = Date.now() - 10 * DAY;

  function dueAfter(log) {
    const stats = statsWith(log);
    const due = computeNextDueAt(stats, "w", SETTINGS);
    const last = new Date(log[log.length - 1].date).getTime();
    return due - last;
  }

  it("不正解 → 10分", () => {
    const interval = dueAfter([entry({ date: base, correct: false, sid: "s1" })]);
    // score 0 (<0.4) → ×0.6
    expect(interval).toBeCloseTo(10 * MIN * 0.6, 5);
  });

  it("streak 1 → 1日", () => {
    const interval = dueAfter([entry({ date: base, sid: "s1" })]);
    // score ≈ 0.667 → 補正なし
    expect(interval).toBeCloseTo(1 * DAY, 5);
  });

  it("streak 2 → 3日", () => {
    const interval = dueAfter([
      entry({ date: base, sid: "s1" }),
      entry({ date: base + 2 * DAY, sid: "s2" }),
    ]);
    // score = 2/2.5 = 0.8 → 補正なし
    expect(interval).toBeCloseTo(3 * DAY, 5);
  });

  it("streak 3 → 7日 ×1.4（score ≥ 0.85）", () => {
    const interval = dueAfter([
      entry({ date: base, sid: "s1" }),
      entry({ date: base + 2 * DAY, sid: "s2" }),
      entry({ date: base + 4 * DAY, sid: "s3" }),
    ]);
    // score = 3/3.5 ≈ 0.857 → ×1.4
    expect(interval).toBeCloseTo(7 * DAY * 1.4, 5);
  });

  it("全てピークの場合は 1日（score がわずかに 0.4 未満 → ×0.6 補正）", () => {
    const interval = dueAfter([entry({ date: base, peeked: true, sid: "s1" })]);
    // ピーク正解のみ → score = (1/1.5)*0.6 ≈ 0.39999...（浮動小数で 0.4 未満）→ ×0.6
    expect(interval).toBeCloseTo(1 * DAY * 0.6, 5);
  });

  it("reviewIntervalScale が反映される", () => {
    const stats = statsWith([entry({ date: base, sid: "s1" })]);
    const d1 = computeNextDueAt(stats, "w", { reviewIntervalScale: 1.0 });
    const d2 = computeNextDueAt(stats, "w", { reviewIntervalScale: 2.0 });
    const last = new Date(stats.w.log[0].date).getTime();
    expect(d2 - last).toBeCloseTo((d1 - last) * 2, 5);
  });

  it("未学習は null", () => {
    expect(computeNextDueAt({}, { id: "w" }, SETTINGS)).toBeNull();
  });
});

describe("getOverdueBucket / collectDueWords", () => {
  it("超過時間で due / 1day / 3days に区分する", () => {
    const now = Date.now();
    const studied = now - 3 * DAY; // streak1 → 期限は +1日 → 2日超過
    const stats = statsWith([entry({ date: studied, sid: "s1" })]);
    expect(getOverdueBucket(stats, "w", SETTINGS, now)).toBe("1day");
    expect(getOverdueBucket(stats, "w", SETTINGS, studied + 1.5 * DAY)).toBe("due");
    expect(getOverdueBucket(stats, "w", SETTINGS, studied + 10 * DAY)).toBe("3days");
    expect(getOverdueBucket(stats, "w", SETTINGS, studied + 0.5 * DAY)).toBeNull();
  });

  it("collectDueWords は超過が大きい順・重複排除", () => {
    const now = Date.now();
    const stats = {
      a: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [entry({ date: now - 10 * DAY, sid: "s1" })] },
      b: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [entry({ date: now - 2 * DAY, sid: "s1" })] },
      c: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [entry({ date: now - 1 * MIN, sid: "s1" })] }, // 期限前
    };
    const wa = { id: "a", word: "wa" };
    const wb = { id: "b", word: "wb" };
    const wc = { id: "c", word: "wc" };
    const decks = [
      { id: "d1", words: [wa, wb] },
      { id: "d2", words: [wa, wc] }, // wa 重複
    ];
    const due = collectDueWords(decks, stats, SETTINGS, now);
    expect(due.map((w) => w.id)).toEqual(["a", "b"]);
  });
});
