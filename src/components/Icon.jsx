export function Icon({ name, size = 24, color = "currentColor", strokeWidth = 1.5 }) {
  const paths = {
    product: "M12 3L3 8v8l9 5 9-5V8L12 3z M12 3v13 M3 8l9 5 M21 8l-9 5",
    package: "M4 10v9a1 1 0 001 1h14a1 1 0 001-1v-9 M2 7h20v3H2V7z M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2 M7 7l-2-3 M17 7l2-3",
    carton: "M3 9l9-5 9 5v10l-9 5-9-5V9z M12 4v16 M3 9h18 M7.5 6.5l-4.5 7 M16.5 6.5l4.5 7",
    pallet: "M2 14h20v2H2v-2z M5 16v3 M12 16v3 M19 16v3 M5 8h5v6H5V8z M9.5 8h5v6h-5V8z M14 8h5v6h-5V8z",
    pouch: "M8 3h8l2 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V7l2-4z M6 7h12 M10 3v4 M14 3v4 M9 13c0 1.66 1.34 3 3 3s3-1.34 3-3",
    bottle: "M9 3h6v3l2 3v11a1 1 0 01-1 1H8a1 1 0 01-1-1V9l2-3V3z M9 3v3h6V3 M8 13h8",
    tube: "M6 4h12v16H6V4z M6 8h12 M6 16h12 M9 4v4 M15 4v4",
    report: "M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-4-5z M14 3v5h5 M9 13h2 M9 16h4 M9 10h1",
    plus: "M12 5v14 M5 12h14",
    minus: "M5 12h14",
    close: "M6 6l12 12 M18 6L6 18",
    "chevron-right": "M9 6l6 6-6 6",
    "chevron-left": "M15 6l-6 6 6 6",
    "chevron-up": "M6 15l6-6 6 6",
    "chevron-down": "M6 9l6 6 6-6",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    "ai-spark": "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 12m-2 0a2 2 0 104 0 2 2 0 00-4 0 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1",
    import: "M12 3v12 M7 10l5 5 5-5 M5 19h14",
    undo: "M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 010 11H11",
    redo: "M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 000 11H13",
    send: "M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z",
    grid: "M3 3h7v7H3V3z M14 3h7v7h-7V3z M3 14h7v7H3v-7z M14 14h7v7h-7v-7z",
    layers: "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
    check: "M5 12l5 5L20 7",
    lock: "M7 11V7a5 5 0 0110 0v4 M5 11h14v10H5V11z",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0",
    "eye-off": "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94 M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19 M1 1l22 22",
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(paths[name] || "").split(" M").filter(Boolean).map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

