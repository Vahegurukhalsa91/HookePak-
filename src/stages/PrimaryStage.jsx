import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME } from "../theme";
import { Dieline2D } from "../components/Dieline2D";
import { genDXFPaperboard } from "../packform/paperboardDXF";
import { getPaperboardGeometry, gsmFromBoardGrade } from "../packform/paperboard";

export function PrimaryStage({ status = "pending", designState, updateDesign, setToast }) {
  const primary = designState?.primary;
  const dielineRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [subTab, setSubTab] = useState("3D");
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const primaryRef = useRef(primary);

  useEffect(() => {
    primaryRef.current = primary;
  }, [primary]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const geo = useMemo(() => {
    if (!primary) return null;
    return getPaperboardGeometry(primary.style || "straight-tuck", Number(primary.L) || 100, Number(primary.W) || 80, Number(primary.H) || 100, Number(primary.boardCalliper) || 0.4);
  }, [primary?.style, primary?.L, primary?.W, primary?.H, primary?.boardCalliper]);

  const viewMode = primary?.viewMode || "full3d";

  const setViewMode = useCallback(
    (id) => {
      if (!primary || !updateDesign) return;
      updateDesign("primary", { ...primary, viewMode: id });
    },
    [primary, updateDesign]
  );

  const patchPrimary = useCallback(
    (patch) => {
      if (!primary || !updateDesign) return;
      updateDesign("primary", { ...primary, ...patch });
    },
    [primary, updateDesign]
  );

  const foldRafRef = useRef(0);
  useEffect(() => {
    if (!playing || !updateDesign) {
      cancelAnimationFrame(foldRafRef.current);
      return;
    }
    const tick = () => {
      if (!playingRef.current) return;
      const p = primaryRef.current;
      if (!p) return;
      const next = Math.min(1, Number(p.foldProgress ?? 0) + 0.01);
      if (next >= 1) setPlaying(false);
      updateDesign("primary", { ...p, foldProgress: next });
      foldRafRef.current = requestAnimationFrame(tick);
    };
    foldRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(foldRafRef.current);
  }, [playing, updateDesign]);

  const handleExportDXF = () => {
    if (!primary) return;
    setExporting(true);
    try {
      const dxf = genDXFPaperboard(primary.style || "straight-tuck", Number(primary.L), Number(primary.W), Number(primary.H), Number(primary.boardCalliper) || 0.4);
      const name = `HookePak_${primary.ecmaCode || "primary"}_${primary.L}x${primary.W}x${primary.H}mm.dxf`;
      const blob = new Blob([dxf], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setToast?.(`DXF downloaded: ${name}`);
      setTimeout(() => setToast?.(""), 3500);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSVG = () => {
    if (!dielineRef.current) return;
    const ser = new XMLSerializer().serializeToString(dielineRef.current);
    const blob = new Blob([`<?xml version="1.0"?>\n${ser}`], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HookePak_dieline.svg";
    a.click();
    URL.revokeObjectURL(url);
    setToast?.("SVG downloaded");
    setTimeout(() => setToast?.(""), 2500);
  };

  const handlePlayPause = () => {
    if (!primary) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (Number(primary.foldProgress ?? 0) >= 0.99) {
      patchPrimary({ foldProgress: 0 });
    }
    setPlaying(true);
  };

  const jumpFold = (val) => {
    setPlaying(false);
    patchPrimary({ foldProgress: val });
  };

  const foldT = Number(primary?.foldProgress ?? 0);
  const L = Number(primary?.L ?? 0);
  const W = Number(primary?.W ?? 0);
  const H = Number(primary?.H ?? 0);
  const selectedPanel = primary?.selectedDielinePanel ?? null;
  const placedFeatures = primary?.placedFeatures || [];

  if (!primary) {
    return (
      <div
        style={{
          pointerEvents: "auto",
          margin: 16,
          display: "inline-flex",
          padding: "8px 14px",
          border: `1px solid ${THEME.surface4}`,
          borderRadius: THEME.radius.md,
          background: "rgba(30,28,25,0.8)",
          backdropFilter: "blur(8px)",
          fontFamily: THEME.fontMono,
          fontSize: 11,
        }}
      >
        Primary Pack | {status}
      </div>
    );
  }

  const gsm = gsmFromBoardGrade(primary.boardGrade);
  const areaCm2 = geo ? (geo.blankW * geo.blankH) / 100 : 0;
  const estWt = (areaCm2 * gsm) / 10000;

  const showFullDieline = subTab === "Flat / DXF" || (subTab === "3D" && viewMode === "dieline");
  const showSplitDieline = subTab === "3D" && viewMode === "split";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "8px 12px",
          background: "rgba(13,12,11,0.75)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${THEME.surface4}`,
          flexShrink: 0,
        }}
      >
        {["3D", "Flat / DXF", "Artwork"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            style={{
              pointerEvents: "auto",
              background: subTab === tab ? THEME.accentMuted : "transparent",
              border: subTab === tab ? `1px solid ${THEME.accentBorder}` : "1px solid transparent",
              color: subTab === tab ? THEME.accent : THEME.textTertiary,
              padding: "5px 14px",
              borderRadius: THEME.radius.md,
              fontSize: 11,
              fontFamily: THEME.fontMono,
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            {tab}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            gap: 2,
            background: THEME.surface3,
            border: `1px solid ${THEME.surface4}`,
            borderRadius: THEME.radius.md,
            padding: 2,
          }}
        >
          {[
            { id: "full3d", label: "⬛ 3D" },
            { id: "dieline", label: "⬜ DXF" },
            { id: "split", label: "▪▪ Split" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              style={{
                pointerEvents: "auto",
                background: viewMode === id ? THEME.surface4 : "transparent",
                border: "none",
                color: viewMode === id ? THEME.textPrimary : THEME.textTertiary,
                padding: "4px 10px",
                borderRadius: THEME.radius.sm,
                fontSize: 10,
                fontFamily: THEME.fontMono,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden", pointerEvents: "none" }}>
        {showSplitDieline && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <div style={{ flex: "0 0 60%", pointerEvents: "none" }} />
            <div
              style={{
                flex: "0 0 40%",
                pointerEvents: "auto",
                background: "rgba(13,12,11,0.96)",
                backdropFilter: "blur(20px)",
                borderLeft: `1px solid ${THEME.surface4}`,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: `1px solid ${THEME.surface4}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>DIELINE</span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  disabled={exporting}
                  onClick={handleExportDXF}
                  style={{
                    pointerEvents: "auto",
                    background: "transparent",
                    border: `1px solid ${THEME.accentBorder}`,
                    color: THEME.accent,
                    padding: "5px 12px",
                    borderRadius: THEME.radius.md,
                    fontSize: 10,
                    fontFamily: THEME.fontMono,
                    cursor: "pointer",
                  }}
                >
                  Export DXF
                </button>
              </div>
              <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
                <Dieline2D
                  ref={dielineRef}
                  style={primary.style || "straight-tuck"}
                  L={L}
                  W={W}
                  H={H}
                  boardThickness={primary.boardCalliper || primary.boardThickness || 0.4}
                  selectedPanel={selectedPanel}
                  onPanelClick={(id) => patchPrimary({ selectedDielinePanel: id })}
                  placedFeatures={placedFeatures}
                />
              </div>
            </div>
          </div>
        )}

        {showFullDieline && (
          <div
            style={{
              pointerEvents: "auto",
              position: "absolute",
              inset: 0,
              background: "rgba(13,12,11,0.96)",
              backdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                borderBottom: `1px solid ${THEME.surface4}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width={20} height={4}>
                    <line x1={0} y1={2} x2={20} y2={2} stroke="#FF3333" strokeWidth={1.5} />
                  </svg>
                  <span style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>Cut</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width={20} height={4}>
                    <line x1={0} y1={2} x2={20} y2={2} stroke="#3366FF" strokeWidth={1.2} strokeDasharray="4 3" />
                  </svg>
                  <span style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>Crease</span>
                </div>
              </div>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                disabled={exporting}
                onClick={handleExportDXF}
                style={{
                  pointerEvents: "auto",
                  background: "transparent",
                  border: `1px solid ${THEME.accentBorder}`,
                  color: THEME.accent,
                  padding: "5px 12px",
                  borderRadius: THEME.radius.md,
                  fontSize: 10,
                  fontFamily: THEME.fontMono,
                  cursor: "pointer",
                }}
              >
                Export DXF
              </button>
              <button
                type="button"
                onClick={handleExportSVG}
                style={{
                  pointerEvents: "auto",
                  background: "transparent",
                  border: `1px solid ${THEME.surface4}`,
                  color: THEME.textSecondary,
                  padding: "5px 12px",
                  borderRadius: THEME.radius.md,
                  fontSize: 10,
                  fontFamily: THEME.fontMono,
                  cursor: "pointer",
                }}
              >
                Export SVG
              </button>
            </div>

            <div style={{ flex: 1, padding: 24, minHeight: 0 }}>
              <Dieline2D
                ref={dielineRef}
                style={primary.style || "straight-tuck"}
                L={L}
                W={W}
                H={H}
                boardThickness={primary.boardCalliper || primary.boardThickness || 0.4}
                selectedPanel={selectedPanel}
                onPanelClick={(id) => patchPrimary({ selectedDielinePanel: id })}
                placedFeatures={placedFeatures}
              />
            </div>
          </div>
        )}

        {subTab === "Artwork" && (
          <div
            style={{
              pointerEvents: "auto",
              position: "absolute",
              inset: 0,
              background: "rgba(13,12,11,0.92)",
              backdropFilter: "blur(16px)",
              display: "grid",
              placeItems: "center",
              color: THEME.textSecondary,
              fontFamily: THEME.fontMono,
              fontSize: 12,
            }}
          >
            Artwork preview — coming soon
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 64,
            left: 12,
            display: "flex",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          {[
            { label: "L", value: L, color: THEME.accent },
            { label: "W", value: W, color: "#3D9970" },
            { label: "H", value: H, color: "#5B8DEF" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(22,20,18,0.88)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${THEME.surface4}`,
                borderRadius: THEME.radius.md,
                padding: "6px 10px",
                textAlign: "center",
                minWidth: 52,
              }}
            >
              <div style={{ fontSize: 8, color: THEME.textTertiary, fontFamily: THEME.fontMono, letterSpacing: "0.1em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: THEME.fontMono, lineHeight: 1.1 }}>{Math.round(value)}</div>
              <div style={{ fontSize: 7, color: THEME.textTertiary, fontFamily: THEME.fontMono }}>mm</div>
            </div>
          ))}
        </div>

        {geo && subTab === "3D" && !showFullDieline && (
          <div
            style={{
              position: "absolute",
              bottom: 120,
              left: 12,
              right: 12,
              maxWidth: 360,
              pointerEvents: "none",
              padding: "8px 10px",
              borderRadius: THEME.radius.md,
              background: "rgba(22,20,18,0.88)",
              border: `1px solid ${THEME.surface4}`,
              fontFamily: THEME.fontMono,
              fontSize: 9,
              color: THEME.textTertiary,
            }}
          >
            Blank {Math.round(geo.blankW)} × {Math.round(geo.blankH)} mm · {areaCm2.toFixed(1)} cm² · ~{estWt.toFixed(2)} g
          </div>
        )}
      </div>

      {subTab === "3D" && (
        <div
          style={{
            pointerEvents: "auto",
            padding: "10px 16px",
            background: "rgba(13,12,11,0.82)",
            backdropFilter: "blur(12px)",
            borderTop: `1px solid ${THEME.surface4}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handlePlayPause}
            style={{
              width: 32,
              height: 32,
              borderRadius: THEME.radius.md,
              background: THEME.accent,
              border: "none",
              color: THEME.textOnAccent,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {playing ? "⏸" : "▶"}
          </button>

          <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
            <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: THEME.surface4, borderRadius: 2 }} />
            <div style={{ position: "absolute", left: 0, width: `${foldT * 100}%`, height: 3, background: THEME.accent, borderRadius: 2 }} />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(foldT * 100)}
              onChange={(e) => {
                const t = Number(e.target.value) / 100;
                setPlaying(false);
                patchPrimary({ foldProgress: t });
              }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                width: "100%",
                WebkitAppearance: "none",
                appearance: "none",
                background: "transparent",
                cursor: "pointer",
                height: 20,
                margin: 0,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {[
              ["Flat", 0],
              ["½", 0.5],
              ["Up", 1],
            ].map(([label, val]) => (
              <button
                key={label}
                type="button"
                onClick={() => jumpFold(val)}
                style={{
                  padding: "4px 9px",
                  borderRadius: THEME.radius.sm,
                  border: `1px solid ${Math.abs(foldT - val) < 0.04 ? THEME.accentBorder : THEME.surface4}`,
                  background: Math.abs(foldT - val) < 0.04 ? THEME.accentMuted : "transparent",
                  color: Math.abs(foldT - val) < 0.04 ? THEME.accent : THEME.textTertiary,
                  fontSize: 9,
                  fontFamily: THEME.fontMono,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 9, color: THEME.textTertiary, fontFamily: THEME.fontMono, flexShrink: 0, marginLeft: 8 }}>
            {L}×{W}×{H}mm
          </div>
        </div>
      )}
    </div>
  );
}
