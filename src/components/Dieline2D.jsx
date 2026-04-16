import { useMemo, forwardRef } from "react";
import { THEME } from "../theme";
import { getPaperboardGeometry } from "../packform/paperboard";

const PAD = 20;

/**
 * @typedef {{ id: string, type: string, panelId: string, xPct?: number, yMm?: number, slotW?: number, slotH?: number, recess?: number, radius?: number, winW?: number, winH?: number }} Feature
 */

export const Dieline2D = forwardRef(function Dieline2D(
  { style, L, W, H, boardThickness = 0.4, selectedPanel, onPanelClick, placedFeatures = [], showGuides = true },
  ref
) {
  const geo = useMemo(() => getPaperboardGeometry(style, Number(L) || 100, Number(W) || 80, Number(H) || 100, Number(boardThickness) || 0.4), [style, L, W, H, boardThickness]);

  const { vbW, vbH } = useMemo(() => {
    const bw = Math.max(geo.blankW, 1);
    const bh = Math.max(geo.blankH, 1);
    return { vbW: bw + PAD * 2, vbH: bh + PAD * 2 };
  }, [geo.blankW, geo.blankH]);

  const toSvgX = (x) => x + PAD;
  const toSvgY = (y) => vbH - (y + PAD);

  const fontSize = Math.min(9, Math.max(6, geo.frontW * 0.02));

  return (
    <svg
      ref={ref}
      width="100%"
      height="100%"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", maxHeight: "100%" }}
    >
      <defs>
        <marker id="arrowA" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={THEME.accent} />
        </marker>
        <marker id="arrowG" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#3D9970" />
        </marker>
        <marker id="arrowB" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#5B8DEF" />
        </marker>
      </defs>

      <g transform={`translate(0,0)`}>
        {geo.panels.map((p) => {
          const sel = selectedPanel === p.id;
          const fill = p.type === "glue" ? "rgba(200,200,200,0.15)" : sel ? "rgba(232,168,56,0.12)" : p.type === "flap" ? "rgba(168,232,168,0.10)" : "#FFFFFF";
          return (
            <g key={p.id}>
              <rect
                x={toSvgX(p.x)}
                y={toSvgY(p.y + p.h)}
                width={p.w}
                height={p.h}
                fill={fill}
                stroke="transparent"
                style={{ cursor: onPanelClick ? "pointer" : "default" }}
                onClick={() => onPanelClick?.(p.id)}
                onMouseEnter={(e) => {
                  if (!sel && onPanelClick) e.currentTarget.setAttribute("fill", "rgba(232,168,56,0.07)");
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.setAttribute("fill", fill);
                }}
              />
              <text
                x={toSvgX(p.x + p.w / 2)}
                y={toSvgY(p.y + p.h / 2)}
                dominantBaseline="middle"
                textAnchor="middle"
                fill={THEME.textTertiary}
                fontFamily={THEME.fontMono}
                fontSize={fontSize}
              >
                {p.label}
              </text>
              <text
                x={toSvgX(p.x + p.w / 2)}
                y={toSvgY(p.y + p.h / 2 - 12)}
                dominantBaseline="middle"
                textAnchor="middle"
                fill={THEME.textTertiary}
                fontFamily={THEME.fontMono}
                fontSize={Math.max(6, fontSize - 2)}
              >
                {`(${Math.round(p.w)} × ${Math.round(p.h)} mm)`}
              </text>
            </g>
          );
        })}

        {(geo.creases || []).map((seg, i) => (
          <line
            key={`c-${i}`}
            x1={toSvgX(seg[0])}
            y1={toSvgY(seg[1])}
            x2={toSvgX(seg[2])}
            y2={toSvgY(seg[3])}
            stroke="#3366FF"
            strokeWidth={1}
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
        ))}

        {(geo.cuts || []).map((seg, i) => (
          <line
            key={`k-${i}`}
            x1={toSvgX(seg[0])}
            y1={toSvgY(seg[1])}
            x2={toSvgX(seg[2])}
            y2={toSvgY(seg[3])}
            stroke="#FF3333"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}

        {showGuides && (
          <g pointerEvents="none">
            <line
              x1={toSvgX(-8)}
              y1={toSvgY(geo.blankH + 14)}
              x2={toSvgX(geo.blankW + 8)}
              y2={toSvgY(geo.blankH + 14)}
              stroke={THEME.accent}
              strokeWidth={1}
              markerEnd="url(#arrowA)"
            />
            <text x={toSvgX(geo.blankW / 2)} y={toSvgY(geo.blankH + 28)} textAnchor="middle" fill={THEME.accent} fontSize={8} fontFamily={THEME.fontMono}>
              L {Math.round(L)} mm
            </text>
            <line
              x1={toSvgX(geo.blankW + 14)}
              y1={toSvgY(-8)}
              x2={toSvgX(geo.blankW + 14)}
              y2={toSvgY(geo.blankH + 8)}
              stroke="#3D9970"
              strokeWidth={1}
              markerEnd="url(#arrowG)"
            />
            <text x={toSvgX(geo.blankW + 22)} y={toSvgY(geo.blankH / 2)} fill="#3D9970" fontSize={8} fontFamily={THEME.fontMono}>
              W {Math.round(W)}
            </text>
            <line
              x1={toSvgX(-14)}
              y1={toSvgY(geo.blankH / 2)}
              x2={toSvgX(-4)}
              y2={toSvgY(geo.blankH / 2)}
              stroke="#5B8DEF"
              strokeWidth={1}
              markerEnd="url(#arrowB)"
            />
            <text x={toSvgX(-22)} y={toSvgY(geo.blankH / 2)} textAnchor="end" fill="#5B8DEF" fontSize={8} fontFamily={THEME.fontMono}>
              H {Math.round(H)}
            </text>
          </g>
        )}

        {placedFeatures.map((f) => {
          const pan = geo.panels.find((p) => p.id === f.panelId);
          if (!pan) return null;
          const px = pan.x + ((f.xPct ?? 50) / 100) * pan.w;
          const py = pan.y + (f.yMm ?? 12);
          const sx = toSvgX(px);
          const sy = toSvgY(py);
          if (f.type === "hang-hole") {
            const sw = f.slotW ?? 32;
            const sh = f.slotH ?? 7;
            return (
              <g key={f.id} pointerEvents="none">
                <rect x={sx - sw / 2} y={sy - sh / 2} width={sw} height={sh} fill="none" stroke="#FF3333" strokeWidth={1} />
              </g>
            );
          }
          if (f.type === "window") {
            const ww = f.winW ?? 40;
            const wh = f.winH ?? 30;
            return (
              <g key={f.id} pointerEvents="none">
                <rect x={sx - ww / 2} y={sy - wh / 2} width={ww} height={wh} fill="rgba(0,0,0,0.08)" stroke="#3366FF" strokeDasharray="3 2" />
              </g>
            );
          }
          if (f.type === "thumb-cut") {
            const r = f.radius ?? 12;
            return (
              <path
                key={f.id}
                pointerEvents="none"
                d={`M ${sx - r} ${sy} A ${r} ${r} 0 0 1 ${sx + r} ${sy}`}
                fill="none"
                stroke="#FF3333"
              />
            );
          }
          if (f.type === "perforation") {
            return (
              <line key={f.id} x1={toSvgX(pan.x)} y1={sy} x2={toSvgX(pan.x + pan.w)} y2={sy} stroke="#3366FF" strokeDasharray="2 3" />
            );
          }
          return null;
        })}
      </g>
    </svg>
  );
});
