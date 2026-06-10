// フラッシュカードの表面/裏面コンテンツと 3D フリップラッパー

import { highlightWord } from "../../lib/utils.js";

/** 例文中の出題単語（と語尾変化）をハイライト表示する */
export function HighlightedSentence({ sentence, word, className }) {
  const parts = highlightWord(sentence, word);
  if (!Array.isArray(parts)) return <span className={className}>{sentence}</span>;
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase().startsWith(word.toLowerCase()) ? (
          <mark key={i} className="hl">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/** 表面: 例文（出題単語ハイライト）。例文がなければ単語そのもの */
export function CardFront({ card, hint, muted = false }) {
  return (
    <div className={`card-face-content${muted ? " card-face-content--muted" : ""}`}>
      <div className="card-example-area">
        {card.example_en ? (
          <p className="card-sentence">
            <HighlightedSentence sentence={card.example_en} word={card.word} />
          </p>
        ) : (
          <p className="card-sentence card-sentence--word-only">{card.word}</p>
        )}
      </div>
      {hint && <p className="card-hint">{hint}</p>}
    </div>
  );
}

/** 裏面: 例文（小）+ 単語・意味・和訳・補足 */
export function CardBack({ card, hint }) {
  return (
    <div className="card-face-content">
      {card.example_en && (
        <p className="card-sentence card-sentence--small">
          <HighlightedSentence sentence={card.example_en} word={card.word} />
        </p>
      )}
      <div className="card-divider" />
      <div className="card-answer">
        <div className="card-answer__main">
          <span className="card-answer__word">{card.word}</span>
          <span className="card-answer__meaning">{card.meaning}</span>
        </div>
        {card.example_ja && <p className="card-answer__ja">{card.example_ja}</p>}
        {card.note && <p className="card-answer__note">{card.note}</p>}
      </div>
      {hint && <p className="card-hint">{hint}</p>}
    </div>
  );
}

/**
 * 3D フリップカード。direction でどちら回りに回転するかが決まる
 * （右スワイプ → 右回転、左スワイプ → 左回転。v1 と同じ気持ちよさを再現）
 */
export function FlipCard({ flipped, direction = "right", front, back, className = "", onClick }) {
  const angle = direction === "left" ? -180 : 180;
  return (
    <div className={`flip-container ${className}`} onClick={onClick}>
      <div
        className="flip-inner"
        style={{ transform: flipped ? `rotateY(${angle}deg)` : "rotateY(0deg)" }}
      >
        <div className="flip-face">{front}</div>
        <div className="flip-face flip-face--back" style={{ transform: `rotateY(${angle}deg)` }}>
          {back}
        </div>
      </div>
    </div>
  );
}
