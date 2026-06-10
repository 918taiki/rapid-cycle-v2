// ホーム画面: 単語帳/フォルダ一覧、横断学習・今日の復習への入口、追加メニュー

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion, Reorder } from "framer-motion";
import { useApp } from "../../state/AppContext.jsx";
import { decksInFolder, sortedFolders } from "../../state/useAppState.js";
import { collectDueWords } from "../../lib/review.js";
import { statsKey } from "../../lib/memory.js";
import { SAMPLE_WORDS } from "../../data/sampleDeck.js";
import { MemoryBar } from "../ui/MemoryBar.jsx";
import { Modal } from "../ui/Modal.jsx";
import {
  IconGear, IconPlay, IconPlus, IconShuffle, IconRepeat, IconFolder,
  IconChevronDown, IconChevronLeft, IconCards, IconSort, IconBook,
} from "../ui/Icons.jsx";

function DeckRow({ deck, stats, onOpen, onPlay, disabled }) {
  const studied = deck.words.filter((w) => stats[statsKey(w)]?.seen > 0).length;
  return (
    <div className="deck-card">
      <button className="deck-card__info" onClick={onOpen} disabled={disabled}>
        <span className="deck-card__name">{deck.name}</span>
        <span className="deck-card__meta">{deck.words.length}語 · {studied}語 学習済み</span>
      </button>
      <MemoryBar stats={stats} words={deck.words} />
      <button className="icon-btn icon-btn--accent" onClick={onPlay} disabled={disabled} aria-label={`${deck.name}を学習`}>
        <IconPlay size={16} />
      </button>
    </div>
  );
}

export function HomeView() {
  const {
    decks, folders, stats, decksRef, foldersRef,
    setDecks, setFolders, actions, cloud, navigate, startStudy, settings,
  } = useApp();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [reorderMode, setReorderMode] = useState(false);

  const totalWords = decks.reduce((sum, d) => sum + d.words.length, 0);
  const dueCount = collectDueWords(decks, stats, settings).length;
  const unfiledDecks = decksInFolder(decks, null);
  const folderList = sortedFolders(folders);

  // 並び替えモード: 入場時に order をスナップショットし、終了時に差分だけクラウド同期
  const snapshotRef = useRef(null);
  useEffect(() => {
    if (!reorderMode) return;
    snapshotRef.current = {
      deckOrders: new Map(decksRef.current.map((d) => [d.id, d.order])),
      folderOrders: new Map(foldersRef.current.map((f) => [f.id, f.order])),
    };
    return () => {
      const snap = snapshotRef.current;
      snapshotRef.current = null;
      if (!snap) return;
      // decksRef / foldersRef はデータ参照用 ref（DOM ではない）。
      // クリーンアップ時点の最新 order と入場時のスナップショットを比較する。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const latestDecks = decksRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const latestFolders = foldersRef.current;
      const changedDeckIds = latestDecks
        .filter((d) => snap.deckOrders.get(d.id) !== d.order)
        .map((d) => d.id);
      const folderOrderChanged = latestFolders.some(
        (f) => snap.folderOrders.get(f.id) !== f.order
      );
      cloud.reorderCommitted(changedDeckIds, folderOrderChanged);
    };
  }, [reorderMode, decksRef, foldersRef, cloud]);

  const applyDeckOrder = (newOrder) => {
    setDecks((prev) => {
      const orderMap = new Map(newOrder.map((d, i) => [d.id, i]));
      return prev.map((d) => (orderMap.has(d.id) ? { ...d, order: orderMap.get(d.id) } : d));
    });
  };

  const renderDeckItem = (deck) => {
    const row = (
      <DeckRow
        deck={deck}
        stats={stats}
        disabled={reorderMode}
        onOpen={() => navigate("detail", { deckId: deck.id })}
        onPlay={() => startStudy(deck.words, { label: deck.name, deckId: deck.id })}
      />
    );
    if (!reorderMode) return <div key={deck.id}>{row}</div>;
    return (
      <Reorder.Item
        key={deck.id}
        value={deck}
        drag="y"
        style={{ listStyle: "none" }}
        whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 5 }}
      >
        {row}
      </Reorder.Item>
    );
  };

  const renderFolder = (folder) => {
    const folderDecks = decksInFolder(decks, folder.id);
    const folderWords = folderDecks.reduce((sum, d) => sum + d.words.length, 0);
    const isCollapsed = !!collapsedFolders[folder.id];

    const folderRow = (
      <div className="deck-card deck-card--folder">
        <button
          className="deck-card__info deck-card__info--folder"
          onClick={() => setCollapsedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }))}
        >
          <span className={`folder-caret${isCollapsed ? " folder-caret--collapsed" : ""}`}>
            <IconChevronDown size={14} />
          </span>
          <span className="deck-card__folder-icon"><IconFolder size={17} /></span>
          <span className="deck-card__text">
            <span className="deck-card__name">{folder.name}</span>
            <span className="deck-card__meta">{folderDecks.length}冊 · {folderWords}語</span>
          </span>
        </button>
        <MemoryBar stats={stats} words={folderDecks.flatMap((d) => d.words)} />
        <button
          className="icon-btn"
          onClick={() => navigate("folder", { folderId: folder.id })}
          disabled={reorderMode}
          aria-label={`${folder.name}を開く`}
        >
          <IconChevronLeft size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>
    );

    const children = (
      <AnimatePresence initial={false}>
        {!isCollapsed && folderDecks.length > 0 && (
          <Motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="folder-children">
              {reorderMode ? (
                <Reorder.Group
                  axis="y"
                  values={folderDecks}
                  onReorder={applyDeckOrder}
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {folderDecks.map(renderDeckItem)}
                </Reorder.Group>
              ) : (
                folderDecks.map(renderDeckItem)
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    );

    if (!reorderMode) {
      return (
        <div key={folder.id}>
          {folderRow}
          {children}
        </div>
      );
    }
    return (
      <Reorder.Item
        key={folder.id}
        value={folder}
        drag="y"
        style={{ listStyle: "none" }}
        whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 5 }}
      >
        {folderRow}
        {children}
      </Reorder.Item>
    );
  };

  return (
    <div className="page">
      <header className="home-header safe-top">
        <div className="brand">
          <div className="brand__logo"><IconCards size={22} /></div>
          <div>
            <h1 className="brand__title">Rapid Cycle</h1>
            <p className="brand__sub">高速周回フラッシュカード</p>
          </div>
        </div>
        <button
          className="icon-btn icon-btn--lg"
          onClick={() => navigate("settings")}
          disabled={reorderMode}
          aria-label="設定"
        >
          <IconGear size={19} />
        </button>
      </header>

      {/* 学習エントリーポイント */}
      {(totalWords > 0 || dueCount > 0) && (
        <div className="entry-row">
          {totalWords > 0 && (
            <button
              className="entry-card"
              onClick={() => navigate("crossSetup", { folderId: null })}
              disabled={reorderMode}
            >
              <span className="entry-card__icon entry-card__icon--shuffle"><IconShuffle size={17} /></span>
              <span className="entry-card__text">
                <span className="entry-card__title">横断学習</span>
                <span className="entry-card__sub">全{totalWords}語から出題</span>
              </span>
            </button>
          )}
          {dueCount > 0 && (
            <button
              className="entry-card entry-card--due"
              onClick={() => navigate("review")}
              disabled={reorderMode}
            >
              <span className="entry-card__icon entry-card__icon--repeat"><IconRepeat size={16} /></span>
              <span className="entry-card__text">
                <span className="entry-card__title">今日の復習</span>
                <span className="entry-card__sub">{dueCount}語が復習対象</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className="scroll-wrapper">
        <div className="scroll-area">
          {decks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><IconBook size={36} /></div>
              <p className="empty-state__text">単語帳がまだありません</p>
              <p className="empty-state__hint">データを取り込んで最初の単語帳を作りましょう</p>
              <button
                className="btn btn--ghost"
                style={{ marginTop: 16 }}
                onClick={() => {
                  const deck = actions.createDeck("TOEIC頻出サンプル", SAMPLE_WORDS);
                  navigate("detail", { deckId: deck.id });
                }}
              >
                サンプルで試す
              </button>
            </div>
          ) : (
            <div className="deck-list">
              {reorderMode ? (
                <Reorder.Group
                  axis="y"
                  values={folderList}
                  onReorder={(newOrder) => setFolders(newOrder.map((f, i) => ({ ...f, order: i })))}
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {folderList.map(renderFolder)}
                </Reorder.Group>
              ) : (
                folderList.map(renderFolder)
              )}

              {unfiledDecks.length > 0 && folderList.length > 0 && <div style={{ height: 8 }} />}
              {reorderMode ? (
                <Reorder.Group
                  axis="y"
                  values={unfiledDecks}
                  onReorder={applyDeckOrder}
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {unfiledDecks.map(renderDeckItem)}
                </Reorder.Group>
              ) : (
                unfiledDecks.map(renderDeckItem)
              )}
            </div>
          )}
        </div>
        <div className="scroll-fade" />
      </div>

      {/* FAB / 並び替え完了 */}
      <div className="fab-container">
        {reorderMode ? (
          <button className="btn btn--primary btn--pill" onClick={() => setReorderMode(false)}>
            完了
          </button>
        ) : (
          <>
            {showAddMenu && (
              <>
                <div className="fab-backdrop" onClick={() => setShowAddMenu(false)} />
                <div className="fab-menu">
                  <button className="fab-menu__item" onClick={() => { setShowAddMenu(false); navigate("import"); }}>
                    <IconBook size={17} /> 単語帳を追加
                  </button>
                  <button className="fab-menu__item" onClick={() => { setShowAddMenu(false); setShowNewFolder(true); }}>
                    <IconFolder size={17} /> フォルダを作成
                  </button>
                  {decks.length + folders.length > 1 && (
                    <button className="fab-menu__item" onClick={() => { setShowAddMenu(false); setReorderMode(true); }}>
                      <IconSort size={17} /> 並び替え
                    </button>
                  )}
                </div>
              </>
            )}
            <button
              className={`fab${showAddMenu ? " fab--open" : ""}`}
              onClick={() => setShowAddMenu((v) => !v)}
              aria-label="追加メニュー"
            >
              <IconPlus size={22} />
            </button>
          </>
        )}
      </div>

      {/* フォルダ作成モーダル */}
      {showNewFolder && (
        <Modal onClose={() => { setShowNewFolder(false); setNewFolderName(""); }}>
          <p className="modal-title">新しいフォルダ</p>
          <input
            className="input"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="フォルダ名"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                actions.createFolder(newFolderName.trim());
                setNewFolderName("");
                setShowNewFolder(false);
              }
            }}
          />
          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn btn--soft" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
              キャンセル
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                if (!newFolderName.trim()) return;
                actions.createFolder(newFolderName.trim());
                setNewFolderName("");
                setShowNewFolder(false);
              }}
            >
              作成
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export { DeckRow };
