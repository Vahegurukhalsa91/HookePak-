/**
 * Folding carton (paperboard) flat geometry — pure JS.
 * L = front/back panel width (mm), W = side / depth (mm), H = body height (mm), t = calliper (mm).
 */

/** @typedef {{ id: string, x: number, y: number, w: number, h: number, label: string, type: string }} Panel */
/** @typedef {{ parentId: string, childId: string, edge: 'top'|'bottom'|'left'|'right', foldSign: 1|-1 }} Hinge */

/** @type {(a: number, b: number, c: number, d: number) => [number, number, number, number]} */
function line(x1, y1, x2, y2) {
  return [x1, y1, x2, y2];
}

function pushUniqueLines(target, segments) {
  for (const s of segments) target.push(s);
}

/**
 * @param {string} style
 * @param {number} L
 * @param {number} W
 * @param {number} H
 * @param {number} [t]
 */
export function getPaperboardGeometry(style, L, W, H, t = 0.4) {
  switch (style) {
    case "reverse-tuck":
      return calcRTE(L, W, H, t);
    case "auto-bottom":
      return calcAutoBottom(L, W, H, t);
    case "sleeve":
      return calcSleeve(L, W, H, t);
    case "straight-tuck":
    default:
      return calcSTE(L, W, H, t);
  }
}

/**
 * Straight tuck end — ECMA-C12
 */
export function calcSTE(L, W, H, t) {
  const frontW = L;
  const sideW = W;
  const g = Math.max(10, Math.round(frontW * 0.1));
  const tuckH = Math.max(15, Math.round(sideW * 0.45));
  const lockH = Math.round(tuckH * 0.85);
  const dustH = Math.round(sideW * 0.48);

  const blankW = g + sideW + frontW + sideW + frontW;
  const blankH = tuckH + H + tuckH;

  const x0 = 0;
  const x1 = g;
  const x2 = g + sideW;
  const x3 = g + sideW + frontW;
  const x4 = g + sideW + frontW + sideW;
  const x5 = blankW;

  const y0 = 0;
  const y1 = tuckH;
  const y2 = tuckH + H;
  const y3 = blankH;

  /** @type {Panel[]} */
  const panels = [
    { id: "glue", x: x0, y: y0, w: g, h: blankH, label: "GLUE", type: "glue" },
    { id: "sideA", x: x1, y: y0, w: sideW, h: blankH, label: "SIDE A", type: "side" },
    { id: "front", x: x2, y: y0, w: frontW, h: blankH, label: "FRONT", type: "front" },
    { id: "sideB", x: x3, y: y0, w: sideW, h: blankH, label: "SIDE B", type: "side" },
    { id: "back", x: x4, y: y0, w: frontW, h: blankH, label: "BACK", type: "back" },
    { id: "topTuck", x: x2, y: y2, w: frontW, h: tuckH, label: "TOP TUCK", type: "tuck" },
    { id: "bottomTuck", x: x4, y: y0, w: frontW, h: tuckH, label: "BOTTOM TUCK", type: "tuck" },
    { id: "topLock", x: x4, y: y2, w: frontW, h: lockH, label: "TOP LOCK", type: "lock" },
    { id: "bottomLock", x: x2, y: y1 - lockH, w: frontW, h: lockH, label: "BOTTOM LOCK", type: "lock" },
  ];

  /** @type {[number,number,number,number][]} */
  const creases = [];
  pushUniqueLines(creases, [
    line(x1, y0, x1, y3),
    line(x2, y0, x2, y3),
    line(x3, y0, x3, y3),
    line(x4, y0, x4, y3),
    line(x1, y1, x5, y1),
    line(x1, y2, x5, y2),
    line(x2, y2, x2 + frontW, y3),
    line(x4, y0, x4 + frontW, y1),
    line(x1, y0, x1 + sideW, y1),
    line(x3, y0, x3 + sideW, y1),
    line(x1, y2, x1 + sideW, y3),
    line(x3, y2, x3 + sideW, y3),
  ]);

  /** @type {[number,number,number,number][]} */
  const cuts = [];
  pushUniqueLines(cuts, [
    line(0, y0, blankW, y0),
    line(blankW, y0, blankW, y3),
    line(blankW, y3, 0, y3),
    line(0, y3, 0, y0),
    line(x2, y0, x2, y1),
    line(x2 + frontW, y0, x2 + frontW, y1),
    line(x4, y2, x4, y3),
    line(x4 + frontW, y2, x4 + frontW, y3),
    line(x1, y1, x2, y1),
    line(x3, y1, x4, y1),
    line(x1, y2, x2, y2),
    line(x3, y2, x4, y2),
  ]);

  /** @type {Hinge[]} */
  const hinges = [
    { parentId: "blank", childId: "glue", edge: "left", foldSign: 1 },
    { parentId: "front", childId: "topTuck", edge: "top", foldSign: 1 },
    { parentId: "back", childId: "bottomTuck", edge: "bottom", foldSign: -1 },
  ];

  return {
    style: "straight-tuck",
    ecmaCode: "ECMA-C12",
    ecmaName: "Straight Tuck End",
    blankW,
    blankH,
    tuckH,
    lockH,
    dustH,
    g,
    boardCalliper: t,
    xs: [x0, x1, x2, x3, x4, x5],
    ys: [y0, y1, y2, y3],
    frontW,
    sideW,
    panels,
    creases,
    cuts,
    hinges,
  };
}

/** Reverse tuck — same blank as STE; assembly differs in 3D only */
export function calcRTE(L, W, H, t) {
  const base = calcSTE(L, W, H, t);
  return {
    ...base,
    style: "reverse-tuck",
    ecmaCode: "ECMA-C14",
    ecmaName: "Reverse Tuck End",
    hinges: [
      ...base.hinges,
      { parentId: "back", childId: "bottomTuck", edge: "bottom", foldSign: 1 },
    ],
  };
}

/** Tuck top auto bottom — ECMA-A50 (simplified crash-lock bottom) */
export function calcAutoBottom(L, W, H, t) {
  const frontW = L;
  const sideW = W;
  const g = Math.max(10, Math.round(frontW * 0.1));
  const tuckH = Math.max(15, Math.round(sideW * 0.45));
  const dustH = Math.round(sideW * 0.48);
  const autoW = Math.round(sideW * 0.9);
  const autoLockH = Math.round(tuckH * 0.85);
  const notch = Math.min(12, Math.round(autoW * 0.08));

  const blankW = g + sideW + frontW + sideW + frontW;
  const bottomFlapH = Math.max(tuckH, Math.round(sideW * 0.55));
  const blankH = tuckH + H + bottomFlapH;

  const x0 = 0;
  const x1 = g;
  const x2 = g + sideW;
  const x3 = g + sideW + frontW;
  const x4 = g + sideW + frontW + sideW;
  const x5 = blankW;

  const y0 = 0;
  const y1 = bottomFlapH;
  const y2 = bottomFlapH + H;
  const y3 = blankH;

  const panels = [
    { id: "glue", x: x0, y: y0, w: g, h: blankH, label: "GLUE", type: "glue" },
    { id: "sideA", x: x1, y: y0, w: sideW, h: blankH, label: "SIDE A", type: "side" },
    { id: "front", x: x2, y: y0, w: frontW, h: blankH, label: "FRONT", type: "front" },
    { id: "sideB", x: x3, y: y0, w: sideW, h: blankH, label: "SIDE B", type: "side" },
    { id: "back", x: x4, y: y0, w: frontW, h: blankH, label: "BACK", type: "back" },
    { id: "topTuck", x: x2, y: y2, w: frontW, h: tuckH, label: "TOP TUCK", type: "tuck" },
    { id: "autoMain", x: x2 + (frontW - autoW) / 2, y: y0, w: autoW, h: bottomFlapH, label: "AUTO MAIN", type: "flap" },
    { id: "autoLock", x: x4 + (frontW - autoW) / 2, y: y0, w: autoW, h: autoLockH, label: "AUTO LOCK", type: "lock" },
  ];

  const creases = [
    line(x1, y0, x1, y3),
    line(x2, y0, x2, y3),
    line(x3, y0, x3, y3),
    line(x4, y0, x4, y3),
    line(x1, y1, x5, y1),
    line(x1, y2, x5, y2),
    line(x2, y2, x2 + frontW, y3),
  ];

  const mx = x2 + (frontW - autoW) / 2;
  const cuts = [
    line(0, y0, blankW, y0),
    line(blankW, y0, blankW, y3),
    line(blankW, y3, 0, y3),
    line(0, y3, 0, y0),
    line(mx, y0, mx + notch, y0 + notch),
    line(mx + autoW, y0, mx + autoW - notch, y0 + notch),
    line(x1, y1, x2, y1),
    line(x3, y1, x4, y1),
  ];

  return {
    style: "auto-bottom",
    ecmaCode: "ECMA-A50",
    ecmaName: "Tuck Top Auto Bottom",
    blankW,
    blankH,
    tuckH,
    lockH: autoLockH,
    dustH,
    g,
    boardCalliper: t,
    xs: [x0, x1, x2, x3, x4, x5],
    ys: [y0, y1, y2, y3],
    frontW,
    sideW,
    panels,
    creases,
    cuts,
    hinges: [],
  };
}

/** Sleeve / wrap — ECMA-B40, open ends */
export function calcSleeve(L, W, H, t) {
  const frontW = L;
  const sideW = W;
  const g = Math.max(10, Math.round(frontW * 0.1));
  const blankW = g + sideW + frontW + sideW + frontW;
  const blankH = H;

  const x0 = 0;
  const x1 = g;
  const x2 = g + sideW;
  const x3 = g + sideW + frontW;
  const x4 = g + sideW + frontW + sideW;
  const x5 = blankW;

  const y0 = 0;
  const y1 = H;

  const panels = [
    { id: "glue", x: x0, y: y0, w: g, h: blankH, label: "GLUE", type: "glue" },
    { id: "sideA", x: x1, y: y0, w: sideW, h: blankH, label: "SIDE A", type: "side" },
    { id: "front", x: x2, y: y0, w: frontW, h: blankH, label: "FRONT", type: "front" },
    { id: "sideB", x: x3, y: y0, w: sideW, h: blankH, label: "SIDE B", type: "side" },
    { id: "back", x: x4, y: y0, w: frontW, h: blankH, label: "BACK", type: "back" },
  ];

  const creases = [line(x2, y0, x2, y1), line(x3, y0, x3, y1), line(x4, y0, x4, y1)];
  const cuts = [
    line(x1, y0, x1, y1),
    line(0, y0, blankW, y0),
    line(blankW, y0, blankW, y1),
    line(blankW, y1, 0, y1),
    line(0, y1, 0, y0),
  ];

  return {
    style: "sleeve",
    ecmaCode: "ECMA-B40",
    ecmaName: "Sleeve",
    blankW,
    blankH,
    tuckH: 0,
    lockH: 0,
    dustH: 0,
    g,
    boardCalliper: t,
    xs: [x0, x1, x2, x3, x4, x5],
    ys: [y0, y1],
    frontW,
    sideW,
    panels,
    creases,
    cuts,
    hinges: [],
  };
}

export function gsmFromBoardGrade(grade) {
  const m = String(grade || "").match(/(\d+)\s*gsm/i);
  return m ? Number(m[1]) : 350;
}
