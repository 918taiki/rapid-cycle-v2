// アプリ全体のコンテキスト。App.jsx が値を組み立て、各ビューが useApp() で参照する

import { createContext, useContext } from "react";

export const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext.Provider");
  return ctx;
}
