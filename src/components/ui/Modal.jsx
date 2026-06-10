// 汎用モーダル。iOS WebView では confirm() が使えないため全確認をこれで行う（v1 と同方針）

export function Modal({ onClose, children, maxWidth = 340, center = false, bare = false }) {
  const className = bare
    ? "modal-bare"
    : `modal-card${center ? " modal-card--center" : ""}`;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={className} style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, desc, confirmLabel = "削除する", cancelLabel = "キャンセル", onConfirm, onCancel, danger = true }) {
  return (
    <Modal onClose={onCancel}>
      <p className="modal-title">{title}</p>
      <p className="modal-desc">{desc}</p>
      <div className="modal-actions">
        <button className="btn btn--soft" onClick={onCancel}>{cancelLabel}</button>
        <button className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
