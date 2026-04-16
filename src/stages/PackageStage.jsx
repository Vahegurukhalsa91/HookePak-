import { THEME } from "../theme";

export function PackageStage({ status = "pending" }) {
  return (
    <div style={{ pointerEvents: "auto", margin: 16, display: "inline-flex", padding: "8px 14px", border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, background: "rgba(30,28,25,0.8)", backdropFilter: "blur(8px)", fontFamily: THEME.fontMono, fontSize: 11 }}>
      Primary Pack stage | {status}
    </div>
  );
}
