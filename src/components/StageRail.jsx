import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";
import { STAGES, THEME } from "../theme";
import { Icon } from "./Icon";

export function StageRail({ activeStage, setActiveStage, stageStatus }) {
  const activeIdx = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <Tooltip.Provider delayDuration={150}>
      <div style={{ width: 56, height: "100%", background: THEME.surface2, borderRight: `1px solid ${THEME.surface4}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
        {STAGES.map((stage, idx) => {
          const isActive = stage.id === activeStage;
          const status = stageStatus[stage.id];
          const isComplete = status === "complete";
          const isPending = status === "pending";
          const color = isActive ? THEME.accent : isComplete ? THEME.success : THEME.textTertiary;
          const canOpen = isActive || isComplete;
          return (
            <div key={stage.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button onClick={() => canOpen && setActiveStage(stage.id)} style={{ width: 56, height: 72, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent" }} title={isPending ? "Complete previous stages first" : stage.label}>
                    {isActive && (
                      <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.2 }} style={{ position: "absolute", left: 0, width: 2, height: 32, borderRadius: "0 2px 2px 0", background: THEME.accent }} />
                    )}
                    <div style={{ padding: 7, borderRadius: THEME.radius.md, background: isActive ? THEME.accentMuted : "transparent", boxShadow: isActive ? "0 0 12px rgba(232,168,56,0.35)" : "none" }}>
                      <Icon name={stage.icon} size={22} color={color} />
                    </div>
                    <div style={{ fontFamily: THEME.fontMono, fontSize: 9, letterSpacing: "0.08em", color }}>{stage.shortLabel}</div>
                    <div style={{ width: 4, height: 4, borderRadius: THEME.radius.full, background: isComplete ? THEME.success : isActive ? THEME.accent : "transparent", border: isPending ? `1px solid ${THEME.surface4}` : "none", animation: isActive ? "pulse-dot 2s infinite" : "none" }} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="right" sideOffset={8} style={{ whiteSpace: "pre-line", maxWidth: 220, background: THEME.surface3, color: THEME.textPrimary, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.md, padding: "8px 10px", fontSize: 11 }}>
                    {isPending ? "Complete previous stages first" : `${stage.label}\n${stage.description}`}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              {idx < STAGES.length - 1 && (
                <div style={{ width: 4, height: 8, background: idx < activeIdx ? THEME.success : idx === activeIdx ? `linear-gradient(${THEME.accentMuted}, ${THEME.surface4})` : THEME.surface4, borderRadius: 2 }} />
              )}
            </div>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}

