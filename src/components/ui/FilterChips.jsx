// 水平チップ列（出題数・記憶度フィルタなどの選択 UI）

export function FilterChips({ options, value, onChange, ariaLabel }) {
  return (
    <div className="chip-row" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const key = String(opt.value);
        const active = value === opt.value;
        return (
          <button
            key={key}
            className={`chip${active ? " chip--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.badge != null && opt.badge !== 0 && (
              <span className="chip__badge">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 記憶度フィルタの共通定義（"all" | 0..3） */
export function memoryFilterOptions(counts) {
  return [
    { value: "all", label: "全て" },
    { value: "0", label: "未学習", badge: counts?.[0] },
    { value: "1", label: "要復習", badge: counts?.[1] },
    { value: "2", label: "あと少し", badge: counts?.[2] },
    { value: "3", label: "定着", badge: counts?.[3] },
  ];
}

export function countOptions(values) {
  return [
    { value: null, label: "全て" },
    ...values.map((v) => ({ value: v, label: `${v}語` })),
  ];
}
