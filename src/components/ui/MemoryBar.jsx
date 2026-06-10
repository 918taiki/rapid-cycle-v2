// デッキ/フォルダの記憶度サマリー（平均スコア % + 内訳の積み上げバー）

import { getMemoryBreakdown } from "../../lib/memory.js";

const LEVEL_ORDER = [3, 2, 1, 0]; // 定着 → あと少し → 要復習 → 未学習

export function MemoryBar({ stats, words }) {
  const { total, counts, avgScore } = getMemoryBreakdown(stats, words);
  if (total === 0) return null;
  const pct = avgScore === null ? null : Math.round(avgScore * 100);
  return (
    <div className="memory-bar">
      <span className="memory-bar__pct">{pct === null ? "—" : `${pct}%`}</span>
      <div className="memory-bar__track">
        {LEVEL_ORDER.map((lv) =>
          counts[lv] > 0 ? (
            <div
              key={lv}
              className={`memory-bar__seg memory-bar__seg--lv${lv}`}
              style={{ width: `${(counts[lv] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
