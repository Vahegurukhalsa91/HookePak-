import { AnimatePresence, motion } from "framer-motion";
import { THEME } from "../theme";
import { TopBar } from "./TopBar";
import { StageRail } from "./StageRail";
import { AIBar } from "./AIBar";
import { ToolPanel } from "./ToolPanel";
import { Inspector } from "./Inspector";
import { Canvas3D } from "./Canvas3D";
import { StageContent } from "./StageContent";

export function Shell(props) {
  const { activeStage, setActiveStage, stageStatus, aiOpen, setAiOpen, toolPanelOpen, inspectorOpen, designState, advanceStage, updateDesign, setToast } = props;
  return (
    <div style={{ display: "grid", gridTemplateRows: "32px 1fr auto", gridTemplateColumns: "56px auto 1fr auto", height: "100vh", width: "100vw", background: THEME.surface1, overflow: "hidden", fontFamily: THEME.fontSans, color: THEME.textPrimary }}>
      <div style={{ gridColumn: "1 / -1", gridRow: "1" }}>
        <TopBar />
      </div>
      <div style={{ gridColumn: "1", gridRow: "2" }}>
        <StageRail activeStage={activeStage} setActiveStage={setActiveStage} stageStatus={stageStatus} />
      </div>
      <AnimatePresence>
        {toolPanelOpen && (
          <motion.div style={{ gridColumn: "2", gridRow: "2", zIndex: 10 }} initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={THEME.spring}>
            <ToolPanel
              activeStage={activeStage}
              stageStatus={stageStatus}
              setActiveStage={setActiveStage}
              advanceStage={advanceStage}
              designState={designState}
              updateDesign={updateDesign}
              setToast={setToast}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ gridColumn: "3", gridRow: "2", position: "relative" }}>
        <Canvas3D designState={designState} activeStage={activeStage} />
        <StageContent activeStage={activeStage} stageStatus={stageStatus} designState={designState} updateDesign={updateDesign} setToast={setToast} />
      </div>
      <AnimatePresence>
        {inspectorOpen && (
          <motion.div style={{ gridColumn: "4", gridRow: "2", zIndex: 10 }} initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={THEME.spring}>
            <Inspector />
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ gridColumn: "1 / -1", gridRow: "3" }}>
        <AIBar open={aiOpen} setOpen={setAiOpen} activeStage={activeStage} />
      </div>
    </div>
  );
}

