import { useState } from "react";
import { motion } from "framer-motion";
import { THEME } from "../theme";
import { Icon } from "../components/Icon";

const labels = { 1: "BEST FIT", 2: "ALTERNATIVE", 3: "PREMIUM" };
const badgeBg = (rank) => (rank === 1 ? THEME.accent : THEME.surface3);
const badgeFg = (rank) => (rank === 1 ? THEME.textOnAccent : THEME.textSecondary);
const bctColor = (v) => (v > 5 ? THEME.success : v > 3 ? THEME.accent : THEME.danger);

function metric(value, label, color) {
  return (
    <div style={{ flex: 1, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.sm, padding: 8, background: THEME.surface3 }}>
      <div style={{ fontSize: 12, color }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 9, color: THEME.textTertiary, fontFamily: THEME.fontMono }}>{label}</div>
    </div>
  );
}

export function OptionsScreen({ options = [], onSelect, onAdjust, onRegenerate }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {options.map((o, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, ...THEME.easeOut }} style={{ width: "calc(33% - 16px)", minWidth: 280, background: THEME.surface2, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.xl, padding: "28px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ background: badgeBg(o.rank), color: badgeFg(o.rank), borderRadius: THEME.radius.full, fontSize: 8, fontFamily: THEME.fontMono, padding: "3px 8px" }}>{labels[o.rank] || labels[3]}</span>
              <span style={{ color: THEME.textTertiary, fontSize: 10, fontStyle: "italic" }}>{o.bestFor}</span>
            </div>
            <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>{o.title}</div>
            <div style={{ marginTop: 4, color: THEME.textSecondary, fontSize: 11, fontFamily: THEME.fontMono }}>{`${o.ecmaStyle} · ${o.ecmaName}`}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <span style={{ background: THEME.surface3, borderRadius: THEME.radius.sm, padding: "4px 8px", fontFamily: THEME.fontMono, color: THEME.accent }}>{`L:${o.L}`}</span>
              <span style={{ background: THEME.surface3, borderRadius: THEME.radius.sm, padding: "4px 8px", fontFamily: THEME.fontMono, color: "#3D9970" }}>{`W:${o.W}`}</span>
              <span style={{ background: THEME.surface3, borderRadius: THEME.radius.sm, padding: "4px 8px", fontFamily: THEME.fontMono, color: "#2563EB" }}>{`H:${o.H}`}</span>
            </div>
            <div style={{ marginTop: 12, color: THEME.textSecondary, fontSize: 11, fontFamily: THEME.fontMono }}>{`${o.boardGrade} · ${o.boardCalliper}mm`}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              {metric(`${o.bctEstimate} kN`, "BCT EST.", bctColor(o.bctEstimate))}
              {metric(`£${Number(o.estimatedCostPerUnit || 0).toFixed(3)}`, "PER UNIT", THEME.textSecondary)}
              {metric(`${o.sustainabilityScore}/10`, "ECO SCORE", o.sustainabilityScore > 7 ? THEME.success : o.sustainabilityScore > 4 ? THEME.accent : THEME.textSecondary)}
            </div>
            {o.insertRequired && (
              <div style={{ marginTop: 12, color: THEME.textTertiary, fontSize: 10, display: "flex", alignItems: "center", gap: 6 }} title={o.insertDescription || ""}>
                <Icon name="grid" size={12} />
                {`Insert: ${o.insertType}`}
              </div>
            )}
            <div style={{ marginTop: 16, color: THEME.textSecondary, fontSize: 12, lineHeight: 1.6 }}>{o.reasoning}</div>
            <div style={{ marginTop: 8, color: THEME.textTertiary, fontSize: 11, fontStyle: "italic" }}>{o.tradeoffs}</div>
            <button onClick={() => onSelect(o)} style={{ marginTop: 20, width: "100%", borderRadius: THEME.radius.md, padding: "8px 10px", border: o.rank === 1 ? "none" : `1px solid ${THEME.accentBorder}`, background: o.rank === 1 ? THEME.accent : "transparent", color: o.rank === 1 ? THEME.textOnAccent : THEME.accent }}>
              Use this option →
            </button>
          </motion.div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowTable((v) => !v)} style={{ color: THEME.textSecondary }}>{`Compare all metrics ${showTable ? "▴" : "▾"}`}</button>
        {showTable && (
          <div style={{ marginTop: 8, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, overflow: "hidden" }}>
            {["ecmaStyle", "boardGrade", "bctEstimate", "estimatedCostPerUnit", "sustainabilityScore"].map((k, ri) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: `180px repeat(${options.length}, 1fr)`, background: ri % 2 ? THEME.surface3 : THEME.surface2 }}>
                <div style={{ padding: 8, borderRight: `1px solid ${THEME.surface4}`, color: THEME.textTertiary }}>{k}</div>
                {options.map((o, i) => <div key={i} style={{ padding: 8, borderRight: i < options.length - 1 ? `1px solid ${THEME.surface4}` : "none" }}>{String(o[k])}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18, color: THEME.textTertiary, fontSize: 11 }}>
        Not quite right?{" "}
        <button onClick={onAdjust} style={{ color: THEME.textSecondary, textDecoration: "underline" }}>Adjust answers</button>
        {"  "}
        <button onClick={onRegenerate} style={{ color: THEME.textSecondary, textDecoration: "underline" }}>Generate different options</button>
      </div>
    </div>
  );
}

