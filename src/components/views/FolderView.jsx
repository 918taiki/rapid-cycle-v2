// フォルダ画面: フォルダ内の単語帳一覧とフォルダ横断学習

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { decksInFolder } from "../../state/useAppState.js";
import { ConfirmDialog } from "../ui/Modal.jsx";
import { DeckRow } from "./HomeView.jsx";
import { IconChevronLeft, IconFolder, IconShuffle } from "../ui/Icons.jsx";

export function FolderView() {
  const { route, decks, folders, stats, actions, navigate, goBack, startStudy } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const folder = folders.find((f) => f.id === route.folderId);
  if (!folder) return null;

  const folderDecks = decksInFolder(decks, folder.id);
  const folderWords = folderDecks.reduce((sum, d) => sum + d.words.length, 0);

  return (
    <div className="page">
      <header className="sub-header safe-top">
        <button className="back-btn" onClick={goBack} aria-label="戻る">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="sub-header__title">
          <span className="sub-header__icon"><IconFolder size={17} /></span>
          {folder.name}
        </h2>
      </header>

      <div className="scroll-wrapper">
        <div className="scroll-area">
          {folderWords > 0 && (
            <button
              className="entry-card entry-card--full"
              onClick={() => navigate("crossSetup", { folderId: folder.id })}
            >
              <span className="entry-card__icon entry-card__icon--shuffle"><IconShuffle size={17} /></span>
              <span className="entry-card__text">
                <span className="entry-card__title">フォルダ横断学習</span>
                <span className="entry-card__sub">{folderWords}語から出題</span>
              </span>
            </button>
          )}

          {folderDecks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><IconFolder size={36} /></div>
              <p className="empty-state__text">単語帳がありません</p>
              <p className="empty-state__hint">単語帳の詳細ページからこのフォルダに移動できます</p>
            </div>
          ) : (
            <div className="deck-list">
              <p className="section-label">{folderDecks.length}冊の単語帳</p>
              {folderDecks.map((deck) => (
                <DeckRow
                  key={deck.id}
                  deck={deck}
                  stats={stats}
                  onOpen={() => navigate("detail", { deckId: deck.id })}
                  onPlay={() => startStudy(deck.words, { label: deck.name, deckId: deck.id })}
                />
              ))}
            </div>
          )}

          <div className="danger-zone">
            <button className="btn btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
              このフォルダを削除
            </button>
          </div>
        </div>
        <div className="scroll-fade" />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="フォルダを削除"
          desc={`「${folder.name}」を削除しますか？中の単語帳は削除されず、フォルダ外に移動されます。`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            actions.deleteFolder(folder.id);
            navigate("home");
          }}
        />
      )}
    </div>
  );
}
