// 単語帳の詳細画面: 統計サマリー、学習開始（数・記憶度で絞り込み）、
// 単語の検索/プレビュー/編集/追加/削除、CSV エクスポート、フォルダ割り当て

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { getMemoryLevel, statsKey } from "../../lib/memory.js";
import { serializeCsv } from "../../lib/csv.js";
import { genId, shuffle } from "../../lib/utils.js";
import { useToast } from "../ui/Toast.jsx";
import { Modal, ConfirmDialog } from "../ui/Modal.jsx";
import { FilterChips, memoryFilterOptions, countOptions } from "../ui/FilterChips.jsx";
import { WordRow, WordListEmpty, WordPreviewModal } from "../ui/WordList.jsx";
import { IconChevronLeft, IconCopy, IconPencil, IconPlus, IconSearch, IconCheck, IconX } from "../ui/Icons.jsx";

const EMPTY_FORM = { word: "", meaning: "", example_en: "", example_ja: "", note: "" };

function WordEditorModal({ title, form, setForm, onSave, onCancel, onDelete, saveLabel }) {
  const valid = form.word.trim() && form.meaning.trim();
  return (
    <Modal onClose={onCancel} maxWidth={400}>
      <p className="modal-title">{title}</p>
      <div className="edit-fields">
        <input className="input" value={form.word} onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))} placeholder="英単語" autoFocus />
        <input className="input" value={form.meaning} onChange={(e) => setForm((f) => ({ ...f, meaning: e.target.value }))} placeholder="意味" />
        <input className="input input--sm" value={form.example_en} onChange={(e) => setForm((f) => ({ ...f, example_en: e.target.value }))} placeholder="例文（英語）" />
        <input className="input input--sm" value={form.example_ja} onChange={(e) => setForm((f) => ({ ...f, example_ja: e.target.value }))} placeholder="例文（和訳）" />
        <textarea className="input input--sm edit-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="補足（任意）" />
      </div>
      <div className="modal-actions" style={{ marginTop: 14 }}>
        {onDelete && (
          <button className="btn btn--danger btn--narrow" onClick={onDelete}>削除</button>
        )}
        <button className="btn btn--soft" onClick={onCancel}>キャンセル</button>
        <button className="btn btn--primary" disabled={!valid} onClick={onSave}>{saveLabel}</button>
      </div>
    </Modal>
  );
}

export function DeckDetailView() {
  const { route, decks, folders, stats, actions, navigate, goBack, startStudy } = useApp();
  const showToast = useToast();

  const deck = decks.find((d) => d.id === route.deckId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [filter, setFilter] = useState("all");
  const [count, setCount] = useState(null);
  const [query, setQuery] = useState("");
  const [editingWordId, setEditingWordId] = useState(null); // null | "new" | word id
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [previewWordId, setPreviewWordId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "deck" } | { type: "word", id, name }

  // デッキが消えたら（復元上書き等）ホームへ退避。
  // AnimatePresence の exit 中も旧ビューはマウントされたままなので、
  // この画面がアクティブなときだけ判定する
  useEffect(() => {
    if (route.name === "detail" && !deck) navigate("home");
  }, [route.name, deck, navigate]);

  const words = useMemo(() => deck?.words ?? [], [deck]);

  const levelCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const w of words) counts[getMemoryLevel(stats, w).level]++;
    return counts;
  }, [words, stats]);

  const filteredWords = useMemo(() => {
    let list = words;
    if (filter !== "all") {
      const lv = parseInt(filter);
      list = list.filter((w) => getMemoryLevel(stats, w).level === lv);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) => w.word.toLowerCase().includes(q) || (w.meaning || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [words, stats, filter, query]);

  if (!deck) return null;

  const masteredCount = levelCounts[3];
  const studiedWords = words.filter((w) => stats[statsKey(w)]?.seen > 0);
  const avgScore =
    studiedWords.length === 0
      ? null
      : Math.round(
          (studiedWords.reduce((sum, w) => sum + getMemoryLevel(stats, w).score, 0) /
            studiedWords.length) * 100
        );

  const studyCount = count === null || filteredWords.length <= count ? filteredWords.length : count;

  const handleStartStudy = () => {
    const studyWords =
      count === null || filteredWords.length <= count
        ? filteredWords
        : shuffle([...filteredWords]).slice(0, count);
    if (studyWords.length === 0) return;
    startStudy(studyWords, { label: deck.name, deckId: deck.id });
  };

  const handleRename = () => {
    if (!renameValue.trim()) return;
    actions.renameDeck(deck.id, renameValue.trim());
    setIsRenaming(false);
  };

  const handleExport = async () => {
    const csv = serializeCsv(deck.words);
    try {
      await navigator.clipboard.writeText(csv);
      showToast("CSV をコピーしました", "success");
    } catch {
      // iOS 以外のフォールバック: 別ウィンドウに表示
      const w = window.open();
      if (w) w.document.write(`<pre>${csv.replace(/</g, "&lt;")}</pre>`);
    }
  };

  const openEditor = (word) => {
    setEditForm({
      word: word.word,
      meaning: word.meaning,
      example_en: word.example_en || "",
      example_ja: word.example_ja || "",
      note: word.note || "",
    });
    setEditingWordId(word.id || word.word);
  };

  const saveEditor = () => {
    if (!editForm.word.trim() || !editForm.meaning.trim()) return;
    const fields = {
      word: editForm.word.trim(),
      meaning: editForm.meaning.trim(),
      example_en: editForm.example_en.trim(),
      example_ja: editForm.example_ja.trim(),
      note: editForm.note.trim(),
    };
    let newWords;
    if (editingWordId === "new") {
      newWords = [...deck.words, { id: genId(), ...fields }];
    } else {
      // 既存 ID を保持してスペル修正でも学習記録が消えないようにする（v1 同様）
      newWords = deck.words.map((w) =>
        (w.id || w.word) === editingWordId ? { ...w, ...fields } : w
      );
    }
    actions.updateDeckWords(deck.id, newWords);
    setEditingWordId(null);
  };

  const deleteWord = (wordKey) => {
    const newWords = deck.words.filter((w) => (w.id || w.word) !== wordKey);
    actions.updateDeckWords(deck.id, newWords);
    setEditingWordId(null);
    setConfirmTarget(null);
  };

  const previewWord =
    previewWordId !== null ? words.find((w) => (w.id || w.word) === previewWordId) : null;

  return (
    <div className="page">
      <header className="sub-header safe-top">
        <button className="back-btn" onClick={goBack} aria-label="戻る">
          <IconChevronLeft size={20} />
        </button>
        {isRenaming ? (
          <div className="rename-row">
            <input
              className="input rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
            />
            <button className="icon-btn icon-btn--success" onClick={handleRename} aria-label="決定">
              <IconCheck size={16} />
            </button>
            <button className="icon-btn" onClick={() => setIsRenaming(false)} aria-label="キャンセル">
              <IconX size={16} />
            </button>
          </div>
        ) : (
          <h2
            className="sub-header__title sub-header__title--editable"
            onClick={() => { setIsRenaming(true); setRenameValue(deck.name); }}
          >
            {deck.name} <span className="edit-hint-icon"><IconPencil size={13} /></span>
          </h2>
        )}
      </header>

      {/* 統計サマリー */}
      <div className="stat-summary">
        <div className="stat-summary__item">
          <span className="stat-summary__value">{words.length}</span>
          <span className="stat-summary__label">全単語</span>
        </div>
        <div className="stat-summary__item">
          <span className={`stat-summary__value${masteredCount > 0 ? " memory-text--lv3" : ""}`}>
            {masteredCount}
          </span>
          <span className="stat-summary__label">定着済み</span>
        </div>
        <div className="stat-summary__item">
          <span className="stat-summary__value">{avgScore !== null ? `${avgScore}%` : "—"}</span>
          <span className="stat-summary__label">記憶度</span>
        </div>
      </div>

      {/* アクション */}
      <div className="action-row">
        <button
          className="btn btn--primary action-row__main"
          disabled={filteredWords.length === 0}
          onClick={handleStartStudy}
        >
          {studyCount}語で学習する
        </button>
        <button className="icon-btn icon-btn--lg" onClick={handleExport} aria-label="CSVをコピー">
          <IconCopy size={17} />
        </button>
      </div>

      {/* フォルダ割り当て */}
      {folders.length > 0 && (
        <select
          className="select"
          value={deck.folderId || ""}
          onChange={(e) => actions.moveDeckToFolder(deck.id, e.target.value || null)}
        >
          <option value="">未分類</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>📁 {f.name}</option>
          ))}
        </select>
      )}

      <FilterChips
        options={countOptions([10, 25, 50])}
        value={count}
        onChange={setCount}
        ariaLabel="出題数"
      />
      <FilterChips
        options={memoryFilterOptions(levelCounts)}
        value={filter}
        onChange={setFilter}
        ariaLabel="記憶度フィルタ"
      />

      {/* 検索 */}
      <div className="search-box">
        <IconSearch size={15} />
        <input
          className="search-box__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・意味を検索"
        />
        {query && (
          <button className="search-box__clear" onClick={() => setQuery("")} aria-label="クリア">
            <IconX size={14} />
          </button>
        )}
      </div>

      {/* 単語リスト */}
      <div className="scroll-wrapper">
        <div className="scroll-area">
          <div className="word-list">
            {filteredWords.length === 0 && <WordListEmpty />}
            {filteredWords.map((w) => (
              <WordRow
                key={w.id || w.word}
                word={w}
                stats={stats}
                onClick={() => setPreviewWordId(w.id || w.word)}
              />
            ))}
            {filter === "all" && !query && (
              <button
                className="add-word-btn"
                onClick={() => { setEditForm(EMPTY_FORM); setEditingWordId("new"); }}
              >
                <IconPlus size={15} /> 単語を追加
              </button>
            )}
          </div>

          <div className="danger-zone">
            <button className="btn btn--danger-ghost" onClick={() => setConfirmTarget({ type: "deck" })}>
              この単語帳を削除
            </button>
          </div>
        </div>
        <div className="scroll-fade" />
      </div>

      {/* プレビュー */}
      {previewWord && (
        <WordPreviewModal
          word={previewWord}
          stats={stats}
          onClose={() => setPreviewWordId(null)}
          onEdit={() => {
            setPreviewWordId(null);
            openEditor(previewWord);
          }}
        />
      )}

      {/* 編集 / 追加 */}
      {editingWordId !== null && (
        <WordEditorModal
          title={editingWordId === "new" ? "単語を追加" : "単語を編集"}
          form={editForm}
          setForm={setEditForm}
          saveLabel={editingWordId === "new" ? "追加" : "保存"}
          onSave={saveEditor}
          onCancel={() => setEditingWordId(null)}
          onDelete={
            editingWordId === "new"
              ? undefined
              : () => setConfirmTarget({ type: "word", id: editingWordId, name: editForm.word })
          }
        />
      )}

      {/* 削除確認 */}
      {confirmTarget?.type === "deck" && (
        <ConfirmDialog
          title="単語帳を削除"
          desc={`「${deck.name}」を削除しますか？この操作は取り消せません。`}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => {
            setConfirmTarget(null);
            actions.deleteDeck(deck.id);
            navigate("home");
          }}
        />
      )}
      {confirmTarget?.type === "word" && (
        <ConfirmDialog
          title="単語を削除"
          desc={`「${confirmTarget.name}」を削除しますか？`}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => deleteWord(confirmTarget.id)}
        />
      )}
    </div>
  );
}
