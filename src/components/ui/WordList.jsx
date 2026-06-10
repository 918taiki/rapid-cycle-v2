// 単語一覧の行とプレビューモーダル（詳細・横断学習・復習画面で共用）

import { useState } from "react";
import { getMemoryLevel, getWordStats, getLastStudied } from "../../lib/memory.js";
import { formatRelativeDate } from "../../lib/utils.js";
import { Modal } from "./Modal.jsx";
import { FlipCard, CardFront, CardBack } from "./CardFace.jsx";

export function WordRow({ word, stats, onClick }) {
  const mem = getMemoryLevel(stats, word);
  const st = getWordStats(stats, word);
  const last = getLastStudied(stats, word);
  return (
    <button className="word-row" onClick={onClick}>
      <span className={`memory-dot memory-dot--lv${mem.level}`} />
      <span className="word-row__text">
        <span className="word-row__word">{word.word}</span>
        <span className="word-row__meaning">{word.meaning}</span>
      </span>
      <span className="word-row__right">
        <span className={`memory-tag memory-tag--lv${mem.level}`}>{mem.label}</span>
        {st.seen > 0 && (
          <span className="word-row__stats">
            {Math.round(mem.score * 100)}%{last ? ` · ${formatRelativeDate(last)}` : ""}
          </span>
        )}
      </span>
    </button>
  );
}

export function WordListEmpty({ children = "該当する単語がありません" }) {
  return <p className="word-list-empty">{children}</p>;
}

/**
 * 単語カードのプレビューモーダル。タップで表裏を反転できる。
 * sourceLabel: 出典（フォルダ › デッキ）表示、onEdit: 編集ボタン（詳細画面のみ）
 */
export function WordPreviewModal({ word, stats, sourceLabel, onClose, onEdit }) {
  const [flipped, setFlipped] = useState(false);
  const mem = getMemoryLevel(stats, word);
  const st = getWordStats(stats, word);
  const last = getLastStudied(stats, word);

  return (
    <Modal onClose={onClose} maxWidth={420} bare>
      <div className="preview-stack">
        {sourceLabel && <p className="preview-source">{sourceLabel}</p>}
        <FlipCard
          flipped={flipped}
          className="flip-container--preview"
          onClick={() => setFlipped((f) => !f)}
          front={
            <div className="card card--preview">
              <CardFront card={word} hint="タップで裏面を表示" />
            </div>
          }
          back={
            <div className="card card--preview">
              <CardBack card={word} hint="タップで表面に戻す" />
            </div>
          }
        />
        <div className="preview-actions">
          <button className="btn btn--ghost" onClick={onClose}>閉じる</button>
          {onEdit && (
            <button className="btn btn--primary" onClick={onEdit}>編集する</button>
          )}
        </div>
        <div className="preview-meta">
          <span className={`memory-text--lv${mem.level}`}>{mem.label}</span>
          {st.seen > 0 && <span>{Math.round(mem.score * 100)}%</span>}
          {last && <span>{formatRelativeDate(last)}</span>}
        </div>
      </div>
    </Modal>
  );
}
