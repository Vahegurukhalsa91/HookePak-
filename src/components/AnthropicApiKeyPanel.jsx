import { useState } from "react";
import { THEME } from "../theme";
import { Icon } from "./Icon";

/** Saves key to localStorage as `hookepak_anthropic_key` (and clears legacy `hookepak_api_key`). */
export function AnthropicKeyEditorCard({ onSuccess, submitLabel = "Connect →" }) {
  const [input, setInput] = useState("");
  const save = () => {
    const t = input.trim();
    if (!t.startsWith("sk-ant-")) return;
    localStorage.setItem("hookepak_anthropic_key", t);
    localStorage.removeItem("hookepak_api_key");
    onSuccess();
  };
  return (
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.xl, padding: 32, width: 360, maxWidth: "92vw" }}>
      <div style={{ marginBottom: 8 }}>
        <Icon name="ai-spark" size={24} color={THEME.ai} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: THEME.textPrimary }}>Anthropic API key</div>
      <div style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
        Paste a key from{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.hookepak?.openExternal?.("https://console.anthropic.com");
          }}
          style={{ color: THEME.ai }}
        >
          console.anthropic.com
        </a>
        . Keys usually start with <span style={{ fontFamily: THEME.fontMono }}>sk-ant-api03-</span> or <span style={{ fontFamily: THEME.fontMono }}>sk-ant-</span>.
      </div>
      <input
        type="password"
        placeholder="sk-ant-..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        style={{
          width: "100%",
          background: THEME.surface3,
          border: `1px solid ${THEME.surface4}`,
          borderRadius: THEME.radius.md,
          color: THEME.textPrimary,
          fontSize: 13,
          fontFamily: THEME.fontMono,
          padding: "10px 14px",
          marginBottom: 12,
        }}
      />
      <button
        type="button"
        onClick={save}
        style={{
          width: "100%",
          background: THEME.ai,
          color: "white",
          border: "none",
          borderRadius: THEME.radius.md,
          padding: "10px 0",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function AnthropicKeyEditorModal({ onClose }) {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(13,12,11,0.9)",
        backdropFilter: "blur(10px)",
      }}
      onClick={onClose}
    >
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <AnthropicKeyEditorCard
          submitLabel="Save & reload"
          onSuccess={() => {
            window.location.reload();
          }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            background: "transparent",
            border: `1px solid ${THEME.surface4}`,
            color: THEME.textSecondary,
            borderRadius: THEME.radius.md,
            padding: "8px 0",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
