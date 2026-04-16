import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGES, THEME } from "../theme";
import { Icon } from "./Icon";
import { getPaperboardGeometry, gsmFromBoardGrade } from "../packform/paperboard";

const BOARD_OPTIONS = [
  { id: "SBB 300gsm", ect: 4.8, cal: 0.35, note: "Premium white" },
  { id: "SBB 350gsm", ect: 5.6, cal: 0.4, note: "Cosmetics, pharma, food" },
  { id: "SBB 400gsm", ect: 6.4, cal: 0.46, note: "Heavy duty" },
  { id: "GD2 300gsm", ect: 4.2, cal: 0.42, note: "Lower cost" },
  { id: "GD2 350gsm", ect: 5.0, cal: 0.48, note: "Household, industrial" },
  { id: "FBB 300gsm", ect: 4.6, cal: 0.38, note: "Good printability" },
];

const STYLE_GRID = [
  { style: "straight-tuck", code: "ECMA-C12", name: "Straight Tuck End" },
  { style: "reverse-tuck", code: "ECMA-C14", name: "Reverse Tuck End" },
  { style: "auto-bottom", code: "ECMA-A50", name: "Tuck Top Auto Bottom" },
  { style: "sleeve", code: "ECMA-B40", name: "Sleeve" },
];

function anthropicHeaders() {
  const key = localStorage.getItem("hookepak_anthropic_key") || localStorage.getItem("hookepak_api_key") || "";
  return {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function boardMeta(id) {
  return BOARD_OPTIONS.find((b) => b.id === id) || BOARD_OPTIONS[1];
}

function mcKeeBctKn(ect, Lmm, Wmm, tmm) {
  const Zcm = (2 * (Lmm + Wmm)) / 10;
  const tcm = tmm / 10;
  const v = 5.87 * ect * Math.sqrt(Math.max(0.001, Zcm * tcm));
  return Math.max(0.5, Math.min(20, v / 850));
}

function PackToolBody({ designState, updateDesign, setToast }) {
  const primary = designState?.primary;
  const transit = designState?.transitCarton;
  const [manual, setManual] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [alternatives, setAlternatives] = useState([]);

  const mergeTransit = useCallback(
    (patch) => updateDesign("transitCarton", (prev) => (prev ? { ...prev, ...patch } : prev)),
    [updateDesign]
  );

  if (!primary || !transit) {
    return <div style={{ color: THEME.textTertiary, fontSize: 12 }}>Complete the Primary Pack stage first.</div>;
  }

  const wall = 5;
  const n = Math.max(1, Number(transit.targetQty) || 1);
  const fillStats = {
    grid: n,
    brick: Math.max(1, n - 2),
    interlocked: Math.max(1, n - 4),
  };

  const applyAlternative = (alt) => {
    const cols = Math.max(1, Number(alt.cols) || 2);
    const rows = Math.max(1, Number(alt.rows) || 2);
    const layers = Math.max(1, Number(alt.layers) || 1);
    mergeTransit({
      cols,
      rows,
      layers,
      L: cols * primary.L + 2 * wall,
      W: rows * primary.W + 2 * wall,
      H: layers * primary.H + 2 * wall,
      targetQty: cols * rows * layers,
      arrangementLabel: `${cols}×${rows}×${layers}`,
      style: alt.style || transit.style,
      board: alt.board || transit.board,
      revealCount: 0,
    });
    setToast?.(`Applied layout: ${cols}×${rows}×${layers}`);
    setTimeout(() => setToast?.(""), 3000);
  };

  const onAiSuggest = async () => {
    const keyApi = localStorage.getItem("hookepak_anthropic_key") || localStorage.getItem("hookepak_api_key");
    if (!keyApi) {
      setToast?.("Add an Anthropic API key (gear) to use AI suggestions.");
      setTimeout(() => setToast?.(""), 4000);
      return;
    }
    setAiLoading(true);
    setAlternatives([]);
    try {
      const prompt = `Given a primary folding carton ${primary.L}×${primary.W}×${primary.H} mm (paperboard) and a target of ${transit.targetQty || n} primary units per transit carton, suggest exactly 3 corrugated transit carton configurations for UK distribution.

For each option return JSON with: label, L, W, H (mm, outer), fefcoStyle, boardGrade, cols, rows, layers (integers), arrangement (string like "2×3×1"), cartonsPerPallet (integer, UK 1200×1000 pallet).

Return ONLY valid JSON: { "options": [ {...}, {...}, {...} ] }`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(raw);
      const data = JSON.parse(raw);
      const text = data.content?.find((c) => c.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAlternatives(parsed.options || []);
      setToast?.("AI alternatives ready — tap a card to apply.");
      setTimeout(() => setToast?.(""), 3500);
    } catch {
      setToast?.("AI suggestion failed — check API key or try again.");
      setTimeout(() => setToast?.(""), 4000);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: THEME.surface3, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, padding: 12 }}>
        <div style={{ fontSize: 10, fontFamily: THEME.fontMono, color: THEME.accent, marginBottom: 8 }}>TRANSIT CARTON (AUTO-SIZED)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textPrimary }}>
          <div>
            <div style={{ fontSize: 8, color: THEME.textTertiary }}>L</div>
            {Math.round(transit.L)} mm
          </div>
          <div>
            <div style={{ fontSize: 8, color: THEME.textTertiary }}>W</div>
            {Math.round(transit.W)} mm
          </div>
          <div>
            <div style={{ fontSize: 8, color: THEME.textTertiary }}>H</div>
            {Math.round(transit.H)} mm
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 9, color: THEME.textTertiary, display: "flex", alignItems: "center", gap: 6 }}>
            Style
            <select
              value={transit.style || "0201"}
              onChange={(e) => mergeTransit({ style: e.target.value })}
              style={{ background: THEME.surface2, color: THEME.textPrimary, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.sm, padding: "4px 8px", fontFamily: THEME.fontMono, fontSize: 10 }}
            >
              <option value="0201">RSC 0201</option>
              <option value="0203">0203 — full overlap</option>
            </select>
          </label>
          <label style={{ fontSize: 9, color: THEME.textTertiary, display: "flex", alignItems: "center", gap: 6 }}>
            Board
            <select
              value={transit.board || "B-flute"}
              onChange={(e) => mergeTransit({ board: e.target.value })}
              style={{ background: THEME.surface2, color: THEME.textPrimary, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.sm, padding: "4px 8px", fontFamily: THEME.fontMono, fontSize: 10 }}
            >
              <option value="E-flute">E-flute</option>
              <option value="B-flute">B-flute</option>
              <option value="C-flute">C-flute</option>
              <option value="BC double wall">BC double wall</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: THEME.textSecondary, fontFamily: THEME.fontMono }}>
          Quantity: <strong>{transit.targetQty}</strong> units · Arrangement: <strong>{transit.arrangementLabel || "—"}</strong>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setManual((v) => !v)} style={{ fontSize: 10, padding: "6px 10px", borderRadius: THEME.radius.md, border: `1px solid ${THEME.surface4}`, background: THEME.surface2, color: THEME.textSecondary, fontFamily: THEME.fontMono }}>
            Re-size manually
          </button>
          <button type="button" disabled={aiLoading} onClick={onAiSuggest} style={{ fontSize: 10, padding: "6px 10px", borderRadius: THEME.radius.md, border: `1px solid ${THEME.accentBorder}`, background: THEME.accentMuted, color: THEME.accent, fontFamily: THEME.fontMono }}>
            {aiLoading ? "…" : "Let AI suggest alternatives"}
          </button>
        </div>
        {manual && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {[
              ["cols", transit.cols, 1, 8],
              ["rows", transit.rows, 1, 8],
              ["layers", transit.layers, 1, 6],
            ].map(([k, val, min, max]) => (
              <label key={k} style={{ fontSize: 9, color: THEME.textTertiary }}>
                {k}
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={val}
                  onChange={(e) => {
                    const lo = Number(min);
                    const hi = Number(max);
                    const v = Math.max(lo, Math.min(hi, Number(e.target.value) || 1));
                    updateDesign("transitCarton", (prev) => {
                      if (!prev) return prev;
                      const next = { ...prev, [k]: v };
                      const c = Math.max(1, Number(next.cols) || 1);
                      const r = Math.max(1, Number(next.rows) || 1);
                      const lz = Math.max(1, Number(next.layers) || 1);
                      return {
                        ...next,
                        cols: c,
                        rows: r,
                        layers: lz,
                        L: c * primary.L + 2 * wall,
                        W: r * primary.W + 2 * wall,
                        H: lz * primary.H + 2 * wall,
                        targetQty: c * r * lz,
                        arrangementLabel: `${c}×${r}×${lz}`,
                        revealCount: 0,
                      };
                    });
                  }}
                  style={{ width: "100%", marginTop: 4, padding: 6, borderRadius: THEME.radius.sm, border: `1px solid ${THEME.surface4}`, background: THEME.surface2, color: THEME.textPrimary, fontFamily: THEME.fontMono }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, marginBottom: 8 }}>FILL PATTERN (UNITS / CARTON)</div>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { id: "grid", label: "Grid", count: fillStats.grid },
            { id: "brick", label: "Brick", count: fillStats.brick },
            { id: "interlocked", label: "Interlocked", count: fillStats.interlocked },
          ].map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => mergeTransit({ fillPattern: row.id })}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: THEME.radius.md,
                border: `1px solid ${transit.fillPattern === row.id ? THEME.accentBorder : THEME.surface4}`,
                background: transit.fillPattern === row.id ? THEME.accentMuted : THEME.surface3,
                color: THEME.textPrimary,
                cursor: "pointer",
                fontFamily: THEME.fontMono,
                fontSize: 11,
              }}
            >
              {row.label} — <span style={{ color: THEME.accent }}>{row.count}</span> units
            </button>
          ))}
        </div>
      </div>

      {alternatives.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, marginBottom: 8 }}>AI OPTIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alternatives.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyAlternative(alt)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.surface4}`,
                  background: THEME.surface3,
                  color: THEME.textSecondary,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontFamily: THEME.fontMono, color: THEME.accent }}>{alt.label || `Option ${i + 1}`}</div>
                <div style={{ marginTop: 4, fontFamily: THEME.fontMono, fontSize: 10 }}>
                  {alt.L}×{alt.W}×{alt.H} mm · {alt.fefcoStyle || alt.boardGrade || ""} · {alt.cartonsPerPallet ? `${alt.cartonsPerPallet} ctn/plt` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StageBody({ activeStage, designState, updateDesign, setToast }) {
  if (activeStage === "primary") {
    return <PrimaryToolBody designState={designState} updateDesign={updateDesign} />;
  }
  if (activeStage === "pack") {
    return <PackToolBody designState={designState} updateDesign={updateDesign} setToast={setToast} />;
  }
  if (activeStage === "pallet") {
    return <div style={{ color: THEME.textSecondary, fontSize: 12 }}>Pallet controls placeholder</div>;
  }
  return <div style={{ color: THEME.textTertiary, fontSize: 12 }}>Coming in next build</div>;
}

function DimSlider({ label, value, min, max, step, color, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: THEME.fontMono, fontWeight: 700, fontSize: 12, color, width: 14 }}>{label}</span>
        <span style={{ fontFamily: THEME.fontMono, fontWeight: 700, fontSize: 18, color }}>{value}</span>
        <span style={{ fontSize: 10, color: THEME.textTertiary }}>mm</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          height: 6,
          borderRadius: 3,
          appearance: "none",
          background: `linear-gradient(to right, ${color} ${pct}%, ${THEME.surface4} ${pct}%)`,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function FeatureIcon({ type }) {
  const s = 36;
  if (type === "hang-hole") {
    return (
      <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="6" y="8" width="24" height="22" fill="none" stroke={THEME.textSecondary} strokeWidth="1.2" />
        <path d="M12 10 h12 a3 3 0 0 1 0 6 h-12 a3 3 0 0 1 0-6z" fill="none" stroke={THEME.accent} strokeWidth="1" />
      </svg>
    );
  }
  if (type === "thumb-cut") {
    return (
      <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="8" y="10" width="20" height="18" fill="none" stroke={THEME.textSecondary} strokeWidth="1.2" />
        <path d="M18 28 Q10 22 18 16 Q26 22 18 28" fill="none" stroke={THEME.accent} />
      </svg>
    );
  }
  if (type === "perforation") {
    return (
      <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="8" y="12" width="20" height="14" fill="none" stroke={THEME.textSecondary} strokeWidth="1" />
        <line x1="8" y1="18" x2="28" y2="18" stroke={THEME.accent} strokeWidth="1.5" strokeDasharray="2 3" />
      </svg>
    );
  }
  if (type === "window") {
    return (
      <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="6" y="8" width="24" height="22" fill="none" stroke={THEME.textSecondary} strokeWidth="1.2" />
        <rect x="12" y="14" width="12" height="10" fill="#fff" stroke="#3366FF" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "lock-tab") {
    return (
      <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="8" y="12" width="20" height="14" fill="none" stroke={THEME.textSecondary} strokeWidth="1.2" />
        <path d="M14 12 L18 6 L22 12 Z" fill="none" stroke={THEME.accent} strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 36 36">
      <rect x="8" y="10" width="20" height="18" fill="none" stroke={THEME.textSecondary} strokeWidth="1.2" />
      {[10, 16, 22, 28].map((cx) => (
        <circle key={cx} cx={cx} cy="18" r="1.8" fill={THEME.accent} />
      ))}
    </svg>
  );
}

const FEATURE_DEFS = [
  { type: "hang-hole", label: "EURO HANG HOLE" },
  { type: "thumb-cut", label: "THUMB CUT" },
  { type: "perforation", label: "TEAR PERF." },
  { type: "window", label: "WINDOW CUT" },
  { type: "lock-tab", label: "LOCK TAB" },
  { type: "vent", label: "VENT HOLES" },
];

function PrimaryToolBody({ designState, updateDesign }) {
  const carton = designState?.primary;
  const [tab, setTab] = useState("design");
  const [featModal, setFeatModal] = useState(null);
  const [panelPick, setPanelPick] = useState("");
  const [xPct, setXPct] = useState(50);
  const [yMm, setYMm] = useState(12);
  const [slotW, setSlotW] = useState(32);
  const [slotH, setSlotH] = useState(7);
  const [recess, setRecess] = useState(10);
  const [thumbR, setThumbR] = useState(20);
  const [winW, setWinW] = useState(80);
  const [winH, setWinH] = useState(50);

  const merge = useCallback((patch) => updateDesign("primary", { ...designState.primary, ...patch }), [designState?.primary, updateDesign]);

  const geo = useMemo(() => {
    if (!carton) return null;
    return getPaperboardGeometry(carton.style || "straight-tuck", Number(carton.L) || 100, Number(carton.W) || 80, Number(carton.H) || 100, Number(carton.boardCalliper) || 0.4);
  }, [carton?.style, carton?.L, carton?.W, carton?.H, carton?.boardCalliper]);

  if (!carton) {
    return <div style={{ color: THEME.textTertiary, fontSize: 12 }}>Select a packaging option to edit the primary pack.</div>;
  }

  const bm = boardMeta(carton.boardGrade || "SBB 350gsm");
  const gsm = gsmFromBoardGrade(carton.boardGrade);
  const areaCm2 = geo ? (geo.blankW * geo.blankH) / 100 : 0;
  const estWt = (areaCm2 * gsm) / 10000;

  const openFeat = (type) => {
    setFeatModal(type);
    setPanelPick("");
    setXPct(50);
    setYMm(12);
  };

  const placeFeature = () => {
    if (!featModal || !panelPick) return;
    const id = `f-${Date.now()}`;
    const base = { id, type: featModal, panelId: panelPick, xPct, yMm };
    let extra = {};
    if (featModal === "hang-hole") extra = { slotW, slotH, recess };
    if (featModal === "thumb-cut") extra = { radius: thumbR };
    if (featModal === "window") extra = { winW, winH };
    merge({ placedFeatures: [...(carton.placedFeatures || []), { ...base, ...extra }] });
    setFeatModal(null);
  };

  const removeFeature = (id) => {
    merge({ placedFeatures: (carton.placedFeatures || []).filter((f) => f.id !== id) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {["design", "features", "analysis"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: THEME.radius.md,
              border: `1px solid ${tab === t ? THEME.accentBorder : THEME.surface4}`,
              background: tab === t ? THEME.accentMuted : THEME.surface3,
              color: tab === t ? THEME.accent : THEME.textSecondary,
              fontSize: 10,
              fontFamily: THEME.fontMono,
              textTransform: "uppercase",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "design" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, letterSpacing: "0.08em" }}>ECMA STYLE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {STYLE_GRID.map((s) => {
              const active = carton.style === s.style;
              return (
                <button
                  key={s.style}
                  type="button"
                  onClick={() => merge({ style: s.style, ecmaCode: s.code, ecmaName: s.name })}
                  style={{
                    height: 52,
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: THEME.radius.md,
                    border: `1px solid ${active ? THEME.accentBorder : THEME.surface4}`,
                    borderLeft: active ? `3px solid ${THEME.accent}` : `1px solid ${THEME.surface4}`,
                    background: active ? THEME.accentMuted : THEME.surface3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: THEME.fontMono, fontWeight: 700, color: active ? THEME.accent : THEME.textSecondary }}>{s.code}</span>
                  <span style={{ fontSize: 9, color: active ? THEME.textSecondary : THEME.textTertiary }}>{s.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ opacity: 0.4, fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>Gable top · Pillow · Five-panel · Display tray</div>

          <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, letterSpacing: "0.08em", marginTop: 8 }}>DIMENSIONS</div>
          <DimSlider label="L" value={carton.L} min={50} max={500} step={5} color={THEME.accent} onChange={(v) => merge({ L: v })} />
          <DimSlider label="W" value={carton.W} min={30} max={400} step={5} color="#3D9970" onChange={(v) => merge({ W: v })} />
          <DimSlider label="H" value={carton.H} min={30} max={500} step={5} color="#5B8DEF" onChange={(v) => merge({ H: v })} />

          <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, letterSpacing: "0.08em", marginTop: 8 }}>BOARD</div>
          {BOARD_OPTIONS.map((b) => {
            const active = (carton.boardGrade || "SBB 350gsm") === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => merge({ boardGrade: b.id, board: b.id, boardCalliper: b.cal, boardThickness: b.cal })}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  marginBottom: 6,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.surface4}`,
                  borderLeft: active ? `3px solid ${THEME.accent}` : `1px solid ${THEME.surface4}`,
                  background: active ? THEME.accentMuted : THEME.surface3,
                  color: THEME.textPrimary,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 11, fontFamily: THEME.fontMono }}>{b.id}</div>
                {active && (
                  <div style={{ fontSize: 9, color: THEME.textTertiary, marginTop: 4 }}>
                    {b.cal}mm · {b.note}
                  </div>
                )}
              </button>
            );
          })}

          <div style={{ background: THEME.surface3, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, padding: 10, marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Blank W", geo ? `${Math.round(geo.blankW)} mm` : "—"],
                ["Blank H", geo ? `${Math.round(geo.blankH)} mm` : "—"],
                ["Area", `${areaCm2.toFixed(1)} cm²`],
                ["Est. weight", `${estWt.toFixed(2)} g`],
              ].map(([a, b]) => (
                <div key={a}>
                  <div style={{ fontSize: 8, fontFamily: THEME.fontMono, color: THEME.textTertiary }}>{a}</div>
                  <div style={{ fontSize: 13, fontFamily: THEME.fontMono, color: THEME.textPrimary }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "features" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {FEATURE_DEFS.map((f) => (
              <button
                key={f.type}
                type="button"
                onClick={() => openFeat(f.type)}
                style={{
                  width: "100%",
                  height: 80,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.surface4}`,
                  background: THEME.surface3,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = THEME.accentBorder;
                  e.currentTarget.style.background = THEME.surface2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = THEME.surface4;
                  e.currentTarget.style.background = THEME.surface3;
                }}
              >
                <div>
                  <FeatureIcon type={f.type === "vent" ? "vent" : f.type} />
                  <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, marginTop: 4 }}>{f.label}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, fontFamily: THEME.fontMono, color: THEME.textTertiary, marginTop: 14 }}>PLACED FEATURES</div>
          {(carton.placedFeatures || []).length === 0 ? (
            <div style={{ color: THEME.textTertiary, fontSize: 11, marginTop: 6 }}>No features added yet</div>
          ) : (
            (carton.placedFeatures || []).map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, marginTop: 6, color: THEME.textSecondary }}>
                <span>
                  {f.type} — {f.panelId}
                </span>
                <button type="button" onClick={() => removeFeature(f.id)} style={{ color: THEME.danger, background: "none", border: "none", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "analysis" && <AnalysisPanel carton={carton} merge={merge} areaCm2={areaCm2} estWt={estWt} bm={bm} gsm={gsm} />}

      {featModal && geo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(13,12,11,0.85)", display: "grid", placeItems: "center", pointerEvents: "auto" }} onClick={() => setFeatModal(null)}>
          <div style={{ width: 400, maxWidth: "94vw", background: THEME.surface2, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.xl, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>{featModal}</span>
              <button type="button" onClick={() => setFeatModal(null)} style={{ background: "none", border: "none", color: THEME.textSecondary, cursor: "pointer" }}>
                ×
              </button>
            </div>
            <div style={{ fontSize: 11, color: THEME.textSecondary, marginBottom: 8 }}>Place on which panel?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {geo.panels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPanelPick(p.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: THEME.radius.full,
                    border: `1px solid ${panelPick === p.id ? THEME.accentBorder : THEME.surface4}`,
                    background: panelPick === p.id ? THEME.accentMuted : THEME.surface3,
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {panelPick && (
              <>
                <label style={{ fontSize: 10, color: THEME.textTertiary }}>Distance from left edge (%)</label>
                <input type="range" min={5} max={95} value={xPct} onChange={(e) => setXPct(Number(e.target.value))} style={{ width: "100%", marginBottom: 8 }} />
                <label style={{ fontSize: 10, color: THEME.textTertiary }}>Distance from top (mm)</label>
                <input type="range" min={2} max={80} value={yMm} onChange={(e) => setYMm(Number(e.target.value))} style={{ width: "100%", marginBottom: 8 }} />
                {featModal === "hang-hole" && (
                  <div style={{ fontSize: 10, display: "grid", gap: 6, marginBottom: 8 }}>
                    <span>Slot W {slotW} mm</span>
                    <input type="range" min={20} max={40} value={slotW} onChange={(e) => setSlotW(Number(e.target.value))} />
                    <span>Slot H {slotH} mm</span>
                    <input type="range" min={5} max={12} value={slotH} onChange={(e) => setSlotH(Number(e.target.value))} />
                    <span>Recess {recess} mm</span>
                    <input type="range" min={6} max={18} value={recess} onChange={(e) => setRecess(Number(e.target.value))} />
                  </div>
                )}
                {featModal === "thumb-cut" && (
                  <div style={{ fontSize: 10, marginBottom: 8 }}>
                    Radius {thumbR} mm
                    <input type="range" min={8} max={30} value={thumbR} onChange={(e) => setThumbR(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                )}
                {featModal === "window" && (
                  <div style={{ fontSize: 10, display: "grid", gap: 6, marginBottom: 8 }}>
                    <span>Width {winW} mm</span>
                    <input type="range" min={30} max={120} value={winW} onChange={(e) => setWinW(Number(e.target.value))} />
                    <span>Height {winH} mm</span>
                    <input type="range" min={20} max={80} value={winH} onChange={(e) => setWinH(Number(e.target.value))} />
                  </div>
                )}
              </>
            )}
            <button type="button" disabled={!panelPick} onClick={placeFeature} style={{ width: "100%", marginTop: 12, padding: "10px 0", border: "none", borderRadius: THEME.radius.md, background: THEME.accent, color: THEME.textOnAccent, fontWeight: 600, cursor: panelPick ? "pointer" : "not-allowed", opacity: panelPick ? 1 : 0.5 }}>
              Place feature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ carton, merge, areaCm2, estWt, bm, gsm }) {
  const [units, setUnits] = useState(carton.palletColumnUnits || 12);
  const [boardCost, setBoardCost] = useState(2.8);
  const [convertCost, setConvertCost] = useState(0.04);
  const [printCost, setPrintCost] = useState(0.08);
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const insightSig = useRef("");

  const productWeightKg = Number(carton.productWeightKg) || 0.2;
  const L = Number(carton.L);
  const W = Number(carton.W);
  const H = Number(carton.H);
  const ect = bm.ect;
  const tmm = bm.cal;
  const bctEst = carton.bctEstimate != null ? Number(carton.bctEstimate) : mcKeeBctKn(ect, L, W, tmm);
  const requiredBct = (units * productWeightKg * 9.81 * 1.6) / 1000;
  const ratio = requiredBct > 0.01 ? bctEst / requiredBct : 99;
  const passColor = ratio >= 1.6 ? THEME.success : ratio >= 1.2 ? THEME.accent : THEME.danger;
  const passLabel = ratio >= 1.6 ? "PASS" : ratio >= 1.2 ? "MARGINAL" : "FAIL";

  const boardCostUnit = (areaCm2 / 10000) * boardCost;
  const totalUnit = boardCostUnit + convertCost + printCost;
  const qty = 1000;

  const sig = `${L}|${W}|${H}|${carton.boardGrade}|${units}|${boardCost}|${convertCost}|${printCost}`;

  useEffect(() => {
    const prev = insightSig.current;
    if (prev) {
      const parts = prev.split("|");
      const pL = Number(parts[0]);
      const pW = Number(parts[1]);
      const pH = Number(parts[2]);
      const pG = parts[3];
      const drift = Math.abs(pL - L) / Math.max(L, 1) + Math.abs(pW - W) / Math.max(W, 1) + Math.abs(pH - H) / Math.max(H, 1);
      if (drift < 0.05 && pG === carton.boardGrade) return;
    }
    insightSig.current = sig;

    const keyApi = localStorage.getItem("hookepak_anthropic_key") || localStorage.getItem("hookepak_api_key");
    if (!keyApi) {
      setInsight("Add an Anthropic API key (gear icon) for AI engineering insights.");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const prompt = `Packaging analysis:
Style: ${carton.ecmaCode} (${carton.ecmaName})
Board: ${carton.boardGrade}, ${tmm}mm
Dims: L=${L} W=${W} H=${H}mm
BCT est: ${bctEst.toFixed(2)} kN, required ~${requiredBct.toFixed(2)} kN, ratio ${ratio.toFixed(2)}
Cost/unit £${totalUnit.toFixed(3)}, blank ${areaCm2.toFixed(1)} cm²
Give 2-3 sentences of actionable engineering insight.`;
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(),
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 220,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await res.json();
        const text = data.content?.find((c) => c.type === "text")?.text || "Unable to fetch insight.";
        if (!cancelled) setInsight(text.trim());
      } catch {
        if (!cancelled) setInsight("Insight unavailable (network).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sig, L, W, H, carton.boardGrade, carton.ecmaCode, carton.ecmaName, bctEst, requiredBct, ratio, areaCm2, totalUnit, tmm, units, boardCost, convertCost, printCost]);

  const co2 = (estWt / 1000) * 0.002 * 1000;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: THEME.fontMono, color: THEME.textSecondary }}>BCT PREDICTION</div>
      <div style={{ fontSize: 10, color: THEME.textTertiary, marginBottom: 4 }} title="McKee-type estimate from ECT, perimeter Z and caliper t.">
        McKee-type model · ECT {ect} N/cm
      </div>
      <label style={{ fontSize: 10, color: THEME.textTertiary }}>Units per pallet column</label>
      <input type="number" min={1} max={200} value={units} onChange={(e) => { const v = Number(e.target.value); setUnits(v); merge({ palletColumnUnits: v }); }} style={{ width: "100%", padding: 6, borderRadius: THEME.radius.sm, border: `1px solid ${THEME.surface4}`, background: THEME.surface3, color: THEME.textPrimary }} />
      <div style={{ fontFamily: THEME.fontMono, fontSize: 12 }}>
        BCT estimate: <strong>{bctEst.toFixed(2)} kN</strong>
        <br />
        Required BCT: <strong>{requiredBct.toFixed(2)} kN</strong>
        <br />
        <span style={{ color: passColor }}>
          Safety: {ratio.toFixed(2)}× — {passLabel}
        </span>
      </div>
      <div style={{ height: 8, background: THEME.surface4, borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (requiredBct / Math.max(bctEst, requiredBct, 0.01)) * 100)}%`, background: THEME.success, opacity: 0.5 }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (bctEst / Math.max(bctEst, requiredBct, 0.01)) * 100)}%`, background: ratio >= 1.2 ? THEME.accent : THEME.danger, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 10, color: passColor }}>
        {ratio < 1.2 && "Upgrade board or reduce stack height."}
        {ratio >= 1.2 && ratio < 1.6 && "Consider upgrading to the next GSM grade."}
        {ratio >= 1.6 && "Adequate — you could trim GSM for cost if over-specified."}
      </div>

      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: THEME.fontMono, color: THEME.textSecondary, marginTop: 8 }}>MATERIAL</div>
      <div style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textPrimary }}>
        Area {areaCm2.toFixed(1)} cm² · Board ~{estWt.toFixed(2)} g
        <br />
        CO₂e ~{co2.toFixed(3)} kg{" "}
        <span title="Typical virgin board LCA proxy.">ⓘ</span>
      </div>
      {String(carton.boardGrade || "").startsWith("GD2") ? (
        <div style={{ color: THEME.success, fontSize: 10 }}>♻ Recycled content available</div>
      ) : (
        <button type="button" onClick={() => merge({ boardGrade: "GD2 350gsm", board: "GD2 350gsm", boardCalliper: 0.48, boardThickness: 0.48 })} style={{ fontSize: 10, color: THEME.textSecondary, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          ○ Virgin board — consider GD2 alternative
        </button>
      )}

      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: THEME.fontMono, color: THEME.textSecondary, marginTop: 8 }}>COST ESTIMATE</div>
      {[
        ["Board £/m²", boardCost, setBoardCost],
        ["Convert £/u", convertCost, setConvertCost],
        ["Print £/u", printCost, setPrintCost],
      ].map(([lab, val, set]) => (
        <label key={lab} style={{ fontSize: 10, display: "block", color: THEME.textTertiary }}>
          {lab}
          <input type="number" step={0.01} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%", marginTop: 4, padding: 4, borderRadius: THEME.radius.sm, border: `1px solid ${THEME.surface4}`, background: THEME.surface3, color: THEME.textPrimary }} />
        </label>
      ))}
      <div style={{ fontFamily: THEME.fontMono, fontSize: 11, borderTop: `1px solid ${THEME.surface4}`, paddingTop: 8 }}>
        Board £{boardCostUnit.toFixed(3)} · Conv £{convertCost.toFixed(3)} · Print £{printCost.toFixed(3)}
        <br />
        <strong>Total £{totalUnit.toFixed(3)} / unit</strong>
        <br />
        <span style={{ color: THEME.textTertiary }}>At {qty} units: £{(totalUnit * qty).toFixed(0)}</span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: THEME.fontMono, color: THEME.textSecondary, marginTop: 8 }}>AI INSIGHT</div>
      <div style={{ display: "flex", gap: 8, padding: 10, borderRadius: THEME.radius.md, background: THEME.surface3, border: `1px solid ${THEME.surface4}` }}>
        <Icon name="ai-spark" size={16} color={THEME.ai} />
        <div style={{ fontSize: 11, color: THEME.textSecondary, lineHeight: 1.5, flex: 1 }}>{loading ? "…" : insight}</div>
      </div>
    </div>
  );
}

export function ToolPanel({ activeStage, advanceStage, setActiveStage, stageStatus, designState, updateDesign, setToast = () => {} }) {
  const stage = STAGES.find((s) => s.id === activeStage);
  const idx = STAGES.findIndex((s) => s.id === activeStage);
  const prevStage = idx > 0 ? STAGES[idx - 1].id : null;
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1].id : null;

  return (
    <div style={{ width: 280, height: "100%", background: THEME.surface2, borderRight: `1px solid ${THEME.surface4}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ color: THEME.textSecondary, fontSize: 10, fontFamily: THEME.fontMono, letterSpacing: "0.1em", textTransform: "uppercase" }}>{stage?.label}</div>
        <div style={{ color: THEME.textTertiary, fontSize: 11, marginTop: 4 }}>{stage?.description}</div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 12px" }}>
        <StageBody activeStage={activeStage} designState={designState} updateDesign={updateDesign} setToast={setToast} />
      </div>
      <div style={{ borderTop: `1px solid ${THEME.surface4}`, padding: 12, display: "flex", gap: 8 }}>
        <button type="button" disabled={!prevStage} onClick={() => prevStage && setActiveStage(prevStage)} style={{ flex: 1, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, padding: "8px 12px", color: THEME.textSecondary, opacity: prevStage ? 1 : 0.4 }}>
          Back
        </button>
        <button
          type="button"
          disabled={!nextStage || stageStatus[activeStage] === "pending"}
          onClick={() => advanceStage(activeStage)}
          style={{ flex: 1, borderRadius: THEME.radius.md, padding: "8px 12px", background: THEME.accent, color: THEME.textOnAccent, fontSize: 12, fontWeight: 600, opacity: nextStage ? 1 : 0.4 }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
