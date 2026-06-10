// 学習セットアップ画面（横断学習 / 今日の復習）。
// 両者は「対象語の集合が違うだけ」なので共通レイアウトを共有する。

import { useMemo, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { decksInFolder } from "../../state/useAppState.js";
import { getMemoryLevel, statsKey } from "../../lib/memory.js";
import { collectDueWords, getOverdueBucket } from "../../lib/review.js";
import { shuffle } from "../../lib/utils.js";
import { FilterChips, memoryFilterOptions, countOptions } from "../ui/FilterChips.jsx";
import { WordRow, WordListEmpty, WordPreviewModal } from "../ui/WordList.jsx";
import { IconChevronLeft, IconShuffle, IconRepeat } from "../ui/Icons.jsx";

function useWordSource(words, stats, filter) {
  return useMemo(() => {
    if (filter === "all") return words;
    const lv = parseInt(filter);
    return words.filter((w) => getMemoryLevel(stats, w).level === lv);
  }, [words, stats, filter]);
}

/** プレビュー対象の出典ラベル（フォルダ › デッキ） */
function useSourceLabel(previewWord) {
  const { decks, folders, wordToDeckMap } = useApp();
  if (!previewWord) return "";
  const deckId = wordToDeckMap.get(statsKey(previewWord));
  const deck = deckId ? decks.find((d) => d.id === deckId) : null;
  if (!deck) return "";
  const folder = deck.folderId ? folders.find((f) => f.id === deck.folderId) : null;
  return folder ? `${folder.name} › ${deck.name}` : deck.name;
}

function SetupLayout({
  icon, title, subtitle, startLabel, onStart, startDisabled,
  chips, words, stats, previewKey, setPreviewKey, previewSourceLabel, goBack,
}) {
  const previewWord =
    previewKey !== null ? words.find((w) => statsKey(w) === previewKey) : null;

  return (
    <div className="page">
      <header className="sub-header safe-top">
        <button className="back-btn" onClick={goBack} aria-label="戻る">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="sub-header__title">
          <span className="sub-header__icon">{icon}</span>
          {title}
        </h2>
      </header>

      <p className="setup-subtitle">{subtitle}</p>

      <button className="btn btn--primary btn--block" disabled={startDisabled} onClick={onStart}>
        {startLabel}
      </button>

      <div className="setup-chips">{chips}</div>

      <div className="scroll-wrapper">
        <div className="scroll-area">
          <div className="word-list">
            {words.length === 0 && <WordListEmpty />}
            {words.map((w) => (
              <WordRow
                key={statsKey(w)}
                word={w}
                stats={stats}
                onClick={() => setPreviewKey(statsKey(w))}
              />
            ))}
          </div>
        </div>
        <div className="scroll-fade" />
      </div>

      {previewWord && (
        <WordPreviewModal
          word={previewWord}
          stats={stats}
          sourceLabel={previewSourceLabel(previewWord)}
          onClose={() => setPreviewKey(null)}
        />
      )}
    </div>
  );
}

// ── 横断学習 ──
export function CrossSetupView() {
  const { route, decks, folders, stats, goBack, startStudy } = useApp();
  const [filter, setFilter] = useState("all");
  const [count, setCount] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);

  const folder = route.folderId ? folders.find((f) => f.id === route.folderId) : null;
  const sourceDecks = folder ? decksInFolder(decks, folder.id) : decks;
  const sourceLabel = folder ? folder.name : "全単語帳";

  // 重複排除した対象語（v1 と同じ: フィルタ前に flatten → フィルタ → 重複排除）
  const availableWords = useMemo(() => {
    const seen = new Set();
    return sourceDecks.flatMap((d) => d.words).filter((w) => {
      const k = statsKey(w);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [sourceDecks]);

  const filteredWords = useWordSource(availableWords, stats, filter);
  const n = count === null || filteredWords.length <= count ? filteredWords.length : count;

  const sourceLabelFor = useSourceLabel(
    previewKey !== null ? filteredWords.find((w) => statsKey(w) === previewKey) : null
  );

  const handleStart = () => {
    const selected =
      count === null ? shuffle(filteredWords) : shuffle(filteredWords).slice(0, count);
    if (selected.length === 0) return;
    startStudy(selected, { label: `${sourceLabel}（横断）`, deckId: null });
  };

  return (
    <SetupLayout
      icon={<IconShuffle size={17} />}
      title="横断学習"
      subtitle={`${sourceLabel}から${filteredWords.length}語が対象`}
      startLabel={`${n}語で学習開始`}
      startDisabled={filteredWords.length === 0}
      onStart={handleStart}
      chips={
        <>
          <FilterChips options={countOptions([10, 25, 50])} value={count} onChange={setCount} ariaLabel="出題数" />
          <FilterChips options={memoryFilterOptions()} value={filter} onChange={setFilter} ariaLabel="記憶度フィルタ" />
        </>
      }
      words={filteredWords}
      stats={stats}
      previewKey={previewKey}
      setPreviewKey={setPreviewKey}
      previewSourceLabel={() => sourceLabelFor}
      goBack={goBack}
    />
  );
}

// ── 今日の復習 ──
const OVERDUE_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "due", label: "期限到来" },
  { value: "1day", label: "1日超過" },
  { value: "3days", label: "3日以上" },
];

export function ReviewView() {
  const { decks, stats, settings, goBack, startStudy } = useApp();
  const [memFilter, setMemFilter] = useState("all");
  const [overdueFilter, setOverdueFilter] = useState("all");
  const [count, setCount] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);

  const dueWords = useMemo(
    () => collectDueWords(decks, stats, settings),
    [decks, stats, settings]
  );

  const memFiltered = useWordSource(dueWords, stats, memFilter);
  const filteredWords = useMemo(() => {
    if (overdueFilter === "all") return memFiltered;
    return memFiltered.filter((w) => getOverdueBucket(stats, w, settings) === overdueFilter);
  }, [memFiltered, stats, settings, overdueFilter]);

  const n = count === null || filteredWords.length <= count ? filteredWords.length : count;

  const sourceLabelFor = useSourceLabel(
    previewKey !== null ? filteredWords.find((w) => statsKey(w) === previewKey) : null
  );

  const handleStart = () => {
    // 超過が大きい順を保ったまま件数制限する（シャッフルはセッション開始時に行われる）
    const limited =
      count === null || filteredWords.length <= count
        ? filteredWords
        : filteredWords.slice(0, count);
    if (limited.length === 0) return;
    startStudy(limited, { label: "今日の復習", deckId: null });
  };

  return (
    <SetupLayout
      icon={<IconRepeat size={16} />}
      title="今日の復習"
      subtitle={`${dueWords.length}語が復習対象`}
      startLabel={`${n}語で学習する`}
      startDisabled={filteredWords.length === 0}
      onStart={handleStart}
      chips={
        <>
          <FilterChips options={countOptions([10, 20, 50])} value={count} onChange={setCount} ariaLabel="出題数" />
          <FilterChips options={memoryFilterOptions()} value={memFilter} onChange={setMemFilter} ariaLabel="記憶度フィルタ" />
          <FilterChips options={OVERDUE_OPTIONS} value={overdueFilter} onChange={setOverdueFilter} ariaLabel="超過期間" />
        </>
      }
      words={filteredWords}
      stats={stats}
      previewKey={previewKey}
      setPreviewKey={setPreviewKey}
      previewSourceLabel={() => sourceLabelFor}
      goBack={goBack}
    />
  );
}
