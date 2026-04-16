import * as THREE from "three";
import { getPaperboardGeometry } from "./packform/paperboard";

const SC = 0.005;

const PAPERBOARD_STYLES = new Set(["straight-tuck", "reverse-tuck", "auto-bottom", "sleeve"]);

export function parseArrangement(arrangement = "1x1x1") {
  const parts = arrangement
    .replace(/×/g, "x")
    .toLowerCase()
    .split("x")
    .map((n) => Math.max(1, Number(String(n).trim()) || 1));
  return { cols: parts[0] || 1, rows: parts[1] || 1, layers: parts[2] || 1 };
}

export function buildInsertInScene(group, cartonData = {}) {
  if (!group) return null;
  const existing = group.getObjectByName("insert");
  if (existing) group.remove(existing);
  const insertType = cartonData.insertType || null;
  if (!cartonData.insertRequired || !insertType || insertType === "none") return null;

  const L = Number(cartonData.L || 300);
  const W = Number(cartonData.W || 220);
  const H = Number(cartonData.H || 180);
  const bT = Number(cartonData.boardThickness || cartonData.boardCalliper || 0.6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xDDB870, roughness: 0.9 });
  const insert = new THREE.Group();
  insert.name = "insert";

  const mk = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  if (insertType === "cell divider") {
    const { cols, rows } = parseArrangement(cartonData.arrangement || "1x1x1");
    for (let i = 1; i < rows; i += 1) {
      const m = mk(L * SC, H * 0.85 * SC, bT * SC);
      m.position.set(0, -H * 0.075 * SC, (-W / 2 + (W / rows) * i) * SC);
      insert.add(m);
    }
    for (let j = 1; j < cols; j += 1) {
      const m = mk(bT * SC, H * 0.85 * SC, W * SC);
      m.position.set((-L / 2 + (L / cols) * j) * SC, -H * 0.075 * SC, 0);
      insert.add(m);
    }
  } else if (insertType === "wrap insert") {
    const base = mk(L * SC, bT * SC, W * SC);
    base.position.y = -H * 0.5 * SC + bT * SC;
    insert.add(base);
    const left = mk(L * SC, H * 0.4 * SC, bT * SC);
    left.position.set(0, -H * 0.3 * SC, -W * 0.45 * SC);
    left.rotation.x = Math.PI / 6;
    insert.add(left);
    const right = mk(L * SC, H * 0.4 * SC, bT * SC);
    right.position.set(0, -H * 0.3 * SC, W * 0.45 * SC);
    right.rotation.x = -Math.PI / 6;
    insert.add(right);
  } else if (insertType === "display tray") {
    const plate = mk(L * 0.8 * SC, bT * SC, W * 0.8 * SC);
    plate.position.y = -H * 0.38 * SC;
    insert.add(plate);
    const back = mk(L * 0.8 * SC, H * 0.22 * SC, bT * SC);
    back.position.set(0, -H * 0.27 * SC, -W * 0.4 * SC);
    insert.add(back);
    const sideL = mk(bT * SC, H * 0.16 * SC, W * 0.8 * SC);
    sideL.position.set(-L * 0.4 * SC, -H * 0.31 * SC, 0);
    insert.add(sideL);
    const sideR = mk(bT * SC, H * 0.16 * SC, W * 0.8 * SC);
    sideR.position.set(L * 0.4 * SC, -H * 0.31 * SC, 0);
    insert.add(sideR);
  }

  group.add(insert);
  return insert;
}

function matPaper(c) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, metalness: 0.02 });
}

/**
 * Paperboard folding carton — hinge pivots at creases, no corner overlap, fold 0 = open/flat → 1 = erected.
 * @param {THREE.Group} group
 * @param {object} cartonData
 * @param {number} fold01 0 = open (blank-style) → 1 = closed erected carton
 */
export function buildPaperboardInScene(group, cartonData = {}, fold01 = 0) {
  if (!group) return;
  while (group.children.length) group.remove(group.children[0]);

  const Lmm = Number(cartonData.L || 200);
  const Wmm = Number(cartonData.W || 200);
  const Hmm = Number(cartonData.H || 200);
  const L = Lmm * SC;
  const Wm = Wmm * SC;
  const Hm = Hmm * SC;
  const t = Math.max(0.15, Number(cartonData.boardCalliper || cartonData.boardThickness || 0.4)) * SC;
  const style = cartonData.style || "straight-tuck";
  /** 0 = sides swung out (flat cross-section), 1 = closed tube */
  const f = Math.max(0, Math.min(1, Number(fold01)));

  // For near-closed states, render a clean assembled carton shell.
  // This avoids hinge artifacts that can look like floating wall fragments.
  if (f >= 0.94) {
    const shell = new THREE.Group();
    shell.name = "paperboard-shell";
    const outerMat = new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.66, metalness: 0.01 });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.74, metalness: 0.01, side: THREE.BackSide });
    const outer = new THREE.Mesh(new THREE.BoxGeometry(L, Hm, Wm), outerMat);
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(2 * SC, L - 2 * t), Math.max(2 * SC, Hm - 2 * t), Math.max(2 * SC, Wm - 2 * t)),
      innerMat
    );
    outer.castShadow = true;
    outer.receiveShadow = true;
    inner.castShadow = false;
    inner.receiveShadow = true;
    shell.add(outer, inner);
    group.add(shell);
    return;
  }

  const geo = getPaperboardGeometry(style, Lmm, Wmm, Hmm, Number(cartonData.boardCalliper || cartonData.boardThickness || 0.4));
  const tuckHmm = Math.max(15, geo.tuckH || Math.round(Wmm * 0.45));
  const tuckH = tuckHmm * SC;
  const glueW = Math.max(10 * SC, L * 0.1);

  const root = new THREE.Group();
  root.name = "paperboardRoot";

  const frontM = matPaper(0xf0ede6);
  const sideM = matPaper(0xeae5dc);
  const flapM = matPaper(0xe4ddd0);
  const glueM = matPaper(0xd8d0c4);

  const sideDepthZ = Math.max(2 * SC, Wm - 2 * t);

  const front = new THREE.Mesh(new THREE.BoxGeometry(L, Hm, t), frontM);
  front.name = "panel-front";
  front.position.set(0, 0, Wm / 2 + t / 2);

  const back = new THREE.Mesh(new THREE.BoxGeometry(L, Hm, t), frontM);
  back.name = "panel-back";
  back.position.set(0, 0, -Wm / 2 - t / 2);

  const leftMesh = new THREE.Mesh(new THREE.BoxGeometry(t, Hm, sideDepthZ), sideM);
  leftMesh.name = "panel-left-mesh";
  leftMesh.position.set(-t / 2, 0, 0);

  const leftHinge = new THREE.Group();
  leftHinge.name = "hinge-left";
  leftHinge.position.set(-L / 2, 0, 0);
  const openAmt = 1 - f;
  leftHinge.rotation.y = -openAmt * (Math.PI / 2);
  leftHinge.add(leftMesh);

  const rightMesh = new THREE.Mesh(new THREE.BoxGeometry(t, Hm, sideDepthZ), sideM);
  rightMesh.name = "panel-right-mesh";
  rightMesh.position.set(t / 2, 0, 0);

  const rightHinge = new THREE.Group();
  rightHinge.name = "hinge-right";
  rightHinge.position.set(L / 2, 0, 0);
  rightHinge.rotation.y = openAmt * (Math.PI / 2);
  rightHinge.add(rightMesh);

  const glueMesh = new THREE.Mesh(new THREE.BoxGeometry(glueW, Hm, t), glueM);
  glueMesh.name = "glue-mesh";
  glueMesh.position.set(-glueW / 2, 0, 0);

  const glueHinge = new THREE.Group();
  glueHinge.name = "hinge-glue";
  glueHinge.position.set(-t, 0, 0);
  glueHinge.rotation.y = -openAmt * (Math.PI / 2) * 0.2;
  glueHinge.add(glueMesh);
  if (f < 0.75) {
    leftHinge.add(glueHinge);
  }

  root.add(front, back, leftHinge, rightHinge);

  if (style === "sleeve") {
    group.add(root);
    return;
  }

  const tuckW = Math.min(L * 0.96, L - 2 * t);
  const topFlap = new THREE.Mesh(new THREE.BoxGeometry(tuckW, tuckH, t), flapM);
  topFlap.name = "tuck-top-mesh";
  topFlap.position.set(0, tuckH / 2, 0);

  const topHinge = new THREE.Group();
  topHinge.name = "hinge-top-tuck";
  topHinge.position.set(0, Hm / 2, Wm / 2 + t / 2);
  topHinge.rotation.x = -f * (Math.PI / 2);
  topHinge.add(topFlap);

  const bottomFlap = new THREE.Mesh(new THREE.BoxGeometry(tuckW, tuckH, t), flapM);
  bottomFlap.name = "tuck-bottom-mesh";
  bottomFlap.position.set(0, -tuckH / 2, 0);

  const bottomHinge = new THREE.Group();
  bottomHinge.name = "hinge-bottom-tuck";
  bottomHinge.position.set(0, -Hm / 2, -Wm / 2 - t / 2);
  const bottomSign = style === "reverse-tuck" ? 1 : -1;
  bottomHinge.rotation.x = bottomSign * f * (Math.PI / 2);
  bottomHinge.add(bottomFlap);

  root.add(topHinge);

  if (style === "auto-bottom") {
    const bottomFlapHmm = geo.ys && geo.ys.length > 1 ? geo.ys[1] - geo.ys[0] : Wmm * 0.55;
    const autoFlapH = Math.max(tuckHmm * SC, bottomFlapHmm * SC);
    const autoH = new THREE.Mesh(new THREE.BoxGeometry(L * 0.88, autoFlapH * 0.9, t), flapM);
    autoH.name = "auto-bottom-main";
    autoH.position.set(0, autoFlapH * 0.45, 0);
    const autoHinge = new THREE.Group();
    autoHinge.name = "hinge-auto-bottom";
    autoHinge.position.set(0, -Hm / 2, Wm / 2 + t / 2);
    autoHinge.rotation.x = f * (Math.PI / 2) * 0.82;
    autoHinge.add(autoH);
    root.add(autoHinge);
  } else {
    root.add(bottomHinge);
  }

  group.add(root);
}

export function isPaperboardStyle(style) {
  return PAPERBOARD_STYLES.has(String(style || ""));
}

/**
 * Pack stage: open transit carton (wireframe kraft) with primary units inside.
 * @param {object} primary  designState.primary
 * @param {object} transit designState.transitCarton { L,W,H, cols, rows, layers }
 */
export function buildPackTransitPreview(group, primary = {}, transit = {}) {
  const Lp = Number(primary.L || 100) * SC;
  const Wp = Number(primary.W || 80) * SC;
  const Hp = Number(primary.H || 100) * SC;

  const tL = Number(transit.L || 400) * SC;
  const tW = Number(transit.W || 300) * SC;
  const tH = Number(transit.H || 250) * SC;

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(tL, tH, tW)), new THREE.LineBasicMaterial({ color: 0xcc9f58 }));
  edges.position.set(0, 0, 0);
  group.add(edges);

  const ghost = new THREE.Mesh(new THREE.BoxGeometry(tL * 0.998, tH * 0.998, tW * 0.998), new THREE.MeshBasicMaterial({ color: 0xcc9f58, transparent: true, opacity: 0.08, depthWrite: false }));
  group.add(ghost);

  const cream = new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.72 });
  const cols = Math.max(1, Number(transit.cols) || 2);
  const rows = Math.max(1, Number(transit.rows) || 2);
  const layers = Math.max(1, Number(transit.layers) || 1);
  const revealMax = Math.max(0, Number(transit.revealCount) || cols * rows * layers);

  let idx = 0;
  outer: for (let lz = 0; lz < layers; lz++) {
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        idx += 1;
        if (idx > revealMax) break outer;
        const unit = new THREE.Mesh(new THREE.BoxGeometry(Lp * 0.88, Hp * 0.88, Wp * 0.88), cream);
        const ox = ((cx + 0.5) / cols - 0.5) * tL * 0.82;
        const oy = ((lz + 0.5) / layers - 0.5) * tH * 0.82;
        const oz = ((ry + 0.5) / rows - 0.5) * tW * 0.82;
        unit.position.set(ox, oy, oz);
        unit.castShadow = true;
        group.add(unit);
      }
    }
  }
}
