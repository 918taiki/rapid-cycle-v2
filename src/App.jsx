// Rapid Cycle v2 — アプリケーションシェル。
// 状態（useAppState）・クラウド同期（useCloudSync）・学習エンジン（useStudyEngine）・
// ナビゲーションを束ね、AppContext として各ビューに供給する。

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { AppContext } from "./state/AppContext.jsx";
import { useAppState } from "./state/useAppState.js";
import { useAppActions } from "./state/useAppActions.js";
import { useCloudSync } from "./hooks/useCloudSync.js";
import { useStudyEngine } from "./hooks/useStudyEngine.js";
import { useNavigation, useEdgeSwipeBack } from "./hooks/useNavigation.js";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { HomeView } from "./components/views/HomeView.jsx";
import { FolderView } from "./components/views/FolderView.jsx";
import { DeckDetailView } from "./components/views/DeckDetailView.jsx";
import { CrossSetupView, ReviewView } from "./components/views/StudySetupViews.jsx";
import { ImportView } from "./components/views/ImportView.jsx";
import { StudyView } from "./components/views/StudyView.jsx";
import { ResultView } from "./components/views/ResultView.jsx";
import { SettingsView } from "./components/views/SettingsView.jsx";

const THEME_BG = { dark: "#0b0c12", light: "#f3f1ec" };

const VIEWS = {
  home: HomeView,
  folder: FolderView,
  detail: DeckDetailView,
  crossSetup: CrossSetupView,
  review: ReviewView,
  import: ImportView,
  study: StudyView,
  result: ResultView,
  settings: SettingsView,
};

export default function App() {
  const app = useAppState();
  const cloud = useCloudSync(app);
  const actions = useAppActions(app, cloud);
  const engine = useStudyEngine(app);
  const nav = useNavigation();
  const { route, navigate, replace, resetTo, goBack } = nav;

  // テーマ適用（data-theme 属性 + メタ theme-color）
  const theme = app.settings.theme === "light" ? "light" : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BG[theme]);
  }, [theme]);

  // エッジスワイプバック（学習画面では無効）
  useEdgeSwipeBack(route.name !== "study", goBack);

  // 起動時の自動復元: gasUrl 設定済みでローカルが空のとき
  const autoRestoredRef = useRef(false);
  useEffect(() => {
    if (autoRestoredRef.current) return;
    if (!app.settings.gasUrl) return;
    if (app.decks.length > 0 || app.folders.length > 0 || Object.keys(app.stats).length > 0) return;
    autoRestoredRef.current = true;
    cloud.runCloudRestore({ silent: true });
  }, [app.settings.gasUrl, app.decks.length, app.folders.length, app.stats, cloud]);

  // 学習終了時: 触れたデッキだけ差分同期（5 分スロットルは useCloudSync 側）
  useEffect(() => {
    if (route.name !== "result") return;
    cloud.syncDecksAfterStudy(engine.touchedDeckIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name]);

  const ctx = useMemo(() => ({
    ...app,
    actions,
    cloud,
    engine,
    route,
    navigate,
    replace,
    resetTo,
    goBack,
    /** セッションを開始して学習画面へ */
    startStudy(words, opts) {
      engine.start(words, opts);
      if (route.name === "result") {
        replace("study"); // 「もう一周」は履歴を積まない
      } else {
        navigate("study", {});
      }
    },
    /** 学習完了 → 結果画面（履歴は study を置き換える） */
    finishStudy() {
      replace("result");
    },
    /** 学習を中断してデッキ詳細 or ホームへ */
    quitStudy() {
      const deckId = engine.session?.deckId;
      if (deckId) {
        resetTo([{ name: "home" }, { name: "detail", deckId }]);
      } else {
        resetTo([{ name: "home" }]);
      }
    },
  }), [app, actions, cloud, engine, route, navigate, replace, resetTo, goBack]);

  const View = VIEWS[route.name] ?? HomeView;

  return (
    <AppContext.Provider value={ctx}>
      <ToastProvider>
        <AnimatePresence mode="popLayout" initial={false}>
          <Motion.div
            key={route.name + (route.deckId ?? "") + (route.folderId ?? "")}
            className="shell"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <View />
          </Motion.div>
        </AnimatePresence>
      </ToastProvider>
    </AppContext.Provider>
  );
}
