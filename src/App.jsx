import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shell } from "./components/Shell";
import { STAGES, THEME } from "./theme";
import { SubstrateScreen } from "./screens/SubstrateScreen";
import { EntryScreen } from "./screens/EntryScreen";
import { ConversationScreen } from "./screens/ConversationScreen";
import { OptionsScreen } from "./screens/OptionsScreen";
import { parseArrangement } from "./CartonBuilder";

function extractPrimaryContentsQty(log) {
  if (!log || typeof log !== "string") return 1;
  const block = log.match(/quantity[^\n]{0,160}?\n\s*User:\s*([^\n]+)/i);
  if (block) {
    const n = parseInt(String(block[1]).replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(10000, n);
  }
  const matches = [...log.matchAll(/User:\s*([^\n]+)/gi)];
  const last = matches.length ? matches[matches.length - 1][1] : "";
  const n2 = parseInt(String(last).trim(), 10);
  if (Number.isFinite(n2) && n2 > 0 && n2 <= 10000) return n2;
  return 1;
}

function mapECMAToInternal(ecmaStyle) {
  const map = {
    "ECMA-C12": "straight-tuck",
    "ECMA-C14": "reverse-tuck",
    "ECMA-A50": "auto-bottom",
    "ECMA-B40": "sleeve",
  };
  return map[ecmaStyle] || "straight-tuck";
}

function sanitizeDimsFromOption(option) {
  const vals = [Number(option?.L), Number(option?.W), Number(option?.H)].map((n) => (Number.isFinite(n) ? n : 0));
  if (vals.some((n) => n <= 0)) return { L: 120, W: 64, H: 42 };
  vals.sort((a, b) => b - a);
  let [L, W, H] = vals;
  if (L > 5000 || H > 5000) {
    L /= 10;
    W /= 10;
    H /= 10;
  }
  return {
    L: Math.max(30, Math.min(1200, Math.round(L))),
    W: Math.max(20, Math.min(900, Math.round(W))),
    H: Math.max(20, Math.min(900, Math.round(H))),
  };
}

function normalizeInsert(option) {
  const allowed = new Set(["cell divider", "wrap insert", "display tray"]);
  const rawType = String(option?.insertType || "").trim().toLowerCase();
  if (!option?.insertRequired || !allowed.has(rawType)) {
    return { insertRequired: false, insertType: null };
  }
  return { insertRequired: true, insertType: rawType };
}

export default function App() {
  const [activeStage, setActiveStage] = useState("primary");
  const [stageStatus, setStageStatus] = useState({
    primary: "active",
    pack: "pending",
    pallet: "pending",
    report: "pending",
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [appScreen, setAppScreen] = useState("substrate");
  const [selectedSubstrate, setSelectedSubstrate] = useState(null);
  const [conversationLog, setConversationLog] = useState("");
  const [generatedOptions, setGeneratedOptions] = useState(null);
  const [entryRoute, setEntryRoute] = useState(null);
  const [productFile, setProductFile] = useState(null);
  const [productBBox, setProductBBox] = useState(null);
  const [toast, setToast] = useState("");
  const [designState, setDesignState] = useState({
    product: null,
    primary: null,
    transitCarton: null,
    pallet: null,
  });

  const updateDesign = useCallback((key, value) => {
    setDesignState((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? value(prev[key]) : value,
    }));
  }, []);

  const advanceStage = useCallback((fromStage) => {
    const idx = STAGES.findIndex((s) => s.id === fromStage);
    if (idx < STAGES.length - 1) {
      const nextStage = STAGES[idx + 1].id;
      setStageStatus((prev) => ({
        ...prev,
        [fromStage]: "complete",
        [nextStage]: "active",
      }));
      setActiveStage(nextStage);
    }
  }, []);

  const onSelectOption = useCallback(
    (option) => {
      const wall = 5;
      const arr = parseArrangement(option.arrangement || "2x3x1");
      const safeDims = sanitizeDimsFromOption(option);
      const safeInsert = normalizeInsert(option);
      const primaryL = safeDims.L;
      const primaryW = safeDims.W;
      const primaryH = safeDims.H;
      const targetQty = arr.cols * arr.rows * arr.layers;

      setDesignState((prev) => ({
        ...prev,
        primary: {
          L: primaryL,
          W: primaryW,
          H: primaryH,
          style: mapECMAToInternal(option.ecmaStyle),
          ecmaCode: option.ecmaStyle,
          ecmaName: option.ecmaName,
          board: option.boardGrade,
          boardThickness: option.boardCalliper,
          boardGrade: option.boardGrade,
          boardCalliper: option.boardCalliper,
          insertRequired: safeInsert.insertRequired,
          insertType: safeInsert.insertType,
          arrangement: option.arrangement,
          bctEstimate: option.bctEstimate,
          estimatedCost: option.estimatedCostPerUnit,
          aiAnswers: conversationLog,
          aiOption: option,
          viewMode: "full3d",
          foldProgress: 1,
          placedFeatures: [],
          selectedDielinePanel: null,
          palletColumnUnits: 12,
          productWeightKg: 0.2,
          quantity: extractPrimaryContentsQty(conversationLog),
        },
        transitCarton: {
          cols: arr.cols,
          rows: arr.rows,
          layers: arr.layers,
          L: arr.cols * primaryL + 2 * wall,
          W: arr.rows * primaryW + 2 * wall,
          H: arr.layers * primaryH + 2 * wall,
          style: "0201",
          board: "B-flute",
          targetQty,
          arrangementLabel: `${arr.cols}×${arr.rows}×${arr.layers}`,
          fillPattern: "grid",
          revealCount: 0,
        },
      }));
      setStageStatus({
        primary: "active",
        pack: "pending",
        pallet: "pending",
        report: "pending",
      });
      setActiveStage("primary");
      setAppScreen("workspace");
      setToast(`* Option ${option.rank} loaded: ${option.title} ${option.L} x ${option.W} x ${option.H}mm · ${option.boardGrade} · BCT ${option.bctEstimate}kN`);
      setTimeout(() => setToast(""), 4000);
      const recent = JSON.parse(localStorage.getItem("hookepak_recent") || "[]");
      const rec = [{ id: Date.now().toString(36), icon: "package", name: option.title, date: new Date().toLocaleDateString() }, ...recent].slice(0, 8);
      localStorage.setItem("hookepak_recent", JSON.stringify(rec));
    },
    [conversationLog, entryRoute]
  );

  const screenOverlay = useMemo(
    () => ({
      substrate: <SubstrateScreen onSelect={(id) => { if (id === "paperboard") { setSelectedSubstrate("Folding Carton"); setEntryRoute(null); setProductFile(null); setProductBBox(null); setConversationLog(""); setGeneratedOptions(null); setAppScreen("conversation"); } }} onOpenRecent={() => setAppScreen("workspace")} />,
      entry: (
        <EntryScreen
          substrate={selectedSubstrate}
          onBack={() => setAppScreen("substrate")}
          onSelectRoute={(route, file) => {
            setEntryRoute(route);
            setProductFile(file || null);
            setConversationLog("");
            setGeneratedOptions(null);
            setAppScreen("conversation");
          }}
        />
      ),
      conversation: (
        <ConversationScreen
          entryRoute={entryRoute}
          productBBox={productBBox}
          productFileName={productFile?.name ?? null}
          productGeometry={null}
          onCadImported={({ route, file, bbox }) => {
            setEntryRoute(route);
            setProductFile(file || null);
            setProductBBox(bbox || null);
          }}
          onOptionsReady={(options, log) => {
            setGeneratedOptions(options);
            if (log) setConversationLog(log);
            setAppScreen("options");
          }}
          onBack={() => setAppScreen("substrate")}
        />
      ),
      options: (
        <OptionsScreen
          options={generatedOptions || []}
          onSelect={onSelectOption}
          onAdjust={() => setAppScreen("conversation")}
          onRegenerate={() => setAppScreen("conversation")}
        />
      ),
      workspace: null,
    }),
    [selectedSubstrate, entryRoute, productFile, productBBox, generatedOptions, designState, onSelectOption]
  );

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Shell
        activeStage={activeStage}
        setActiveStage={setActiveStage}
        stageStatus={stageStatus}
        aiOpen={aiOpen}
        setAiOpen={setAiOpen}
        toolPanelOpen={toolPanelOpen}
        setToolPanelOpen={setToolPanelOpen}
        inspectorOpen={inspectorOpen}
        setInspectorOpen={setInspectorOpen}
        designState={designState}
        updateDesign={updateDesign}
        advanceStage={advanceStage}
        setToast={setToast}
      />
      <AnimatePresence mode="wait">
        {appScreen !== "workspace" && (
          <motion.div
            key={appScreen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{ position: "absolute", inset: 0, zIndex: 100, background: "rgba(13,12,11,0.92)", backdropFilter: "blur(20px)" }}
          >
            {screenOverlay[appScreen]}
          </motion.div>
        )}
      </AnimatePresence>
      {appScreen === "workspace" && (
        <button onClick={() => setAppScreen("substrate")} style={{ position: "fixed", top: 4, right: 120, zIndex: 50, background: THEME.surface3, border: `1px solid ${THEME.surface4}`, color: THEME.textSecondary, padding: "4px 12px", borderRadius: THEME.radius.md, fontSize: 10, fontFamily: THEME.fontMono }}>
          + New
        </button>
      )}
      {toast && (
        <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 120, background: THEME.surface3, border: `1px solid ${THEME.surface4}`, borderLeft: `3px solid ${THEME.accent}`, borderRadius: THEME.radius.md, padding: "10px 12px", fontFamily: THEME.fontMono, fontSize: 10 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
