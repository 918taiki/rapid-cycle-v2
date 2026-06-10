// 設定画面: テーマ / 周回ロジック / 復習間隔 / GAS クラウド同期 / ローカルバックアップ

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { DEFAULT_SETTINGS } from "../../state/useAppState.js";
import { useToast } from "../ui/Toast.jsx";
import { Modal, ConfirmDialog } from "../ui/Modal.jsx";
import { IconChevronLeft, IconCloudUp, IconCloudDown, IconCheck, IconCopy, IconClipboard } from "../ui/Icons.jsx";

function SettingSlider({ name, valueLabel, desc, min, max, step, value, onChange, marks }) {
  return (
    <div className="setting-item">
      <div className="setting-item__header">
        <span className="setting-item__name">{name}</span>
        <span className="setting-item__value">{valueLabel}</span>
      </div>
      {desc && <p className="setting-item__desc">{desc}</p>}
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />
      <div className="slider-marks">
        {marks.map((m) => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

export function SettingsView() {
  const { decks, stats, folders, settings, setSettings, actions, cloud, goBack } = useApp();
  const showToast = useToast();
  const [confirmStatsReset, setConfirmStatsReset] = useState(false);

  const theme = settings.theme || "dark";
  const scale = settings.reviewIntervalScale ?? 1.0;
  const scaleLabel = scale < 0.85 ? "短め" : scale > 1.15 ? "長め" : "標準";

  const backupBusy = cloud.backupPhase !== null;
  const restoreBusy = cloud.restorePhase !== null;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(actions.buildLocalBackup(stats, settings));
      showToast("全データをコピーしました", "success");
    } catch {
      showToast("コピーに失敗しました", "danger");
    }
  };

  const handlePasteRestore = async () => {
    try {
      const text = await navigator.clipboard.readText();
      actions.restoreLocalBackup(text);
      showToast("復元しました", "success");
    } catch {
      showToast("データの読み取りに失敗しました", "danger");
    }
  };

  return (
    <div className="page">
      <header className="sub-header safe-top">
        <button className="back-btn" onClick={goBack} aria-label="戻る">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="sub-header__title">設定</h2>
      </header>

      <div className="scroll-wrapper">
        <div className="scroll-area">
          {/* テーマ */}
          <section className="settings-section">
            <p className="section-label">テーマ</p>
            <div className="theme-row">
              <button
                className={`theme-btn${theme === "dark" ? " theme-btn--active" : ""}`}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "dark" }))}
              >
                🌙 ダーク
              </button>
              <button
                className={`theme-btn${theme === "light" ? " theme-btn--active" : ""}`}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "light" }))}
              >
                ☀️ ライト
              </button>
            </div>
          </section>

          {/* 周回ロジック */}
          <section className="settings-section">
            <p className="section-label">周回ロジック</p>
            <SettingSlider
              name="R1 正答の再登場率"
              valueLabel={`${Math.round(settings.reappearR1 * 100)}%`}
              desc="R1→R2 で、R1で正答した単語が再登場する確率"
              min={0} max={100} step={5}
              value={Math.round(settings.reappearR1 * 100)}
              onChange={(v) => setSettings((prev) => ({ ...prev, reappearR1: v / 100 }))}
              marks={["0%", "50%", "100%"]}
            />
            <SettingSlider
              name="R2以降 正答の再登場率"
              valueLabel={`${Math.round(settings.reappearR2 * 100)}%`}
              desc="R2→R3以降で、前ラウンド正答の単語が再登場する確率"
              min={0} max={100} step={5}
              value={Math.round(settings.reappearR2 * 100)}
              onChange={(v) => setSettings((prev) => ({ ...prev, reappearR2: v / 100 }))}
              marks={["0%", "50%", "100%"]}
            />
            <div className="setting-item">
              <div className="setting-item__header">
                <span className="setting-item__name">記憶度による再登場率調整</span>
                <button
                  className={`toggle${settings.memoryReappear ? " toggle--on" : ""}`}
                  onClick={() => setSettings((prev) => ({ ...prev, memoryReappear: !prev.memoryReappear }))}
                  role="switch"
                  aria-checked={settings.memoryReappear}
                >
                  <span className="toggle__knob" />
                </button>
              </div>
              <p className="setting-item__desc">
                ONの場合、記憶度に応じて再登場率を自動調整します。
                {"\n"}定着: ×0.3 / あと少し: ×0.7 / 要復習: ×1.3
              </p>
            </div>
            <SettingSlider
              name="復習間隔"
              valueLabel={`${scaleLabel}（${scale.toFixed(1)}×）`}
              desc="復習対象として再登場するまでの間隔を倍率で調整します。"
              min={5} max={20} step={1}
              value={Math.round(scale * 10)}
              onChange={(v) => setSettings((prev) => ({ ...prev, reviewIntervalScale: v / 10 }))}
              marks={["短め", "標準", "長め"]}
            />
          </section>

          {/* クラウドバックアップ */}
          <section className="settings-section">
            <p className="section-label">クラウドバックアップ (GAS)</p>
            <div className="setting-item">
              <p className="setting-item__desc">
                Google Apps Script の Web アプリ URL を設定すると、学習セッション終了時に自動でバックアップされます。
              </p>
              <input
                className="input input--sm"
                type="url"
                value={settings.gasUrl || ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, gasUrl: e.target.value.trim() }))}
                placeholder="https://script.google.com/macros/s/.../exec"
              />
              <div className="setting-btn-row">
                <button
                  className="btn btn--ghost"
                  disabled={!settings.gasUrl || backupBusy}
                  onClick={() => cloud.runCloudBackup()}
                >
                  <IconCloudUp size={16} />
                  {cloud.backupPhase === "checking" && "クラウド確認中..."}
                  {cloud.backupPhase === "confirming" && "確認待ち..."}
                  {cloud.backupPhase === "syncing" && "バックアップ中..."}
                  {cloud.backupPhase === "done" && "✓ 完了"}
                  {cloud.backupPhase === "error" && "エラー"}
                  {cloud.backupPhase === null && "今すぐバックアップ"}
                </button>
                <button
                  className="btn btn--ghost"
                  disabled={!settings.gasUrl || restoreBusy || backupBusy}
                  onClick={() => cloud.runCloudRestore()}
                >
                  <IconCloudDown size={16} />
                  {cloud.restorePhase === "checking" && "確認中..."}
                  {cloud.restorePhase === "fetching" && "取得中..."}
                  {cloud.restorePhase === "applying" && "適用中..."}
                  {cloud.restorePhase === "done" && "✓ 復元完了"}
                  {cloud.restorePhase === "error" && "エラー"}
                  {(cloud.restorePhase === null || cloud.restorePhase === "confirming") && "復元する"}
                </button>
              </div>
              {cloud.backupPhase === "error" && (
                <p className="error-text">通信に失敗しました。URL を確認してください。</p>
              )}
            </div>
          </section>

          {/* ローカルバックアップ */}
          <section className="settings-section">
            <p className="section-label">データのバックアップ</p>
            <div className="setting-item">
              <p className="setting-item__desc">
                全データ（単語帳・学習記録・フォルダ・設定）をコピーして保存できます。復元時は貼り付けてください。
              </p>
              <div className="setting-btn-row">
                <button className="btn btn--ghost" onClick={handleCopyAll}>
                  <IconCopy size={15} /> 全データをコピー
                </button>
                <button className="btn btn--ghost" onClick={handlePasteRestore}>
                  <IconClipboard size={15} /> 貼り付けて復元
                </button>
              </div>
            </div>
          </section>

          {/* データ管理 */}
          <section className="settings-section">
            <p className="section-label">データ管理</p>
            <button className="btn btn--danger-ghost btn--block" onClick={() => setConfirmStatsReset(true)}>
              学習記録をリセット
            </button>
          </section>

          <div style={{ paddingTop: 12, paddingBottom: 24 }}>
            <button
              className="btn btn--ghost btn--block"
              onClick={() => setSettings((prev) => ({ ...DEFAULT_SETTINGS, gasUrl: prev.gasUrl }))}
            >
              デフォルトに戻す
            </button>
          </div>
        </div>
        <div className="scroll-fade" />
      </div>

      {/* 学習記録リセット確認 */}
      {confirmStatsReset && (
        <ConfirmDialog
          title="学習記録をリセット"
          desc="全ての学習記録をリセットしますか？単語帳は残ります。クラウドバックアップの学習記録も削除されます。"
          confirmLabel="リセットする"
          onCancel={() => setConfirmStatsReset(false)}
          onConfirm={() => {
            setConfirmStatsReset(false);
            actions.resetStats();
            showToast("学習記録をリセットしました");
          }}
        />
      )}

      {/* 孤立ファイル確認モーダル */}
      {cloud.backupPhase === "confirming" && (
        <Modal onClose={() => cloud.resolveOrphanChoice("cancel")} maxWidth={380}>
          <p className="modal-title">クラウドの孤立ファイルを処理</p>
          <p className="modal-desc">以下のデッキがクラウドに残っていますが、端末には存在しません。</p>
          <div className="orphan-list">
            {cloud.orphanSummaries.map((sm) => (
              <div key={sm.id} className="orphan-list__item">
                <span className="orphan-list__name">{sm.name}</span>
                <span className="orphan-list__count">{sm.wordCount}語</span>
              </div>
            ))}
          </div>
          <p className="modal-desc modal-desc--sm">
            削除しないと、次回復元したときにこれらのデッキが復活します。
          </p>
          <div className="modal-actions modal-actions--column">
            <button className="btn btn--danger" onClick={() => cloud.resolveOrphanChoice("delete")}>
              削除して完全同期
            </button>
            <button className="btn btn--soft" onClick={() => cloud.resolveOrphanChoice("keep")}>
              削除せずアップロードのみ
            </button>
            <button className="btn btn--ghost" onClick={() => cloud.resolveOrphanChoice("cancel")}>
              キャンセル
            </button>
          </div>
        </Modal>
      )}

      {/* 復元確認モーダル */}
      {cloud.restorePhase === "confirming" && cloud.restoreSummary && (
        <Modal onClose={() => cloud.resolveRestoreChoice("cancel")} maxWidth={380}>
          <p className="modal-title">クラウドから復元</p>
          <p className="modal-desc">
            クラウド上のデータで、この端末のデータを完全に上書きします。この操作は取り消せません。
          </p>
          <div className="restore-info">
            <p className="restore-info__label restore-info__label--accent">復元されるデータ</p>
            <div className="restore-info__body">
              <div>単語帳: {cloud.restoreSummary.deckCount}冊（{cloud.restoreSummary.totalWordCount.toLocaleString()}語）</div>
              <div>フォルダ: {cloud.restoreSummary.folderCount}つ</div>
            </div>
          </div>
          <div className="restore-info restore-info--danger">
            <p className="restore-info__label restore-info__label--danger">失われるローカルデータ</p>
            <div className="restore-info__body">
              <div>単語帳: {decks.length}冊（{decks.reduce((sum, d) => sum + d.words.length, 0).toLocaleString()}語）</div>
              <div>フォルダ: {folders.length}つ</div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn--soft" onClick={() => cloud.resolveRestoreChoice("cancel")}>
              キャンセル
            </button>
            <button className="btn btn--danger" onClick={() => cloud.resolveRestoreChoice("proceed")}>
              復元を実行
            </button>
          </div>
        </Modal>
      )}

      {/* 復元進捗モーダル */}
      {(cloud.restorePhase === "checking" || cloud.restorePhase === "fetching" || cloud.restorePhase === "applying") && (
        <Modal onClose={() => {}} maxWidth={320}>
          <p className="modal-title">復元中</p>
          <p className="modal-desc">
            {cloud.restorePhase === "checking" && "クラウドのデータを確認中..."}
            {cloud.restorePhase === "fetching" && cloud.restoreProgress.message}
            {cloud.restorePhase === "applying" && "適用中..."}
          </p>
          {cloud.restorePhase === "fetching" && cloud.restoreProgress.total > 0 && (
            <div className="progress-track progress-track--modal">
              <div
                className="progress-fill"
                style={{ width: `${(cloud.restoreProgress.current / cloud.restoreProgress.total) * 100}%` }}
              />
            </div>
          )}
          <div className="modal-actions modal-actions--center">
            <button className="btn btn--ghost btn--narrow" onClick={cloud.cancelCloudOperation}>
              キャンセル
            </button>
          </div>
        </Modal>
      )}

      {/* 復元完了モーダル */}
      {cloud.restorePhase === "done" && (
        <Modal onClose={() => {}} maxWidth={320} center>
          <div className="restore-done-icon"><IconCheck size={24} /></div>
          <p className="modal-title">復元が完了しました</p>
        </Modal>
      )}

      {/* 復元エラーモーダル */}
      {cloud.restorePhase === "error" && (
        <Modal onClose={cloud.cancelCloudOperation} maxWidth={320}>
          <p className="modal-title">復元に失敗しました</p>
          <p className="modal-desc">
            {cloud.restoreError || "通信エラーが発生しました。ネットワークを確認して再度お試しください。"}
          </p>
          <p className="modal-desc modal-desc--sm">ローカルのデータは変更されていません。</p>
          <div className="modal-actions modal-actions--center">
            <button className="btn btn--soft btn--narrow" onClick={cloud.cancelCloudOperation}>
              閉じる
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
