// 単語帳の取り込み画面（CSV ファイル / 貼り付け）

import { useRef, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { parseCSV } from "../../lib/csv.js";
import { IconChevronLeft, IconFileUp } from "../ui/Icons.jsx";

export function ImportView() {
  const { decks, actions, navigate, goBack } = useApp();
  const [importText, setImportText] = useState("");
  const [deckName, setDeckName] = useState("");
  const fileInputRef = useRef(null);

  const preview = importText ? parseCSV(importText) : [];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target.result);
      if (!deckName) setDeckName(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    const name = deckName.trim() || `単語帳 ${decks.length + 1}`;
    actions.createDeck(name, preview, null);
    navigate("home");
  };

  return (
    <div className="page">
      <header className="sub-header safe-top">
        <button className="back-btn" onClick={goBack} aria-label="戻る">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="sub-header__title">単語帳を追加</h2>
      </header>

      <div className="scroll-wrapper">
        <div className="scroll-area">
          <div className="form-group">
            <label className="form-label">単語帳の名前</label>
            <input
              className="input"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="例: TOEIC 800語"
            />
          </div>

          <div className="form-group">
            <label className="form-label">データの入力</label>
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}>
              <IconFileUp size={17} /> CSVファイルを選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <textarea
              className="input import-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"word,meaning,example_en,example_ja,note\nprocurement,調達,The procurement was delayed.,調達が遅れた。,動詞procureの名詞形\n\n（タブ区切りにも対応・noteは省略可）"}
              spellCheck={false}
            />
          </div>

          {preview.length > 0 && (
            <div className="preview-box">
              <p className="preview-box__label">プレビュー: {preview.length}語を検出</p>
              <div className="preview-box__list">
                {preview.slice(0, 5).map((w, i) => (
                  <div key={i} className="preview-box__item">
                    <span className="preview-box__word">{w.word}</span>
                    <span className="preview-box__meaning">{w.meaning}</span>
                  </div>
                ))}
                {preview.length > 5 && (
                  <p className="preview-box__more">...他{preview.length - 5}語</p>
                )}
              </div>
            </div>
          )}

          <div className="import-hint">
            <span>💡</span>
            <span>
              Claudeに「この単語帳の内容を word,meaning,example_en,example_ja,note
              のCSV形式にして」と頼めば、そのまま貼り付けられます（noteは省略可）
            </span>
          </div>

          <button
            className="btn btn--primary btn--block"
            onClick={handleImport}
            disabled={preview.length === 0}
          >
            {preview.length}語を保存して開始
          </button>
        </div>
        <div className="scroll-fade" />
      </div>
    </div>
  );
}
