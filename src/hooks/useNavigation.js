// 画面遷移（ルートスタック方式）。
// view: home | folder | detail | import | crossSetup | review | study | result | settings
//
// v1 の view ステートに対する改善点:
//   - 戻り先をスタックで保持するため「フォルダ → 詳細 → 戻る」がフォルダに戻る
//   - 学習画面以外では左端からのエッジスワイプで戻れる（v1 同等）

import { useCallback, useEffect, useState } from "react";
import { useLatest } from "./useLatest.js";

export function useNavigation() {
  const [stack, setStack] = useState([{ name: "home" }]);
  const route = stack[stack.length - 1];

  const navigate = useCallback((name, params = {}) => {
    setStack((prev) => {
      if (name === "home") return [{ name: "home" }];
      return [...prev, { name, ...params }];
    });
  }, []);

  /** 現在のルートを置き換える（study → result など履歴に残したくない遷移用） */
  const replace = useCallback((name, params = {}) => {
    setStack((prev) => [...prev.slice(0, -1), { name, ...params }]);
  }, []);

  /** スタックを丸ごと差し替える（学習中断 → 詳細に戻る等） */
  const resetTo = useCallback((routes) => {
    setStack(routes);
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return { route, navigate, replace, resetTo, goBack, canGoBack: stack.length > 1 };
}

/** Safari 風エッジスワイプバック（学習画面では無効） */
export function useEdgeSwipeBack(enabled, goBack) {
  const goBackRef = useLatest(goBack);

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (t.clientX < 30) {
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      }
    };
    const onTouchEnd = (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 80 && dy < dx) goBackRef.current();
    };
    const onTouchCancel = () => { tracking = false; };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, goBackRef]);
}
