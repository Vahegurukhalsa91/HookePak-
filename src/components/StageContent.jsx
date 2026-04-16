import { AnimatePresence, motion } from "framer-motion";
import { THEME } from "../theme";
import { PrimaryStage } from "../stages/PrimaryStage";
import { PackStage } from "../stages/PackStage";
import { PalletStage } from "../stages/PalletStage";
import { ReportStage } from "../stages/ReportStage";

export function StageContent({ activeStage, stageStatus, designState, updateDesign, setToast }) {
  const stageProps = { status: stageStatus[activeStage], designState, updateDesign, setToast };
  const map = {
    primary: PrimaryStage,
    pack: PackStage,
    pallet: PalletStage,
    report: ReportStage,
  };
  const Comp = map[activeStage] || PrimaryStage;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      <AnimatePresence mode="wait">
        <motion.div key={activeStage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={THEME.easeOut} style={{ position: "absolute", inset: 0 }}>
          <Comp {...stageProps} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
