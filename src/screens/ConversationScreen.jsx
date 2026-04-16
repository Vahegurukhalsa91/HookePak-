import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { THEME } from "../theme";
import { Icon } from "../components/Icon";
import { Canvas3D } from "../components/Canvas3D";
import { StageContent } from "../components/StageContent";

const SYSTEM_PROMPT = (entryRoute, productBBox, productFileName) => `
You are HookePak AI, an expert packaging engineer specialising in 
folding cartons and paperboard packaging for consumer goods.

Your job is to gather enough information about a product to generate 
3 tailored folding carton packaging options. You do this through a 
friendly, professional conversation — asking one question at a time,
never overwhelming the user with multiple questions at once.

INFORMATION YOU NEED TO GATHER (in roughly this order, adapt as needed):
1. What the product is (name, brief description)
2. Product dimensions L × W × H in mm
3. Product weight (filled, including primary container) in grams
4. Target quantity per folding carton (how many units)
5. Sales channel (retail shelf, e-commerce, pharmacy, gifting, wholesale)
6. Target regions/markets (for climate and regulatory factors)
7. Fragility of the product (glass, rigid plastic, flexible, solid)
8. Print requirements (none, 1-2 colour, 4-colour litho, digital)
9. Sustainability preferences
10. Any special requirements (tamper evidence, resealable, display window, etc.)

WHAT YOU ALREADY KNOW:
${entryRoute === "cad" && productBBox
  ? `The user has imported a CAD file: "${productFileName || "product"}".
     Detected bounding box: ${productBBox.L} × ${productBBox.W} × ${productBBox.H} mm.
     Do NOT ask for dimensions — you already have them.
     Acknowledge this in your opening message naturally.`
  : `The user has not provided a CAD file. You will need to ask for dimensions.`}

CONVERSATION RULES:
- Ask ONE question per message. Never ask two questions in one message.
- Be conversational and professional. Not robotic.
- When you ask a question that has obvious discrete options, 
  end your message with a special tag so the UI can show chip buttons.
  Format: [CHIPS: option1 | option2 | option3 | option4]
  Keep chip labels short (2-4 words each).
  Always include an "Other" chip when relevant.
- When you need product dimensions, end your message with: [DIMENSIONS]
  The UI will show a special L × W × H input.
- When you have gathered enough information (typically after 6-9 questions),
  end your message with: [GENERATE_OPTIONS]
  This tells the UI you are ready to generate packaging options.
- Never include [GENERATE_OPTIONS] until you have at minimum:
  product description, dimensions, weight, quantity, and channel.
- Keep messages concise — 1-3 sentences before the question.
- Acknowledge the previous answer briefly before asking the next question.
- If an answer is vague (e.g. "medium size") ask a quick follow-up 
  to get a number rather than guessing.
- Show progress naturally: after ~5 questions, you can say something like
  "Just a couple more things..." so the user knows they are nearly done.
- Do not use bullet points or lists in your messages. Conversational prose only.
- Do not mention ECMA codes or technical terms in the conversation — 
  save the technical detail for the options screen.

PROGRESS TAG:
After each of your messages, include a tag so the UI can show a progress bar:
[PROGRESS: N/10] where N is roughly how many key pieces of info you have.
Start at 0/10 on your first message (just the greeting).

When the user message is exactly '__START__', this is the system 
initialising the conversation. Send your opening greeting and first 
question as described above. Do not mention the word START.

OPENING MESSAGE:
${entryRoute === "cad" && productBBox
  ? `Start with: "I can see from your file that your product is 
     ${productBBox.L} × ${productBBox.W} × ${productBBox.H} mm — 
     great starting point. What product is this exactly, 
     and what industry is it for?"
     Tag this with [CHIPS: Personal care | Cosmetics | Pharma | Food & beverage | Household | Gifting | Other]
     and [PROGRESS: 1/10]`
  : `Start with a warm greeting and ask what product they are designing packaging for.
     Keep it open — do not give chip options for the first question,
     let them describe in their own words.
     Tag with [PROGRESS: 0/10]`}
`;

function anthropicHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": localStorage.getItem("hookepak_anthropic_key") || "",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function looksLikeCadImportIntent(text) {
  return /\b(import|upload|cad|file|stl|obj|glb|step|stp)\b/i.test(text || "");
}

function looksLikeDescribeIntent(text) {
  return /\b(describe|no cad|no file|text|manual|type it)\b/i.test(text || "");
}

function extractDimsFromFilename(name) {
  if (!name) return null;
  const m = name.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
  if (!m) return null;
  const L = Number(m[1]);
  const W = Number(m[2]);
  const H = Number(m[3]);
  if ([L, W, H].every((v) => Number.isFinite(v) && v > 0)) {
    return { L, W, H };
  }
  return null;
}

function fallbackDimsFromExt(name) {
  const ext = (name || "").toLowerCase();
  if (ext.endsWith(".step") || ext.endsWith(".stp")) return { L: 120, W: 64, H: 42 };
  if (ext.endsWith(".gltf")) return { L: 120, W: 64, H: 42 };
  return { L: 120, W: 64, H: 42 };
}

function sanitizeBBox(bbox) {
  if (!bbox) return { L: 120, W: 64, H: 42 };
  const vals = [Number(bbox.L), Number(bbox.W), Number(bbox.H)].map((n) => (Number.isFinite(n) ? n : 0));
  if (vals.some((n) => n <= 0)) return { L: 120, W: 64, H: 42 };
  vals.sort((a, b) => b - a);
  let [L, W, H] = vals;
  // Keep preview dimensions in a sane range for camera + fold renderer.
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

function openCadFileInBrowser() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".obj,.stl,.glb,.gltf,.step,.stp";
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve(file);
    };
    input.click();
  });
}

function finalizeDimsFromBounds(bounds) {
  if (!bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) return null;
  const dims = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ]
    .map((v) => Math.max(1, Math.round(v)));
  dims.sort((a, b) => b - a);
  return { L: dims[0], W: dims[1], H: dims[2] };
}

async function parseBrowserCadBBox(file) {
  if (!file) return null;
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".obj")) {
    const text = await file.text();
    const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line.startsWith("v ")) continue;
      const p = line.split(/\s+/);
      if (p.length < 4) continue;
      const x = Number(p[1]);
      const y = Number(p[2]);
      const z = Number(p[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.minZ = Math.min(bounds.minZ, z);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
      bounds.maxZ = Math.max(bounds.maxZ, z);
    }
    return finalizeDimsFromBounds(bounds);
  }

  if (lower.endsWith(".stl")) {
    const ab = await file.arrayBuffer();
    const dv = new DataView(ab);
    const triCount = dv.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    let off = 84;
    for (let i = 0; i < triCount; i += 1) {
      if (off + 50 > dv.byteLength) break;
      off += 12; // normal
      for (let v = 0; v < 3; v += 1) {
        const x = dv.getFloat32(off, true);
        const y = dv.getFloat32(off + 4, true);
        const z = dv.getFloat32(off + 8, true);
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        off += 12;
      }
      off += 2;
    }
    return finalizeDimsFromBounds(bounds);
  }

  if (lower.endsWith(".glb")) {
    const ab = await file.arrayBuffer();
    const dv = new DataView(ab);
    if (dv.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) return null;
    const jsonLen = dv.getUint32(12, true);
    const jsonType = dv.getUint32(16, true);
    if (jsonType !== 0x4e4f534a) return null;
    const jsonBytes = new Uint8Array(ab, 20, jsonLen);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const gltf = JSON.parse(jsonText);
    const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    for (const acc of gltf.accessors || []) {
      if (acc?.type !== "VEC3" || !Array.isArray(acc.min) || !Array.isArray(acc.max)) continue;
      bounds.minX = Math.min(bounds.minX, Number(acc.min[0]));
      bounds.minY = Math.min(bounds.minY, Number(acc.min[1]));
      bounds.minZ = Math.min(bounds.minZ, Number(acc.min[2]));
      bounds.maxX = Math.max(bounds.maxX, Number(acc.max[0]));
      bounds.maxY = Math.max(bounds.maxY, Number(acc.max[1]));
      bounds.maxZ = Math.max(bounds.maxZ, Number(acc.max[2]));
    }
    return finalizeDimsFromBounds(bounds);
  }

  if (lower.endsWith(".step") || lower.endsWith(".stp")) {
    const text = await file.text();
    const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    const re = /CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*,\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*,\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*\)\s*\)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.minZ = Math.min(bounds.minZ, z);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
      bounds.maxZ = Math.max(bounds.maxZ, z);
    }
    return finalizeDimsFromBounds(bounds);
  }

  return null;
}

async function streamAnthropicResponse(response, onDelta) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("No stream body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stop = false;

  while (!stop) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") {
        stop = true;
        break;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
        if (parsed.type === "message_stop" || (parsed.type === "message_delta" && parsed.delta?.stop_reason === "end_turn")) {
          stop = true;
          break;
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 8 }}>
      {!isUser && (
        <div style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="ai-spark" size={14} color={THEME.ai} />
        </div>
      )}
      <div
        style={{
          maxWidth: "80%",
          background: isUser ? THEME.accentMuted : THEME.surface3,
          border: `1px solid ${isUser ? THEME.accentBorder : THEME.surface4}`,
          borderRadius: isUser
            ? `${THEME.radius.lg}px ${THEME.radius.sm}px ${THEME.radius.lg}px ${THEME.radius.lg}px`
            : `${THEME.radius.sm}px ${THEME.radius.lg}px ${THEME.radius.lg}px ${THEME.radius.lg}px`,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          color: THEME.textPrimary,
          fontFamily: THEME.fontSans,
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content || (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            style={{ display: "inline-block", width: 8, height: 14, background: THEME.ai, borderRadius: 1 }}
          />
        )}
      </div>
    </div>
  );
}

function RouteBIllustration() {
  return (
    <div
      style={{
        flex: 1,
        border: `1px solid ${THEME.surface4}`,
        borderRadius: THEME.radius.lg,
        background: "linear-gradient(180deg, #12110f 0%, #0e0d0c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        margin: 16,
      }}
    >
      <div style={{ position: "relative", width: 240, height: 240, display: "grid", placeItems: "center" }}>
        {[1, 0.78, 0.56].map((scale, i) => (
          <motion.div
            key={i}
            animate={{
              scale: [scale, scale * 1.05, scale],
              opacity: [0.35 + i * 0.15, 0.6 + i * 0.12, 0.35 + i * 0.15],
            }}
            transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              border: `2px solid ${THEME.accent}`,
              borderRadius: THEME.radius.lg,
              boxShadow: `0 0 20px rgba(232,168,56,${0.14 + i * 0.08})`,
            }}
          />
        ))}
      </div>
      <div style={{ color: THEME.textTertiary, fontSize: 11, fontFamily: THEME.fontSans, textAlign: "center" }}>
        Your packaging will appear here once designed →
      </div>
    </div>
  );
}

function PackformPrimaryPreview({ productBBox }) {
  const safeBBox = useMemo(() => sanitizeBBox(productBBox), [productBBox]);
  const [previewDesignState, setPreviewDesignState] = useState(() => ({
    product: null,
    primary: {
      L: Number(safeBBox.L),
      W: Number(safeBBox.W),
      H: Number(safeBBox.H),
      style: "straight-tuck",
      ecmaCode: "ECMA-C12",
      ecmaName: "Straight Tuck End",
      board: "SBB 350gsm",
      boardThickness: 0.4,
      boardGrade: "SBB 350gsm",
      boardCalliper: 0.4,
      insertRequired: false,
      insertType: null,
      arrangement: "1×1×1",
      bctEstimate: 6.8,
      estimatedCost: 0.12,
      viewMode: "full3d",
      foldProgress: 1,
      placedFeatures: [],
      selectedDielinePanel: null,
      palletColumnUnits: 12,
      productWeightKg: 0.2,
      quantity: 1,
    },
    transitCarton: null,
    pallet: null,
  }));

  useEffect(() => {
    setPreviewDesignState((prev) => ({
      ...prev,
      primary: {
        ...prev.primary,
        L: Number(safeBBox.L || prev.primary.L || 120),
        W: Number(safeBBox.W || prev.primary.W || 64),
        H: Number(safeBBox.H || prev.primary.H || 42),
        foldProgress: 1,
      },
    }));
  }, [safeBBox.L, safeBBox.W, safeBBox.H]);

  const updatePreviewDesign = useCallback((key, value) => {
    setPreviewDesignState((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? value(prev[key]) : value,
    }));
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <Canvas3D designState={previewDesignState} activeStage="primary" />
      <StageContent
        activeStage="primary"
        stageStatus={{ primary: "active", pack: "pending", pallet: "pending", report: "pending" }}
        designState={previewDesignState}
        updateDesign={updatePreviewDesign}
        setToast={() => {}}
      />
    </div>
  );
}

function FullAnalysisModal({ open, onClose, metrics }) {
  if (!open) return null;
  const panel = {
    background: THEME.surface2,
    border: `1px solid ${THEME.surface4}`,
    borderRadius: THEME.radius.lg,
    padding: 14,
    minHeight: 168,
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "rgba(13,12,11,0.86)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${THEME.surface4}`, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: THEME.textPrimary, fontSize: 16, fontWeight: 600 }}>Full Engineering Analysis</div>
          <div style={{ color: THEME.textTertiary, fontSize: 11 }}>Compression, creep, compliance, board alternatives, fragility and sustainability</div>
        </div>
        <button type="button" onClick={onClose} style={{ background: THEME.surface3, border: `1px solid ${THEME.surface4}`, color: THEME.textPrimary, borderRadius: THEME.radius.md, padding: "7px 12px", cursor: "pointer" }}>
          Close
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(320px, 1fr))", gap: 12 }}>
          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>1. BCT Compression Waterfall</div>
            {[
              ["Actual BCT", metrics.actualBCT, THEME.ai],
              ["Required BCT", metrics.requiredBCT, THEME.accent],
              ["Margin", metrics.margin, metrics.margin >= 0 ? "#3D9970" : "#E85A5A"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: THEME.textTertiary }}>
                  <span>{label}</span>
                  <span>{value} kN</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: THEME.surface4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (Math.abs(value) / 12) * 100)}%`, height: "100%", background: color }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 9, fontSize: 10, color: THEME.textSecondary }}>
              Print: {metrics.derating.print}% • 65% RH: {metrics.derating.humidity}% • Eccentricity: {metrics.derating.eccentricity}% • Stacking: {metrics.derating.stacking}%
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>2. Stack Creep Graph</div>
            <svg viewBox="0 0 360 140" width="100%" height="120">
              <rect x="0" y="0" width="360" height="140" rx="6" fill={THEME.surface3} />
              <polyline fill="none" stroke="#5B8DEF" strokeWidth="2" points="20,18 84,28 148,36 212,42 276,47 340,51" />
              <polyline fill="none" stroke={THEME.ai} strokeWidth="2" points="20,22 84,36 148,46 212,54 276,60 340,65" />
              <polyline fill="none" stroke={THEME.accent} strokeWidth="2" points="20,28 84,48 148,62 212,74 276,84 340,92" />
            </svg>
            <div style={{ fontSize: 10, color: THEME.textSecondary }}>
              50% RH: {metrics.creep.day30_50}% retained • 70% RH: {metrics.creep.day30_70}% retained • 85% RH: {metrics.creep.day30_85}% retained
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>3. Test Compliance Forecast</div>
            {metrics.compliance.map((item) => (
              <div key={item.name} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 16 }}>{item.status}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: THEME.textSecondary }}>{item.reason}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>4. Board Grade Comparison</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {metrics.boards.map((b) => (
                <div key={b.grade} style={{ border: `1px solid ${b.current ? THEME.aiBorder : THEME.surface4}`, background: b.current ? THEME.aiMuted : THEME.surface3, borderRadius: THEME.radius.md, padding: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{b.grade}</div>
                  <div style={{ fontSize: 10, color: THEME.textSecondary }}>BCT {b.bct} kN</div>
                  <div style={{ fontSize: 10, color: THEME.textSecondary }}>£{b.cost.toFixed(3)}</div>
                  <div style={{ fontSize: 10, color: b.margin >= 0 ? "#3D9970" : "#E85A5A" }}>Margin {b.margin} kN</div>
                </div>
              ))}
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>5. Fragility & Drop Risk</div>
            <div style={{ fontSize: 11 }}>Weight class: {metrics.fragility.weightClass}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Estimated drop height: {metrics.fragility.dropHeight} cm</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Gs limit: {metrics.fragility.gsLimit}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Recommended inner packaging: {metrics.fragility.recommended}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: THEME.textTertiary, marginBottom: 4 }}>Severity index</div>
              <div style={{ height: 8, background: THEME.surface4, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${metrics.fragility.severity}%`, background: metrics.fragility.severity > 70 ? "#E85A5A" : THEME.accent }} />
              </div>
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>6. Cost & Sustainability Breakdown</div>
            <div style={{ fontSize: 11 }}>Board: £{metrics.cost.board.toFixed(3)}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Print: £{metrics.cost.print.toFixed(3)}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Conversion: £{metrics.cost.conversion.toFixed(3)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8 }}>Total: £{(metrics.cost.board + metrics.cost.print + metrics.cost.conversion).toFixed(3)}</div>
            <div style={{ marginTop: 8, fontSize: 10, color: THEME.textSecondary }}>
              CO₂ total: {metrics.co2.total} g • Recycled credit: -{metrics.co2.credit} g • Net: {metrics.co2.net} g
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyGate({ children }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem("hookepak_anthropic_key") || "");
  const [apiKeyInput, setApiKeyInput] = useState("");

  if (apiKey) return children;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(13,12,11,0.9)",
          backdropFilter: "blur(10px)",
          zIndex: 10,
        }}
      >
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.xl, padding: 32, width: 360 }}>
          <div style={{ marginBottom: 8 }}>
            <Icon name="ai-spark" size={24} color={THEME.ai} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: THEME.textPrimary }}>Connect HookePak AI</div>
          <div style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
            HookePak AI uses Claude by Anthropic. Enter your Anthropic API key to enable AI-powered packaging design.
            <br />
            <br />
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.hookepak?.openExternal?.("https://console.anthropic.com");
              }}
              style={{ color: THEME.ai }}
            >
              Get your API key at console.anthropic.com →
            </a>
          </div>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKeyInput}
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
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (apiKeyInput.startsWith("sk-ant-")) {
                localStorage.setItem("hookepak_anthropic_key", apiKeyInput);
                setApiKey(apiKeyInput);
              }
            }}
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
            Connect →
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeyEditorModal({ onClose, onSaved }) {
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem("hookepak_anthropic_key") || "");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: "rgba(13,12,11,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 380, background: THEME.surface2, border: `1px solid ${THEME.surface4}`, borderRadius: THEME.radius.xl, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="ai-spark" size={18} color={THEME.ai} />
          <div style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: 600 }}>Anthropic API key</div>
        </div>
        <div style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
          Paste your Claude key (`sk-ant-...`) to enable AI conversation and options generation.
        </div>
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="sk-ant-..."
          style={{
            width: "100%",
            background: THEME.surface3,
            border: `1px solid ${THEME.surface4}`,
            borderRadius: THEME.radius.md,
            color: THEME.textPrimary,
            fontSize: 13,
            fontFamily: THEME.fontMono,
            padding: "10px 12px",
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("hookepak_anthropic_key");
              onSaved?.("");
              onClose();
            }}
            style={{
              background: THEME.surface3,
              border: `1px solid ${THEME.surface4}`,
              color: THEME.textSecondary,
              borderRadius: THEME.radius.md,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Clear key
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: THEME.surface3,
                border: `1px solid ${THEME.surface4}`,
                color: THEME.textPrimary,
                borderRadius: THEME.radius.md,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!apiKeyInput.startsWith("sk-ant-")) return;
                localStorage.setItem("hookepak_anthropic_key", apiKeyInput);
                onSaved?.(apiKeyInput);
                onClose();
              }}
              style={{
                background: THEME.ai,
                border: "none",
                color: "white",
                borderRadius: THEME.radius.md,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Save key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversationScreen({ entryRoute, productBBox, productFileName, productGeometry, onOptionsReady, onBack, onCadImported }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ApiKeyGate>
        <ConversationInner
          entryRoute={entryRoute}
          productBBox={productBBox}
          productFileName={productFileName}
          productGeometry={productGeometry}
          onOptionsReady={onOptionsReady}
          onBack={onBack}
          onCadImported={onCadImported}
        />
      </ApiKeyGate>
    </div>
  );
}

function ConversationInner({ entryRoute, productBBox, productFileName, productGeometry, onOptionsReady, onBack, onCadImported }) {
  const [keyEditorOpen, setKeyEditorOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(entryRoute || null);
  const [currentProductBBox, setCurrentProductBBox] = useState(productBBox || null);
  const [currentProductFileName, setCurrentProductFileName] = useState(productFileName || null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [inputValue, setInputValue] = useState("");
  const [inputMode, setInputMode] = useState("text");
  const [chipOptions, setChipOptions] = useState([]);
  const [dimValues, setDimValues] = useState({ L: "", W: "", H: "" });
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const analysisMetrics = useMemo(
    () => ({
      actualBCT: 9.4,
      requiredBCT: 7.9,
      margin: 1.5,
      derating: { print: 7, humidity: 18, eccentricity: 9, stacking: 5 },
      creep: { day30_50: 89, day30_70: 82, day30_85: 74 },
      compliance: [
        { name: "ISTA 2A", status: "✓", reason: "Compression reserve and moderate handling profile indicate likely pass." },
        { name: "ISTA 3A", status: "⚠", reason: "Pass depends on fragility and corner impact attenuation." },
        { name: "ISTA 6-Amazon SIOC", status: "⚠", reason: "May require stronger edge support for SIOC thresholds." },
        { name: "FEFCO Clamp truck", status: "✗", reason: "Sidewall margin is low under clamp eccentric load." },
      ],
      boards: [
        { grade: "B25", bct: 7.1, cost: 0.109, margin: -0.8, current: false },
        { grade: "B32", bct: 8.3, cost: 0.124, margin: 0.4, current: true },
        { grade: "BC", bct: 10.1, cost: 0.147, margin: 2.2, current: false },
        { grade: "EB", bct: 9.0, cost: 0.139, margin: 1.1, current: false },
      ],
      fragility: {
        weightClass: "Light-medium",
        dropHeight: 76,
        gsLimit: "45 g",
        recommended: "Die-cut pulp cradle or corrugated fitment",
        severity: 63,
      },
      cost: { board: 0.124, print: 0.037, conversion: 0.049 },
      co2: { total: 148, credit: 21, net: 127 },
    }),
    []
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setCurrentRoute(entryRoute || null);
  }, [entryRoute]);

  useEffect(() => {
    setCurrentProductBBox(productBBox || null);
  }, [productBBox]);

  useEffect(() => {
    setCurrentProductFileName(productFileName || null);
  }, [productFileName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const generateOptionsRef = useRef(null);

  const parseAssistantResponse = useCallback((text) => {
    const progressMatch = text.match(/\[PROGRESS:\s*(\d+)\/(\d+)\]/);
    if (progressMatch) {
      setProgress(parseInt(progressMatch[1], 10));
    }

    const cleanText = text
      .replace(/\[CHIPS:[^\]]+\]/g, "")
      .replace(/\[DIMENSIONS\]/g, "")
      .replace(/\[GENERATE_OPTIONS\]/g, "")
      .replace(/\[PROGRESS:\s*\d+\/\d+\]/g, "")
      .trim();

    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length === 0) return prev;
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        content: cleanText,
      };
      return updated;
    });

    if (text.includes("[GENERATE_OPTIONS]")) {
      setInputMode("none");
      setIsGenerating(true);
      setTimeout(() => generateOptionsRef.current?.(), 0);
      return;
    }

    const chipsMatch = text.match(/\[CHIPS:\s*([^\]]+)\]/);
    if (chipsMatch) {
      const options = chipsMatch[1].split("|").map((s) => s.trim()).filter(Boolean);
      setChipOptions(options);
      setInputMode("chips");
      return;
    }

    if (text.includes("[DIMENSIONS]")) {
      setInputMode("dimensions");
      return;
    }

    setInputMode("text");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const generateOptions = useCallback(async () => {
    const transcript = messagesRef.current.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
    const optionsSystemPrompt = `You are a packaging engineer.
Based on the following conversation, generate exactly 3 folding carton 
packaging options. Return ONLY valid JSON — no other text.

The JSON must match this exact structure:
{
  "options": [
    {
      "rank": 1,
      "title": "string",
      "ecmaStyle": "string e.g. ECMA-C12",
      "ecmaName": "string e.g. Straight Tuck End",
      "boardGrade": "string e.g. SBB 350gsm",
      "boardCalliper": number,
      "L": number,
      "W": number,
      "H": number,
      "arrangement": "string e.g. 1×1×1",
      "insertRequired": boolean,
      "insertType": "string | null",
      "insertDescription": "string | null",
      "bctEstimate": number,
      "cobbRating": "string",
      "estimatedCostPerUnit": number,
      "materialArea": number,
      "sustainabilityScore": number,
      "reasoning": "string",
      "tradeoffs": "string",
      "bestFor": "string"
    }
  ]
}

Rank 1 = best overall match, 2 = alternative, 3 = premium or economy variant.
All dimensions in mm. Cost in GBP. BCT in kN. Material area in cm².`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: optionsSystemPrompt,
          messages: [{ role: "user", content: `Here is the design conversation:\n\n${transcript}\n\nGenerate 3 packaging options based on this.` }],
        }),
      });
      const data = await response.json();
      const text = data.content?.find((b) => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setIsGenerating(false);
      onOptionsReady(parsed.options || [], transcript);
    } catch {
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I ran into an issue generating options. Let me try again — could you confirm the product dimensions and target quantity?",
          timestamp: new Date(),
          chips: null,
          showDimensions: false,
        },
      ]);
      setInputMode("text");
    }
  }, [onOptionsReady]);

  useEffect(() => {
    generateOptionsRef.current = generateOptions;
  }, [generateOptions]);

  const sendMessage = useCallback(
    async (userContent) => {
      if (/\b(analysis|simulation|creep|ista)\b/i.test(userContent)) {
        setAnalysisOpen(true);
      }

      if (!currentRoute && looksLikeCadImportIntent(userContent)) {
        const userMsg = { role: "user", content: userContent, timestamp: new Date(), chips: null, showDimensions: false };
        setMessages((prev) => [...prev, userMsg]);
        const hasElectronDialog = typeof window?.hookepak?.openFile === "function";
        let pickedPath = null;
        let pickedName = null;
        let inferred = null;

        if (hasElectronDialog) {
          const res = await window.hookepak.openFile({
            filters: [{ name: "Product CAD", extensions: ["obj", "stl", "glb", "gltf", "step", "stp"] }],
          });
          if (!res || res.canceled || !res.filePaths?.[0]) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "No problem. If you prefer, you can describe the product instead and I'll continue from there.",
                timestamp: new Date(),
                chips: null,
                showDimensions: false,
              },
            ]);
            setChipOptions(["Import CAD", "Describe product"]);
            setInputMode("chips");
            return;
          }
          pickedPath = res.filePaths[0];
          pickedName = pickedPath.split(/[/\\]/).pop();
          try {
            const extracted = await window?.hookepak?.extractCadBBox?.(pickedPath);
            if (extracted?.ok && extracted?.bbox) inferred = extracted.bbox;
          } catch {
            // fallback below
          }
        } else {
          const browserFile = await openCadFileInBrowser();
          if (!browserFile) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "No file selected. If you prefer, describe the product and I can continue from there.",
                timestamp: new Date(),
                chips: null,
                showDimensions: false,
              },
            ]);
            setChipOptions(["Import CAD", "Describe product"]);
            setInputMode("chips");
            return;
          }
          pickedName = browserFile.name;
          inferred = await parseBrowserCadBBox(browserFile);
        }

        if (!pickedName) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "No problem. If you prefer, you can describe the product instead and I'll continue from there.",
              timestamp: new Date(),
              chips: null,
              showDimensions: false,
            },
          ]);
          setChipOptions(["Import CAD", "Describe product"]);
          setInputMode("chips");
          return;
        }
        if (!inferred) inferred = extractDimsFromFilename(pickedName);
        if (!inferred) inferred = fallbackDimsFromExt(pickedName);
        inferred = sanitizeBBox(inferred);
        setCurrentRoute("cad");
        setCurrentProductBBox(inferred);
        setCurrentProductFileName(pickedName);
        onCadImported?.({
          route: "cad",
          file: { name: pickedName, path: pickedPath },
          bbox: inferred,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Imported "${pickedName}". I extracted ${inferred.L} × ${inferred.W} × ${inferred.H} mm automatically, so we can continue straight to design details.`,
            timestamp: new Date(),
            chips: null,
            showDimensions: false,
          },
        ]);
        setTimeout(() => initConversation("cad", inferred, pickedName), 30);
        return;
      }

      if (!currentRoute && looksLikeDescribeIntent(userContent)) {
        const userMsg = { role: "user", content: userContent, timestamp: new Date(), chips: null, showDimensions: false };
        setMessages((prev) => [...prev, userMsg]);
        setCurrentRoute("ai");
        setCurrentProductBBox(null);
        setCurrentProductFileName(null);
        onCadImported?.({ route: "ai", file: null, bbox: null });
        setTimeout(() => initConversation("ai", null, null), 30);
        return;
      }

      const userMsg = {
        role: "user",
        content: userContent,
        timestamp: new Date(),
        chips: null,
        showDimensions: false,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputMode("none");
      setIsStreaming(true);

      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      abortRef.current?.abort?.();
      abortRef.current = new AbortController();
      let fullResponse = "";
      const assistantMsg = { role: "assistant", content: "", timestamp: new Date(), chips: null, showDimensions: false };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: abortRef.current.signal,
          headers: anthropicHeaders(),
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 600,
            stream: true,
            system: SYSTEM_PROMPT(currentRoute || "ai", currentProductBBox, currentProductFileName),
            messages: apiMessages,
          }),
        });

        await streamAnthropicResponse(response, (delta) => {
          fullResponse += delta;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: fullResponse,
            };
            return updated;
          });
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: "I'm having trouble connecting. Please check your API key in settings.",
            };
            return updated;
          });
          setInputMode("text");
        }
      } finally {
        setIsStreaming(false);
      }

      if (fullResponse.trim()) {
        parseAssistantResponse(fullResponse);
      }
    },
    [currentRoute, currentProductBBox, currentProductFileName, onCadImported, parseAssistantResponse]
  );

  const initConversation = useCallback(async (routeArg, bboxArg, fileNameArg) => {
    const route = routeArg || currentRoute;
    const bbox = bboxArg !== undefined ? bboxArg : currentProductBBox;
    const fileName = fileNameArg !== undefined ? fileNameArg : currentProductFileName;
    setIsStreaming(true);
    const openingMsg = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      chips: null,
      showDimensions: false,
    };
    setMessages([openingMsg]);

    abortRef.current?.abort?.();
    abortRef.current = new AbortController();

    let fullResponse = "";
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: abortRef.current.signal,
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          stream: true,
          system: SYSTEM_PROMPT(route || "ai", bbox, fileName),
          messages: [{ role: "user", content: "__START__" }],
        }),
      });

      await streamAnthropicResponse(response, (delta) => {
        fullResponse += delta;
        setMessages((prev) => {
          const updated = [...prev];
          updated[0] = { ...updated[0], content: fullResponse };
          return updated;
        });
      });
      parseAssistantResponse(fullResponse);
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages([
          {
            role: "assistant",
            content: "Hello! I'm HookePak AI. I'm ready to help you design your packaging — what product are we working with today?",
            timestamp: new Date(),
            chips: null,
            showDimensions: false,
          },
        ]);
        setInputMode("text");
      }
    } finally {
      setIsStreaming(false);
    }
  }, [currentRoute, currentProductBBox, currentProductFileName, parseAssistantResponse]);

  useEffect(() => {
    if (!currentRoute) {
      setMessages([
        {
          role: "assistant",
          content: "Welcome to HookePak AI. Would you like to import a product CAD file, or describe your product to begin?",
          timestamp: new Date(),
          chips: null,
          showDimensions: false,
        },
      ]);
      setChipOptions(["Import CAD", "Describe product"]);
      setInputMode("chips");
      setProgress(0);
      return;
    }
    initConversation(currentRoute, currentProductBBox, currentProductFileName);
  }, [initConversation]);

  const handleBack = () => {
    if (messages.length > 0) {
      const ok = window.confirm("Going back will clear this conversation. Continue?");
      if (!ok) return;
    }
    onBack?.();
  };

  function renderInput() {
    if (inputMode === "none" || isStreaming || isGenerating) {
      return null;
    }

    if (inputMode === "chips") {
      return (
        <div>
          <div
            style={{
              fontSize: 9,
              color: THEME.textTertiary,
              fontFamily: THEME.fontMono,
              marginBottom: 10,
              letterSpacing: "0.08em",
            }}
          >
            SELECT ONE{chipOptions.includes("Other") ? " (or type your own below)" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {chipOptions.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => {
                  if (option === "Other") {
                    setInputMode("text");
                    setInputValue("");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  } else {
                    sendMessage(option);
                  }
                }}
                style={{
                  background: THEME.surface3,
                  border: `1px solid ${THEME.surface4}`,
                  color: THEME.textPrimary,
                  padding: "8px 14px",
                  borderRadius: THEME.radius.full,
                  fontSize: 12,
                  fontFamily: THEME.fontSans,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = THEME.accentMuted;
                  e.currentTarget.style.borderColor = THEME.accentBorder;
                  e.currentTarget.style.color = THEME.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = THEME.surface3;
                  e.currentTarget.style.borderColor = THEME.surface4;
                  e.currentTarget.style.color = THEME.textPrimary;
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (inputMode === "dimensions") {
      return (
        <div>
          <div style={{ fontSize: 9, color: THEME.textTertiary, fontFamily: THEME.fontMono, marginBottom: 10, letterSpacing: "0.08em" }}>
            PRODUCT DIMENSIONS
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              { key: "L", label: "Length", color: THEME.accent },
              { key: "W", label: "Width", color: "#3D9970" },
              { key: "H", label: "Height", color: "#5B8DEF" },
            ].map(({ key, label, color }) => (
              <div key={key} style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: THEME.textTertiary, fontFamily: THEME.fontMono, marginBottom: 4 }}>{label.toUpperCase()}</div>
                <input
                  type="number"
                  min={1}
                  placeholder="—"
                  value={dimValues[key]}
                  onChange={(e) => setDimValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{
                    width: "100%",
                    background: THEME.surface3,
                    border: `1px solid ${THEME.surface4}`,
                    borderRadius: THEME.radius.md,
                    color,
                    fontSize: 22,
                    fontFamily: THEME.fontMono,
                    fontWeight: 600,
                    padding: "10px 0",
                    textAlign: "center",
                  }}
                />
                <div style={{ fontSize: 8, color: THEME.textTertiary, fontFamily: THEME.fontMono, marginTop: 4, textAlign: "center" }}>mm</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!dimValues.L || !dimValues.W || !dimValues.H}
            onClick={() => {
              const display = `${dimValues.L} × ${dimValues.W} × ${dimValues.H} mm`;
              sendMessage(display);
              setDimValues({ L: "", W: "", H: "" });
            }}
            style={{
              width: "100%",
              background: THEME.accent,
              color: THEME.textOnAccent,
              border: "none",
              borderRadius: THEME.radius.md,
              padding: "10px 0",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: !dimValues.L || !dimValues.W || !dimValues.H ? 0.4 : 1,
            }}
          >
            Continue →
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", gap: 10 }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && inputValue.trim()) {
              e.preventDefault();
              const val = inputValue.trim();
              setInputValue("");
              sendMessage(val);
            }
          }}
          placeholder="Type your answer..."
          style={{
            flex: 1,
            background: THEME.surface3,
            border: `1px solid ${THEME.surface4}`,
            borderRadius: THEME.radius.md,
            color: THEME.textPrimary,
            fontSize: 13,
            fontFamily: THEME.fontSans,
            padding: "10px 14px",
          }}
          autoFocus
        />
        <button
          type="button"
          disabled={!inputValue.trim()}
          onClick={() => {
            const val = inputValue.trim();
            if (!val) return;
            setInputValue("");
            sendMessage(val);
          }}
          style={{
            background: THEME.ai,
            color: "white",
            border: "none",
            borderRadius: THEME.radius.md,
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            opacity: !inputValue.trim() ? 0.4 : 1,
          }}
        >
          <Icon name="send" size={16} color="white" />
        </button>
      </div>
    );
  }

  return (
    <>
      {keyEditorOpen && <ApiKeyEditorModal onClose={() => setKeyEditorOpen(false)} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", width: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", borderRight: `1px solid ${THEME.surface4}` }}>
          <div style={{ flexShrink: 0, padding: "16px 24px 12px", borderBottom: `1px solid ${THEME.surface4}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={handleBack} style={{ background: "none", border: "none", color: THEME.textSecondary, cursor: "pointer", fontSize: 12 }}>
                ← Back
              </button>
              <span style={{ color: THEME.textTertiary, fontSize: 10, flex: 1 }}>Folding Carton  ›  AI Design  ›  Conversation</span>
              <button
                type="button"
                onClick={() => setKeyEditorOpen(true)}
                style={{
                  background: THEME.surface3,
                  border: `1px solid ${THEME.surface4}`,
                  color: THEME.textSecondary,
                  fontSize: 10,
                  fontFamily: THEME.fontMono,
                  padding: "4px 10px",
                  borderRadius: THEME.radius.md,
                  cursor: "pointer",
                }}
              >
                API key
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ height: 3, background: THEME.surface4, borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  style={{ height: "100%", background: THEME.accent, borderRadius: 2 }}
                  animate={{ width: `${Math.min(10, progress) * 10}%` }}
                  transition={THEME.spring}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 9, color: THEME.textTertiary, fontFamily: THEME.fontMono }}>
                {progress < 10 ? "Gathering information..." : "Ready to generate options"}
              </div>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minHeight: 0,
            }}
          >
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {isStreaming && (
              <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: THEME.ai }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            )}

            {isGenerating && (
              <div
                style={{
                  padding: "16px 20px",
                  background: THEME.aiMuted,
                  border: `1px solid ${THEME.aiBorder}`,
                  borderRadius: THEME.radius.lg,
                  color: THEME.ai,
                  fontSize: 13,
                }}
              >
                <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  ✦ Generating your packaging options...
                </motion.div>
                <div style={{ marginTop: 8, fontSize: 10, color: THEME.textTertiary }}>
                  Calculating BCT, board grades, insert requirements and cost estimates
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ flexShrink: 0, borderTop: `1px solid ${THEME.surface4}`, padding: "16px 24px", background: THEME.surface2 }}>{renderInput()}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: THEME.surface1, position: "relative" }}>
          {currentRoute === "cad" ? (
            <PackformPrimaryPreview productBBox={currentProductBBox} />
          ) : (
            <RouteBIllustration />
          )}

          <div style={{ flexShrink: 0, borderTop: `1px solid ${THEME.surface4}`, padding: "10px 12px", display: "flex", alignItems: "center", background: THEME.surface2, position: "relative", zIndex: 3 }}>
            <div style={{ fontSize: 10, color: THEME.textTertiary, fontFamily: THEME.fontMono }}>ENGINEERING BAR</div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setAnalysisOpen(true)}
              style={{
                background: THEME.surface3,
                border: `1px solid ${THEME.aiBorder}`,
                color: THEME.ai,
                borderRadius: THEME.radius.md,
                padding: "7px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              FULL ANALYSIS
            </button>
          </div>

          {currentRoute === "cad" && (
            <div style={{ position: "absolute", right: 12, bottom: 58, zIndex: 4 }}>
              <button
                type="button"
                onClick={() => setAnalysisOpen(true)}
                style={{
                  background: "rgba(23,21,19,0.92)",
                  border: `1px solid ${THEME.aiBorder}`,
                  color: THEME.ai,
                  borderRadius: THEME.radius.md,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: THEME.shadow.md,
                }}
              >
                FULL ANALYSIS
              </button>
            </div>
          )}
        </div>
      </div>

      <FullAnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)} metrics={analysisMetrics} />
    </>
  );
}
