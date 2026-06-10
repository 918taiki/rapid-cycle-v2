import { useEffect, useRef } from "react";

/**
 * 常に最新の値を指す ref を返す。
 * デバウンスや非同期コールバックなど「発火時点の最新 state」を
 * 読みたい場面で使う（描画中には読まないこと）。
 */
export function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
