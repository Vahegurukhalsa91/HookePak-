import { THEME } from "../theme";
import { Icon } from "./Icon";

export function Inspector() {
  return (
    <div style={{ width: 300, height: "100%", background: THEME.surface2, borderLeft: `1px solid ${THEME.surface4}`, display: "grid", placeItems: "center", color: THEME.textTertiary }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}><Icon name="layers" size={32} color={THEME.textTertiary} /></div>
        <div style={{ fontSize: 12 }}>Select an object in the 3D view</div>
      </div>
    </div>
  );
}

