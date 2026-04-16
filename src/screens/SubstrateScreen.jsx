import { motion } from "framer-motion";
import { THEME } from "../theme";
import { Icon } from "../components/Icon";

const SUBSTRATES = [
  {
    id: "paperboard",
    icon: "package",
    name: "Folding Carton",
    desc: "Consumer-facing primary pack",
    examples: "Toothpaste, pharma, cosmetics, food",
    note: "Straight tuck, reverse tuck, auto-bottom, sleeve",
    available: true,
  },
  {
    id: "corrugated",
    icon: "carton",
    name: "Corrugated Carton",
    desc: "Transit & shipping packaging",
    examples: "RSC, trays, telescopes",
    note: "E, B, C flute · BC double wall",
    available: false,
  },
  {
    id: "pouch",
    icon: "pouch",
    name: "Flexible Pouch",
    desc: "Primary flexible packaging",
    examples: "Stand-up, flat, gusset, doypak",
    available: false,
  },
  {
    id: "bottle",
    icon: "bottle",
    name: "Bottle & Jar",
    desc: "Rigid primary containers",
    examples: "Round, oval, pump, spray, jar",
    available: false,
  },
  {
    id: "tube",
    icon: "tube",
    name: "Tube & Sleeve",
    desc: "Cylindrical primary packaging",
    examples: "Cardboard tubes, paper sleeves",
    available: false,
  },
];

function Card({ item, onPick, index }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, ...THEME.easeOut }}
      onClick={() => item.available && onPick(item.id)}
      style={{
        width: 220,
        minHeight: 248,
        borderRadius: THEME.radius.xl,
        border: `1px solid ${THEME.surface4}`,
        background: THEME.surface2,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        textAlign: "left",
        opacity: item.available ? 1 : 0.45,
        cursor: item.available ? "pointer" : "default",
      }}
      whileHover={item.available ? { y: -3, borderColor: THEME.accentBorder, backgroundColor: THEME.surface3, boxShadow: THEME.shadow.md } : {}}
    >
      <div style={{ width: 48, height: 48, display: "grid", placeItems: "center" }}>
        <Icon name={item.icon} size={36} strokeWidth={1.2} color={item.available ? THEME.accent : THEME.textTertiary} />
      </div>
      <div style={{ marginTop: 20, color: item.available ? THEME.textPrimary : THEME.textSecondary, fontSize: 15, fontWeight: 600 }}>{item.name}</div>
      <div style={{ marginTop: 6, color: THEME.textSecondary, fontSize: 11, lineHeight: 1.5 }}>{item.desc}</div>
      <div style={{ marginTop: 8, color: THEME.textTertiary, fontSize: 10, lineHeight: 1.45 }}>{item.examples}</div>
      {item.note && (
        <div style={{ marginTop: 8, color: THEME.textTertiary, fontSize: 9, fontFamily: THEME.fontMono, lineHeight: 1.4 }}>{item.note}</div>
      )}
      {!item.available && (
        <div style={{ marginTop: "auto", background: THEME.surface4, color: THEME.textTertiary, fontSize: 9, fontFamily: THEME.fontMono, borderRadius: THEME.radius.full, padding: "3px 8px" }}>
          COMING SOON
        </div>
      )}
    </motion.button>
  );
}

export function SubstrateScreen({ onSelect, onOpenRecent }) {
  const recent = JSON.parse(localStorage.getItem("hookepak_recent") || "[]");
  return (
    <div style={{ width: "100%", height: "100%", background: THEME.surface1, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto" }}>
      <div style={{ paddingTop: "15vh", textAlign: "center" }}>
        <div style={{ fontFamily: THEME.fontMono, fontSize: 28, letterSpacing: "-0.02em" }}>
          <span style={{ color: THEME.textSecondary }}>Hooke</span>
          <span style={{ color: THEME.accent }}>Pak</span>
        </div>
        <div style={{ marginTop: 8, color: THEME.textTertiary, fontSize: 13 }}>World-class packaging design. AI-engineered.</div>
      </div>
      <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 220px))", justifyContent: "center", gap: 16, width: "min(1100px, 92vw)" }}>
        {SUBSTRATES.map((s, i) => (
          <Card key={s.id} item={s} index={i} onPick={onSelect} />
        ))}
      </div>
      {recent.length > 0 && (
        <div style={{ marginTop: 40, width: "min(900px,92vw)" }}>
          <div style={{ color: THEME.textTertiary, fontSize: 9, fontFamily: THEME.fontMono, letterSpacing: "0.1em", marginBottom: 8 }}>RECENT</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {recent.map((r) => (
              <button key={r.id} onClick={() => onOpenRecent(r)} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "6px 10px", borderRadius: THEME.radius.md, border: `1px solid ${THEME.surface4}`, background: THEME.surface3 }}>
                <Icon name={r.icon || "package"} size={14} color={THEME.textSecondary} />
                <span style={{ color: THEME.textSecondary, fontSize: 11 }}>{r.name}</span>
                <span style={{ color: THEME.textTertiary, fontSize: 10 }}>{r.date || ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: "auto", padding: 16, color: THEME.textTertiary, fontSize: 9, fontFamily: THEME.fontMono }}>HookePak v0.1.0 - © Hooke-X Technologies Ltd</div>
    </div>
  );
}
