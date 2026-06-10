// アプリ全体で使う SVG アイコンセット（stroke ベース、currentColor 継承）

function Svg({ size = 20, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconChevronLeft = (p) => (
  <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);

export const IconGear = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.07a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.07a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

export const IconPlay = (p) => (
  <Svg {...p}><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" /></Svg>
);

export const IconFolder = (p) => (
  <Svg {...p}><path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconShuffle = (p) => (
  <Svg {...p}>
    <path d="M16 3h5v5" /><path d="M4 20L21 3" />
    <path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" />
  </Svg>
);

export const IconRepeat = (p) => (
  <Svg {...p}>
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
  </Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></Svg>
);

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>
);

export const IconX = (p) => (
  <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>
);

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
  </Svg>
);

export const IconPencil = (p) => (
  <Svg {...p}><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5z" /></Svg>
);

export const IconFileUp = (p) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3-3 3 3" />
  </Svg>
);

export const IconCloudUp = (p) => (
  <Svg {...p}>
    <path d="M4 16.2A4.5 4.5 0 016.5 8h.3a6 6 0 0111.5 1.9 4 4 0 01-.8 7.9" />
    <path d="M12 12v8" /><path d="M8.5 15.5L12 12l3.5 3.5" />
  </Svg>
);

export const IconCloudDown = (p) => (
  <Svg {...p}>
    <path d="M4 16.2A4.5 4.5 0 016.5 8h.3a6 6 0 0111.5 1.9 4 4 0 01-.8 7.9" />
    <path d="M12 12v8" /><path d="M8.5 16.5L12 20l3.5-3.5" />
  </Svg>
);

export const IconGrip = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconUndo = (p) => (
  <Svg {...p}><path d="M3 7v6h6" /><path d="M3 13a9 9 0 109-9 9.2 9.2 0 00-6.7 3L3 9" /></Svg>
);

export const IconSort = (p) => (
  <Svg {...p}><path d="M8 7h13M8 12h9M8 17h5" /><path d="M4 5v14" /><path d="M2 17l2 2 2-2" /></Svg>
);

export const IconCards = (p) => (
  <Svg {...p}>
    <rect x="3" y="6" width="11" height="15" rx="2" />
    <path d="M8 3.5h11a2 2 0 012 2V18" />
  </Svg>
);

export const IconBook = (p) => (
  <Svg {...p}>
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </Svg>
);

export const IconClipboard = (p) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="18" rx="2" />
    <path d="M9 4a2 2 0 012-2h2a2 2 0 012 2" />
    <path d="M9 11h6M9 15h4" />
  </Svg>
);
