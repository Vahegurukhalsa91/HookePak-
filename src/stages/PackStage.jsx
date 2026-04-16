import { useEffect } from "react";
import { THEME } from "../theme";

/**
 * Pack stage overlay — transit preview is driven by SceneManager + transitCarton.revealCount.
 */
export function PackStage({ designState, updateDesign }) {
  const primary = designState?.primary;
  const transit = designState?.transitCarton;

  useEffect(() => {
    if (!transit || !updateDesign) return;
    const total = Math.max(1, (transit.cols || 1) * (transit.rows || 1) * (transit.layers || 1));
    let count = 0;
    updateDesign("transitCarton", (prev) => (prev ? { ...prev, revealCount: 0 } : prev));
    const id = setInterval(() => {
      count += 1;
      updateDesign("transitCarton", (prev) => {
        if (!prev) return prev;
        return { ...prev, revealCount: Math.min(count, total) };
      });
      if (count >= total) clearInterval(id);
    }, 50);
    return () => {
      clearInterval(id);
    };
  }, [transit?.L, transit?.W, transit?.H, transit?.cols, transit?.rows, transit?.layers, updateDesign]);

  if (!primary || !transit) {
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
        Pack stage — configure primary pack first
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 12,
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          alignSelf: "flex-start",
          maxWidth: 420,
          background: "rgba(13,12,11,0.82)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${THEME.surface4}`,
          borderRadius: THEME.radius.md,
          padding: "10px 14px",
          fontFamily: THEME.fontMono,
          fontSize: 10,
          color: THEME.textSecondary,
        }}
      >
        <div style={{ color: THEME.accent, marginBottom: 6, fontSize: 9, letterSpacing: "0.08em" }}>TRANSIT PREVIEW</div>
        Corrugated kraft shell · primary units ({Math.round(primary.L)}×{Math.round(primary.W)}×{Math.round(primary.H)} mm) filling{" "}
        <span style={{ color: THEME.textPrimary }}>{transit.arrangementLabel || "—"}</span>
      </div>
    </div>
  );
}
