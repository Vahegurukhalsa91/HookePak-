import { useState } from "react";
import { THEME } from "../theme";
import { Icon } from "./Icon";
import { AnthropicKeyEditorModal } from "./AnthropicApiKeyPanel";

export function TopBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const platform = window?.hookepak?.platform || "win32";
  const version = window?.hookepak?.version || "0.1.0";
  const leftPad = platform === "darwin" ? 72 : 12;

  return (
    <>
      {settingsOpen && <AnthropicKeyEditorModal onClose={() => setSettingsOpen(false)} />}
    <div className="drag-region" style={{ height: 32, background: THEME.surface1, borderBottom: `1px solid ${THEME.surface4}`, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: leftPad, paddingRight: 12 }}>
      <div className="no-drag" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: THEME.fontMono, fontSize: 13, letterSpacing: "-0.02em" }}>
          <span style={{ color: THEME.textSecondary }}>Hooke</span>
          <span style={{ color: THEME.accent }}>Pak</span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div className="no-drag" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ color: THEME.textTertiary, fontSize: 10, fontFamily: THEME.fontMono }}>{`v${version}`}</div>
        <button
          type="button"
          title="Anthropic API key"
          onClick={() => setSettingsOpen(true)}
          className="no-drag"
          style={{ width: 24, height: 24, borderRadius: THEME.radius.sm, display: "grid", placeItems: "center", color: THEME.textSecondary, background: THEME.surface2, border: "none", cursor: "pointer" }}
        >
          <Icon name="settings" size={14} />
        </button>
        <div style={{ width: 24, height: 24, borderRadius: THEME.radius.full, background: THEME.surface3, color: THEME.textSecondary, fontSize: 11, display: "grid", placeItems: "center", fontFamily: THEME.fontMono }}>RS</div>
      </div>
    </div>
    </>
  );
}

