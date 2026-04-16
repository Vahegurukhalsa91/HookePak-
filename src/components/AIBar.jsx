import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { THEME } from "../theme";
import { Icon } from "./Icon";

const chipsByStage = {
  primary: ["Is this structurally sound?", "Run BCT analysis", "Suggest a lighter board grade", "Reduce material by 10%", "Check print registration risks"],
  pack: ["Suggest a denser transit arrangement", "Compare B vs C flute for this stack", "Estimate void fill", "Optimise for UK pallet"],
  pallet: ["Maximise units per pallet", "Compare stacking patterns", "Calculate shipping cost estimate", "Generate pallet report"],
  default: ["What can you help with?", "Explain BCT", "What is ISTA 3A?"],
};

export function AIBar({ open, setOpen, activeStage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const chips = useMemo(() => chipsByStage[activeStage] || chipsByStage.default, [activeStage]);

  useEffect(() => {
    const t = setTimeout(() => {
      setMessages((m) => (m.length ? m : [{ role: "ai", text: "Hi - I'm HookePak AI. I can help you design packaging, run structural analysis and optimise your supply chain. Import a product to get started, or describe what you need." }]));
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const send = (text) => {
    const v = (text ?? input).trim();
    if (!v) return;
    setMessages((m) => [{ role: "user", text: v }, ...m]);
    setInput("");
  };

  return (
    <div style={{ background: THEME.surface2, borderTop: `1px solid ${THEME.surface4}` }}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 276, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={THEME.spring} style={{ overflow: "hidden", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {chips.map((chip) => (
                <button key={chip} onClick={() => send(chip)} style={{ whiteSpace: "nowrap", border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.full, padding: "5px 10px", background: THEME.surface3, color: THEME.textSecondary, fontSize: 11 }}>
                  {chip}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column-reverse", gap: 8 }}>
              {messages.length === 0 ? (
                <div style={{ margin: "auto", textAlign: "center", color: THEME.textTertiary }}>
                  <div style={{ display: "grid", placeItems: "center", marginBottom: 8 }}><Icon name="ai-spark" size={24} color={THEME.ai} /></div>
                  <div>HookePak AI is aware of your current design.</div>
                  <div>Ask anything about your packaging.</div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "ai" ? "flex-start" : "flex-end", maxWidth: "85%", background: m.role === "ai" ? THEME.surface3 : THEME.accentMuted, border: m.role === "ai" ? `1px solid ${THEME.surface4}` : `1px solid ${THEME.accentBorder}`, borderRadius: THEME.radius.md, padding: "8px 12px", fontSize: 13, lineHeight: 1.6 }}>
                    {m.text}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
        <Icon name="ai-spark" size={18} color={THEME.ai} />
        <div style={{ color: THEME.ai, fontFamily: THEME.fontMono, fontSize: 11, letterSpacing: "0.05em" }}>HookePak AI</div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask HookePak AI..."
          style={{ flex: 1, resize: "none", height: 24, borderBottom: `2px solid ${open ? "rgba(123,97,255,0.5)" : "transparent"}`, color: THEME.textPrimary, fontSize: 13 }}
        />
        {open && (
          <button onClick={() => send()} style={{ width: 28, height: 28, borderRadius: THEME.radius.full, background: THEME.ai, color: THEME.textPrimary, display: "grid", placeItems: "center", boxShadow: THEME.shadow.ai }}>
            <Icon name="send" size={14} />
          </button>
        )}
        <motion.button onClick={() => setOpen((v) => !v)} animate={{ rotate: open ? 180 : 0 }} style={{ width: 20, height: 20, display: "grid", placeItems: "center", color: THEME.textSecondary }}>
          <Icon name="chevron-up" size={16} />
        </motion.button>
      </div>
    </div>
  );
}

