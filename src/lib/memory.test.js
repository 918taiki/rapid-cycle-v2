import { describe, it, expect } from "vitest";
import { computeMemoryScore, getMemoryLevel, getReappearMultiplier, statsKey, getMemoryBreakdown } from "./memory.js";

const HOUR = 3600 * 1000;

function logEntry({ date, correct = true, peeked = false, round = 1, sid = "s1" }) {
  return { date: new Date(date).toISOString(), correct, peeked, round, sid };
}

describe("statsKey", () => {
  it("id 優先、なければ word（v1 後方互換）", () => {
    expect(statsKey({ id: "x", word: "apple" })).toBe("x");
    expect(statsKey({ word: "apple" })).toBe("apple");
  });
});

describe("computeMemoryScore (v1 同一アルゴリズム)", () => {
  it("記録なしは 0", () => {
    expect(computeMemoryScore({}, { id: "w" })).toBe(0);
  });

  it("単一セッション・全問非ピーク正解: weight=1 で (1*0.6+1*0.4)*1/1.5", () => {
    const base = Date.now();
    const stats = { w: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [logEntry({ date: base })] } };
    // accuracy = 1/1.5, peekRatio = 1/1.5 → score = 1/1.5 ≈ 0.6667
    expect(computeMemoryScore(stats, "w")).toBeCloseTo(1 / 1.5, 10);
  });

  it("ピーク正解は 0.6 側のみ加算される", () => {
    const base = Date.now();
    const stats = { w: { seen: 1, correct: 1, correctWithoutPeek: 0, log: [logEntry({ date: base, peeked: true })] } };
    expect(computeMemoryScore(stats, "w")).toBeCloseTo((1 / 1.5) * 0.6, 10);
  });

  it("ラウンド減衰: R2 のエントリは weight 0.5", () => {
    const base = Date.now();
    const stats = {
      w: {
        seen: 2, correct: 1, correctWithoutPeek: 1,
        log: [
          logEntry({ date: base, correct: false }),
          logEntry({ date: base + 1000, correct: true, round: 2 }),
        ],
      },
    };
    // weights: R1=1, R2=0.5, total=0.5+1+0.5=2 / correct weight=0.5
    expect(computeMemoryScore(stats, "w")).toBeCloseTo(0.5 / 2, 10);
  });

  it("時間減衰: 前セッション終了から1時間未満の再学習は ×0.6", () => {
    const base = Date.now() - 10 * HOUR;
    const stats = {
      w: {
        seen: 2, correct: 2, correctWithoutPeek: 2,
        log: [
          logEntry({ date: base, sid: "s1" }),
          logEntry({ date: base + 0.5 * HOUR, sid: "s2" }),
        ],
      },
    };
    // s1: decay 1.0 (初回), s2: gap 0.5h → 0.6
    // total = 0.5 + 1 + 0.6 = 2.1, correct = 1.6 → score = 1.6/2.1
    expect(computeMemoryScore(stats, "w")).toBeCloseTo(1.6 / 2.1, 10);
  });

  it("24時間以上空けた再学習は減衰なし", () => {
    const base = Date.now() - 50 * HOUR;
    const stats = {
      w: {
        seen: 2, correct: 2, correctWithoutPeek: 2,
        log: [
          logEntry({ date: base, sid: "s1" }),
          logEntry({ date: base + 30 * HOUR, sid: "s2" }),
        ],
      },
    };
    expect(computeMemoryScore(stats, "w")).toBeCloseTo(2 / 2.5, 10);
  });
});

describe("getMemoryLevel", () => {
  it("seen=0 は未学習 (level 0)", () => {
    const stats = { w: { seen: 0, correct: 0, correctWithoutPeek: 0, log: [] } };
    expect(getMemoryLevel(stats, "w").level).toBe(0);
  });

  it("スコア閾値: ≥0.85→3 / ≥0.55→2 / それ未満→1", () => {
    const mk = (entries) => ({ w: { seen: entries.length, correct: 0, correctWithoutPeek: 0, log: entries } });
    const base = Date.now();
    // 全問正解を重ねる → score = n/(n+0.5) で 0.85 超え
    const good = Array.from({ length: 10 }, (_, i) => logEntry({ date: base + i, sid: "s1" }));
    expect(getMemoryLevel(mk(good), "w").level).toBe(3);
    const oneGood = [logEntry({ date: base })]; // 0.667 → level 2
    expect(getMemoryLevel(mk(oneGood), "w").level).toBe(2);
    const bad = [logEntry({ date: base, correct: false })]; // 0 → level 1
    expect(getMemoryLevel(mk(bad), "w").level).toBe(1);
  });
});

describe("getReappearMultiplier (定着0.3 / あと少し0.7 / 要復習1.3)", () => {
  const base = Date.now();
  it("OFF のときは常に 1", () => {
    const stats = { w: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [logEntry({ date: base })] } };
    expect(getReappearMultiplier(stats, "w", false)).toBe(1);
  });
  it("未学習は 1、要復習帯は 1.3", () => {
    expect(getReappearMultiplier({}, { id: "w" }, true)).toBe(1);
    const weak = { w: { seen: 2, correct: 1, correctWithoutPeek: 0,
      log: [logEntry({ date: base, correct: false }), logEntry({ date: base + 1, correct: true, peeked: true })] } };
    const score = computeMemoryScore(weak, "w");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.55);
    expect(getReappearMultiplier(weak, "w", true)).toBe(1.3);
  });
});

describe("getMemoryBreakdown", () => {
  it("statsKey で重複排除し、学習済みのみで平均スコアを出す", () => {
    const base = Date.now();
    const stats = { a: { seen: 1, correct: 1, correctWithoutPeek: 1, log: [logEntry({ date: base })] } };
    const words = [{ id: "a", word: "x" }, { id: "a", word: "x" }, { id: "b", word: "y" }];
    const bd = getMemoryBreakdown(stats, words);
    expect(bd.total).toBe(2);
    expect(bd.counts[0]).toBe(1); // b は未学習
    expect(bd.counts[2]).toBe(1); // a はあと少し
    expect(bd.avgScore).toBeCloseTo(1 / 1.5, 10);
  });
});
