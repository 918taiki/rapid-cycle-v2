// 学習完了画面: セッションのサマリーと次のアクション

import { useApp } from "../../state/AppContext.jsx";
import { IconCheck } from "../ui/Icons.jsx";

export function ResultView() {
  const { engine, navigate, resetTo, startStudy } = useApp();
  const session = engine.session;
  if (!session) return null;

  return (
    <div className="page result-page">
      <div className="result-content">
        <div className="result-check">
          <IconCheck size={30} />
        </div>
        <h2 className="result-title">完了！</h2>
        {session.label && <p className="result-source">{session.label}</p>}

        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat__value">{session.words.length}</span>
            <span className="result-stat__label">単語数</span>
          </div>
          <div className="result-stat">
            <span className="result-stat__value">{engine.round}</span>
            <span className="result-stat__label">ラウンド</span>
          </div>
          <div className="result-stat">
            <span className="result-stat__value">{engine.sessionTotal}</span>
            <span className="result-stat__label">総レビュー</span>
          </div>
        </div>

        <div className="result-actions">
          <button
            className="btn btn--primary btn--block"
            onClick={() => startStudy(session.words, { label: session.label, deckId: session.deckId })}
          >
            もう一周する
          </button>
          {session.deckId && (
            <button
              className="btn btn--ghost btn--block"
              onClick={() => resetTo([{ name: "home" }, { name: "detail", deckId: session.deckId }])}
            >
              単語リストを見る
            </button>
          )}
          {session.label === "今日の復習" && (
            <button
              className="btn btn--ghost btn--block"
              onClick={() => resetTo([{ name: "home" }, { name: "review" }])}
            >
              復習画面に戻る
            </button>
          )}
          <button className="btn btn--ghost btn--block" onClick={() => navigate("home")}>
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
