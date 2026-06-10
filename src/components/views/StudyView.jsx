// 学習画面: カードスタック + スワイプ判定。
//
// 操作仕様（v1 と同一）:
//   - 1回目のスワイプ: その場で 3D 回転して裏面表示（右→右回転、左→左回転）。記録されない
//   - 2回目のスワイプ or タップ: カードが軌道に沿って飛び、判定が記録される
//     1回目と逆方向にスワイプすれば判定を覆せる
//   - タップで先に裏面を見てからのスワイプ判定は peeked=true として記録
//   - 「もどす」で直前の判定を取り消せる（同一ラウンド内のみ）
//
// アニメーション設計（v1 と同一）:
//   - currentIdx は即座に進める（待ち時間ゼロ）
//   - 飛んでいくカードは animatingCards 配列で独立管理し、2 フレーム目で exit へ遷移
//   - z-index: 飛翔カード 25 / トップ 20 / 背景 10 以下

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { useCardSwipe } from "../../hooks/useCardSwipe.js";
import { CardFront, CardBack, FlipCard } from "../ui/CardFace.jsx";
import { Modal } from "../ui/Modal.jsx";
import { IconX, IconUndo } from "../ui/Icons.jsx";

const FLY_REMOVE_MS = 1100;

export function StudyView() {
  const { engine, finishStudy, quitStudy } = useApp();
  const { cards, currentIdx, currentCard, round } = engine;

  const [flipped, setFlipped] = useState(false);
  const [flipDirection, setFlipDirection] = useState("right");
  const [waitingForTap, setWaitingForTap] = useState(false);
  const [pendingResult, setPendingResult] = useState(null); // "correct" | "incorrect" | null
  const [animatingCards, setAnimatingCards] = useState([]);
  const [rewindAnim, setRewindAnim] = useState(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const animIdRef = useRef(0);

  // タイマー / RAF のクリーンアップ管理
  const timersRef = useRef(new Set());
  const rafsRef = useRef(new Set());
  useEffect(() => {
    const timers = timersRef.current;
    const rafs = rafsRef.current;
    return () => {
      timers.forEach(clearTimeout);
      rafs.forEach(cancelAnimationFrame);
    };
  }, []);
  const scheduleTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
  }, []);
  const scheduleRAF = useCallback((fn) => {
    const id = requestAnimationFrame(() => { rafsRef.current.delete(id); fn(); });
    rafsRef.current.add(id);
  }, []);

  const resetInteraction = useCallback(() => {
    setFlipped(false);
    setFlipDirection("right");
    setWaitingForTap(false);
    setPendingResult(null);
  }, []);

  /** カード確定: 飛翔アニメーションを起動し、エンジンに判定を渡す */
  const dismissCard = useCallback((direction, correct, end) => {
    const card = currentCard;
    if (!card) return;
    const peeked = !waitingForTap; // 先に答えを見てから判定したか
    const wasFlipped = flipped;

    const id = ++animIdRef.current;
    const exitX = direction === "right" ? 500 : -500;
    const exitY = end.y ? (end.y / (Math.abs(end.x) || 1)) * Math.abs(exitX) * 0.3 : 0;
    const exitRotate = direction === "right" ? 15 : -15;
    setAnimatingCards((prev) => [
      ...prev,
      { id, card, wasFlipped, startX: end.x || 0, startY: end.y || 0, exitX, exitY, exitRotate, phase: "start" },
    ]);
    // 2 フレーム目で exit に遷移させて transition を発火させる
    scheduleRAF(() => {
      scheduleRAF(() => {
        setAnimatingCards((prev) => prev.map((a) => (a.id === id ? { ...a, phase: "exit" } : a)));
      });
    });
    scheduleTimeout(() => {
      setAnimatingCards((prev) => prev.filter((a) => a.id !== id));
    }, FLY_REMOVE_MS);

    resetInteraction();
    const { finished } = engine.dismiss(card, { correct, peeked, direction });
    if (finished) finishStudy();
  }, [currentCard, waitingForTap, flipped, engine, finishStudy, resetInteraction, scheduleRAF, scheduleTimeout]);

  const handleCommit = useCallback((direction, end) => {
    const correct = direction === "right";
    if (waitingForTap || flipped) {
      // 2回目のスワイプ（方向で判定を上書き可能） or ピーク後の判定スワイプ
      dismissCard(direction, correct, end);
    } else {
      // 1回目のスワイプ: 判定を仮確定して裏面を見せる
      setFlipDirection(direction);
      setFlipped(true);
      setWaitingForTap(true);
      setPendingResult(correct ? "correct" : "incorrect");
    }
  }, [waitingForTap, flipped, dismissCard]);

  const handleTap = useCallback(() => {
    if (waitingForTap) {
      const correct = pendingResult === "correct";
      dismissCard(correct ? "right" : "left", correct, { x: 0, y: 0 });
    } else if (!flipped) {
      // 先に答えを見る（ピーク）
      setFlipped(true);
      setFlipDirection("right");
    }
  }, [waitingForTap, pendingResult, flipped, dismissCard]);

  const { swipeX, swipeY, handlers } = useCardSwipe({
    onCommit: handleCommit,
    onTap: handleTap,
    getCard: () => engine.currentCard,
  });

  const handleRewind = () => {
    const anim = engine.rewind();
    if (!anim) return;
    resetInteraction();
    setAnimatingCards([]);
    setRewindAnim(anim);
  };

  if (!currentCard) return null;

  const stackCards = cards.slice(currentIdx, currentIdx + 3);
  const swipeOpacity = Math.min(Math.abs(swipeX) / 120, 1);
  const swipeRotate = (swipeX / 800) * 8;
  const judging = Math.abs(swipeX) > 60;

  return (
    <div className="page study-page">
      <div className="study-nav safe-top">
        <button className="icon-btn" onClick={() => setShowQuitModal(true)} aria-label="学習を中断">
          <IconX size={18} />
        </button>
        <div className="study-meta">
          <span className="round-pill">R{round}</span>
          <span className="card-count">{currentIdx + 1}/{cards.length}</span>
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${(currentIdx / cards.length) * 100}%` }} />
      </div>

      {/* スワイプ方向インジケーター */}
      {swipeX !== 0 && (
        <>
          <div className="swipe-indicator swipe-indicator--right" style={{ opacity: swipeX > 0 ? swipeOpacity : 0 }}>
            ○
          </div>
          <div className="swipe-indicator swipe-indicator--left" style={{ opacity: swipeX < 0 ? swipeOpacity : 0 }}>
            ✕
          </div>
        </>
      )}

      <div className="card-area">
        <div className="stack-container" {...handlers} style={{ touchAction: "none" }}>
          {/* 背景カード */}
          {stackCards.slice(1).reverse().map((card, reverseIdx) => {
            const depth = stackCards.length - 1 - reverseIdx;
            return (
              <div
                key={`bg-${currentIdx + depth}`}
                className="stack-card"
                style={{
                  transform: `scale(${1 - depth * 0.04}) translateY(${depth * 16}px)`,
                  zIndex: 10 - depth,
                  transition: "transform 0.3s ease-out",
                }}
              >
                <div className="card card--stacked">
                  <div className="card-example-area">
                    <p className="card-sentence card-sentence--ghost">
                      {card.example_en || card.word}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 飛んでいくカード */}
          {animatingCards.map((anim) => {
            const isExit = anim.phase === "exit";
            return (
              <div
                key={`anim-${anim.id}`}
                className="stack-card stack-card--flying"
                style={{
                  transform: isExit
                    ? `translateX(${anim.exitX}px) translateY(${anim.exitY}px) rotate(${anim.exitRotate}deg)`
                    : `translateX(${anim.startX}px) translateY(${anim.startY}px) rotate(${(anim.startX / 800) * 8}deg)`,
                  opacity: isExit ? 0 : 1,
                  transition: isExit
                    ? "transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.85s ease-out"
                    : "none",
                }}
              >
                <div className="card">
                  {anim.wasFlipped ? <CardBack card={anim.card} /> : <CardFront card={anim.card} />}
                </div>
              </div>
            );
          })}

          {/* トップカード */}
          <div
            key={`top-${currentIdx}-${round}${rewindAnim ? "-rw" : ""}`}
            className={`stack-card stack-card--top${judging ? (swipeX > 0 ? " stack-card--judge-right" : " stack-card--judge-left") : ""}`}
            style={{
              transform: `translateX(${swipeX}px) translateY(${swipeY}px) rotate(${swipeRotate}deg)`,
              transition: swipeX !== 0 ? "none" : "transform 0.12s ease-out",
              animation: rewindAnim
                ? `${rewindAnim.fromDirection === "right" ? "cardRewindFromRight" : "cardRewindFromLeft"} 0.5s cubic-bezier(0.22, 1, 0.36, 1)`
                : swipeX === 0 && !flipped
                  ? "cardPromote 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
                  : "none",
            }}
            onAnimationEnd={() => { if (rewindAnim) setRewindAnim(null); }}
          >
            <FlipCard
              flipped={flipped}
              direction={flipDirection}
              front={
                <div className="card">
                  <CardFront card={currentCard} hint="タップで意味を表示" />
                </div>
              }
              back={
                <div className="card">
                  <CardBack
                    card={currentCard}
                    hint={waitingForTap ? "タップで次へ" : "スワイプで回答"}
                  />
                </div>
              }
            />
          </div>
        </div>
      </div>

      <div className="swipe-instruction">
        <span className="swipe-instruction__left">← わからない</span>
        <span className="swipe-instruction__right">わかる →</span>
      </div>

      <div className="rewind-bar safe-bottom">
        <button
          className="rewind-btn"
          onClick={handleRewind}
          disabled={!engine.canRewind || waitingForTap}
          aria-label="直前の判定を取り消す"
        >
          <IconUndo size={15} /> もどす
        </button>
      </div>

      {showQuitModal && (
        <Modal onClose={() => setShowQuitModal(false)}>
          <p className="modal-title">学習を中断しますか？</p>
          <p className="modal-desc">学習記録は保存されますが、次回は最初からやり直しになります。</p>
          <div className="modal-actions">
            <button className="btn btn--soft" onClick={() => setShowQuitModal(false)}>続ける</button>
            <button className="btn btn--danger" onClick={() => { setShowQuitModal(false); quitStudy(); }}>
              中断する
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
