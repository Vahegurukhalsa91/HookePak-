import { getPaperboardGeometry } from "./paperboard.js";

/**
 * Minimal DXF — ENTITIES only; layer names CUT / CREASE / SCORE for CAM import.
 */
function dxfHeader() {
  return ["0", "SECTION", "2", "ENTITIES"].join("\r\n");
}

function dxfLine(layer, x1, y1, x2, y2) {
  const z = 0;
  return [
    "0",
    "LINE",
    "8",
    layer,
    "10",
    String(x1),
    "20",
    String(y1),
    "30",
    String(z),
    "11",
    String(x2),
    "21",
    String(y2),
    "31",
    String(z),
  ].join("\r\n");
}

function dxfFooter() {
  return ["0", "ENDSEC", "0", "EOF"].join("\r\n");
}

/**
 * @param {string} style
 * @param {number} L
 * @param {number} W
 * @param {number} H
 * @param {number} t
 */
export function genDXFPaperboard(style, L, W, H, t) {
  const geo = getPaperboardGeometry(style, L, W, H, t);
  const parts = [dxfHeader()];
  for (const [x1, y1, x2, y2] of geo.cuts || []) {
    parts.push(dxfLine("CUT", x1, y1, x2, y2));
  }
  for (const [x1, y1, x2, y2] of geo.creases || []) {
    parts.push(dxfLine("CREASE", x1, y1, x2, y2));
  }
  parts.push(dxfFooter());
  return parts.join("\r\n");
}
