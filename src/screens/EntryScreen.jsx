import { THEME } from "../theme";
import { Icon } from "../components/Icon";

const cardStyle = {
  width: 280,
  height: 220,
  borderRadius: THEME.radius.xl,
  border: `1px solid ${THEME.surface4}`,
  background: THEME.surface2,
  padding: "24px 22px",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  cursor: "pointer",
  transition: "all 200ms ease",
};

export function EntryScreen({ substrate, onBack, onSelectRoute }) {
  const pickCad = async () => {
    const res = await window?.hookepak?.openFile?.();
    if (!res || res.canceled || !res.filePaths?.[0]) return;
    const name = res.filePaths[0].split(/[/\\]/).pop();
    onSelectRoute("cad", { name, path: res.filePaths[0] });
  };

  return (
    <div style={{ width: "100%", height: "100%", padding: "24px 28px", color: THEME.textPrimary }}>
      <button type="button" onClick={onBack} style={{ color: THEME.textSecondary, fontFamily: THEME.fontMono, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>
        ← Back
      </button>
      <div style={{ marginTop: 12, color: THEME.textTertiary, fontFamily: THEME.fontMono, fontSize: 11 }}>
        {`${substrate || "Folding Carton"}  ›  New Project`}
      </div>
      <div style={{ marginTop: 56, display: "flex", alignItems: "stretch", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
        <button
          type="button"
          style={cardStyle}
          onClick={pickCad}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = THEME.surface3;
            e.currentTarget.style.borderColor = THEME.accentBorder;
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = THEME.shadow.md;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = THEME.surface2;
            e.currentTarget.style.borderColor = THEME.surface4;
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Icon name="import" size={32} color={THEME.accent} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Import Product + AI Design</div>
          <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.65 }}>
            Import a 3D CAD file. HookePak reads your product geometry and our AI designs the optimal packaging around it in full 3D context.
          </div>
          <div style={{ marginTop: 4, fontFamily: THEME.fontMono, fontSize: 9, color: THEME.textTertiary }}>OBJ  ·  STL  ·  GLB  ·  STEP</div>
          <div
            style={{
              marginTop: 8,
              alignSelf: "flex-start",
              background: THEME.accentMuted,
              border: `1px solid ${THEME.accentBorder}`,
              color: THEME.accent,
              fontSize: 9,
              fontFamily: THEME.fontMono,
              padding: "3px 10px",
              borderRadius: THEME.radius.full,
            }}
          >
            ✦ AI-powered
          </div>
        </button>

        <div style={{ width: 1, minHeight: 200, background: THEME.surface4, position: "relative", flexShrink: 0 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 140,
              textAlign: "center",
              color: THEME.textTertiary,
              fontSize: 10,
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            same AI result — different starting point
          </div>
        </div>

        <button
          type="button"
          style={cardStyle}
          onClick={() => onSelectRoute("ai", null)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = THEME.surface3;
            e.currentTarget.style.borderColor = THEME.aiBorder;
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = THEME.shadow.md;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = THEME.surface2;
            e.currentTarget.style.borderColor = THEME.surface4;
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Icon name="ai-spark" size={32} color={THEME.ai} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Describe Product + AI Design</div>
          <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.65 }}>
            No CAD file needed. Describe your product and HookePak AI will ask the right questions to design your optimal packaging.
          </div>
          <div
            style={{
              marginTop: "auto",
              alignSelf: "flex-start",
              background: THEME.aiMuted,
              border: `1px solid ${THEME.aiBorder}`,
              color: THEME.ai,
              fontSize: 9,
              fontFamily: THEME.fontMono,
              padding: "3px 10px",
              borderRadius: THEME.radius.full,
            }}
          >
            ✦ AI-powered
          </div>
          <div
            style={{
              marginTop: 10,
              alignSelf: "flex-start",
              background: THEME.ai,
              color: "white",
              borderRadius: THEME.radius.md,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Start conversation →
          </div>
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: 28, color: THEME.textTertiary, fontSize: 10, maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
        Either way, you&apos;ll get a parametric design you can fully edit in 3D — with AI available throughout.
      </div>
    </div>
  );
}
