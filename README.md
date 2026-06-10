# Rapid Cycle v2

TOEIC 等の英単語を**短時間で何周も回して短期記憶に叩き込む**高速周回型フラッシュカードアプリ。
v1 のロジック・機能をそのまま引き継ぎ、UI/UX とコード品質を根本から再設計したバージョン。

```bash
npm install
npm run dev      # 開発サーバー
npm test         # ロジック・互換性テスト（vitest）
npm run build    # 本番ビルド
```

## v1 との互換性（保証事項）

| 項目 | 互換性 |
| --- | --- |
| CSV エクスポート/インポート | **完全互換**。`src/lib/csv.js` は v1 と同一実装。v1 の出力をそのまま取り込め、逆も成立（`csvCompat.test.js` でゴールデン文字列固定） |
| GAS クラウド同期 | **完全互換**。`action` 名（updateDeck / updateMeta / deleteDeck / listDecks / getDeckSummaries / getMeta / getDeck / getSummary）と `data` 構造（`{ v: 2, deck, stats }` / `{ v: 2, updatedAt, folders }`）は v1 と同一。同じ GAS エンドポイント（v1 の `gas/Code.gs`）をそのまま使える（`gasClient.test.js` で固定） |
| localStorage | キー（`rc_decks` / `rc_stats` / `rc_settings` / `rc_folders` / `rc_pending` / `rc_migrated_v1`）・データ構造とも v1 と同一。同一オリジンに配備すれば v1 のデータを自動で引き継ぐ |
| クリップボード全データバックアップ | v1 と同一の JSON 構造（`{ decks, stats, folders, settings, v: 1 }`）。相互に復元可能 |
| 学習アルゴリズム | 周回ロジック・記憶度スコア・SRS 復習間隔とも v1 と同一（`memory.test.js` / `review.test.js` で検証） |

## v1 からの主な改善

### UI/UX
- **CSS 変数ベースのテーマシステム**（ダーク/ライト）。ファーストペイント前にテーマ適用しフラッシュを防止
- **Pointer Events 対応** — タッチに加えてマウスでもスワイプ操作可能（デスクトップでの確認が容易に）
- 単語リストの**検索ボックス**（単語・意味の部分一致）
- 単語編集をインライン展開からモーダルへ変更（モバイルで誤操作しにくい）
- 記憶度フィルタチップに件数バッジを表示
- トースト通知（CSV コピー等の操作フィードバック）
- ナビゲーションのスタック化 — フォルダ → 詳細 → 戻る でフォルダに戻る（v1 は常にホーム）
- アイコンを絵文字から SVG セットへ統一

### コード品質
- 5,157 行の単一ファイルを **責務別モジュールに分割**（下記構成）
- 互換性が壊れやすい箇所（CSV・GAS ペイロード・記憶度・復習間隔）に **47 件の自動テスト**
- 「最新 state を ref で読む」パターンを `useLatest` に統一し、フォルダ作成直後の同期が 1 つ前の状態を送る v1 の stale closure 問題を解消
- デッキ詳細を ID 参照に変更（v1 の activeDeck 二重状態を排除）

## プロジェクト構成

```
src/
├── lib/            # 純粋ロジック（React 非依存・テスト対象）
│   ├── csv.js          # CSV 入出力（v1 と同一実装）
│   ├── gasClient.js    # GAS API クライアント（v1 互換ペイロード）
│   ├── memory.js       # 記憶度スコア・レベル・再登場倍率
│   ├── review.js       # SRS 復習期限ロジック
│   ├── storage.js      # localStorage ラッパー
│   └── utils.js        # shuffle / genId / 相対日付 / ハイライト
├── state/          # アプリ状態
│   ├── useAppState.js  # 永続 state（decks/stats/folders/settings/pending）
│   ├── useAppActions.js# 操作（ローカル更新 + クラウド同期トリガーの対）
│   ├── migrations.js   # v1 データのマイグレーション
│   └── AppContext.jsx
├── hooks/
│   ├── useCloudSync.js   # 同期エンジン（デバウンス/ペンディング/復元）
│   ├── useStudyEngine.js # 周回セッション（ラウンド遷移・記録・巻き戻し）
│   ├── useCardSwipe.js   # スワイプジェスチャ（Pointer Events）
│   ├── useNavigation.js  # ルートスタック + エッジスワイプバック
│   └── useLatest.js
├── components/
│   ├── ui/         # Modal / Toast / FilterChips / MemoryBar / CardFace / WordList / Icons
│   └── views/      # Home / Folder / DeckDetail / StudySetup / Import / Study / Result / Settings
└── styles/
    ├── tokens.css  # デザイントークン（テーマ別 CSS 変数）
    └── app.css     # コンポーネントスタイル
```

## Vercel へのデプロイ（PWA）

`vercel.json` を同梱済み。**Root Directory を `rapid-cycle-v2` に設定**すれば、フレームワーク・ビルド設定は自動認識される。

### 方法 A: GitHub 連携（推奨）

1. リポジトリを push（このアプリは `eitango/rapid-cycle-v2/` 配下にある）
2. Vercel で New Project → リポジトリを Import
3. **Root Directory** に `rapid-cycle-v2` を指定（v1 と同居しているため必須）
4. Framework Preset: `Vite`（自動検出）/ Build: `npm run build` / Output: `dist`
5. Deploy。以降は push で自動デプロイ

### 方法 B: Vercel CLI

```bash
cd rapid-cycle-v2
npx vercel          # 初回（プレビューデプロイ）
npx vercel --prod   # 本番デプロイ
```

### PWA としてインストール

デプロイ後の HTTPS URL を開き、

- **iPhone (Safari)**: 共有 → 「ホーム画面に追加」
- **Android (Chrome)**: メニュー → 「アプリをインストール」
- **デスクトップ (Chrome/Edge)**: アドレスバーのインストールアイコン

`vercel.json` が担保していること:

- **SPA フォールバック** — 全パスを `/` に rewrite（静的ファイルはファイルシステム優先で配信）
- **Service Worker の即時更新** — `sw.js` を `no-cache` で配信し、デプロイ直後に新バージョンへ切り替え（`skipWaiting` + `clients.claim`）
- **manifest の正しい配信** — `application/manifest+json`
- **ハッシュ付きアセットの長期キャッシュ** — `/assets/*` を `immutable` で 1 年キャッシュ

> オフライン対応は network-first（`public/sw.js`）。一度オンラインで開けば、以降はオフラインでも起動・学習できる。クラウド同期(GAS)はオンライン時のみ動作し、オフライン中の変更はペンディングキューに積まれて復帰時に送信される。

## GAS エンドポイントの設定

v1 の `gas/Code.gs` をそのまま利用する。デプロイ手順は v1 の `gas/DEPLOY.md` を参照。
設定画面で Web アプリ URL を入力すると、学習セッション終了時の自動バックアップ・起動時の自動復元（ローカルが空の場合）・手動バックアップ/復元が有効になる。
