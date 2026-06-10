// カードのスワイプ/タップ判定（Pointer Events ベース）。
// v1 のタッチ専用実装と同じ判定仕様:
//   - 8px 動いた時点で水平/垂直を判定し、水平のみ追従
//   - 水平 60px 超で確定（onCommit）、ほぼ動かなければタップ（onTap）
//   - 確定直後 120ms はロックして連続スワイプの誤爆を防ぐ
// Pointer Events によりマウスでも操作できる（v1 からの改善）。

import { useCallback, useRef, useState } from "react";

export const SWIPE_THRESHOLD = 60;
const AXIS_LOCK_DISTANCE = 8;
const DISMISS_LOCK_MS = 120;

export function useCardSwipe({ onCommit, onTap, getCard }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const startRef = useRef(null); // { x, y, card, pointerId }
  const axisRef = useRef(null); // null | "horizontal" | "vertical"
  const lockRef = useRef(false);

  /** 確定直後の誤操作防止ロック */
  const lockBriefly = useCallback(() => {
    lockRef.current = true;
    setTimeout(() => { lockRef.current = false; }, DISMISS_LOCK_MS);
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    axisRef.current = null;
    setDrag({ x: 0, y: 0, dragging: false });
  }, []);

  const onPointerDown = useCallback((e) => {
    if (lockRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, card: getCard(), pointerId: e.pointerId };
    axisRef.current = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [getCard]);

  const onPointerMove = useCallback((e) => {
    const start = startRef.current;
    if (!start || e.pointerId !== start.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (axisRef.current === null) {
      if (Math.abs(dx) > AXIS_LOCK_DISTANCE || Math.abs(dy) > AXIS_LOCK_DISTANCE) {
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      } else {
        return;
      }
    }
    if (axisRef.current !== "horizontal") return;
    setDrag({ x: dx, y: dy, dragging: true });
  }, []);

  const onPointerUp = useCallback((e) => {
    const start = startRef.current;
    if (!start || e.pointerId !== start.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const axis = axisRef.current;

    // 確定間にカードが入れ替わっていたら無効（v1 の cardMismatch ガード相当）
    const cardChanged = start.card !== null && start.card !== getCard();

    if (!cardChanged && axis === "horizontal" && Math.abs(dx) > SWIPE_THRESHOLD) {
      lockBriefly();
      onCommit(dx > 0 ? "right" : "left", { x: dx, y: dy });
    } else if (!cardChanged && axis === null) {
      onTap();
    }
    reset();
  }, [getCard, onCommit, onTap, lockBriefly, reset]);

  const onPointerCancel = useCallback(() => reset(), [reset]);

  return {
    swipeX: drag.x,
    swipeY: drag.y,
    dragging: drag.dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
