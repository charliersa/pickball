/* 共用 SVG 圖示 */
function Icon({ name, ...p }) {
  const paths = {
    undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
    history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    trophy: <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />,
    flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
    ball: <><circle cx="12" cy="12" r="9" /><circle cx="9" cy="9" r="1.2" /><circle cx="15" cy="10" r="1.2" /><circle cx="11" cy="15" r="1.2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      {paths[name]}
    </svg>
  );
}
window.Icon = Icon;
