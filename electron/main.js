import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    titleBarOverlay: {
      color: "#161412",
      symbolColor: "#F2EDE6",
      height: 32,
    },
    backgroundColor: "#161412",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.once("ready-to-show", () => win.show());
  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createBounds() {
  return {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
}

function extendBounds(bounds, x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function finalizeBounds(bounds) {
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) return null;
  const x = bounds.maxX - bounds.minX;
  const y = bounds.maxY - bounds.minY;
  const z = bounds.maxZ - bounds.minZ;
  const dims = [x, y, z].map((v) => Math.max(1, Math.round(v)));
  dims.sort((a, b) => b - a);
  return { L: dims[0], W: dims[1], H: dims[2] };
}

function parseObjBBox(text) {
  const bounds = createBounds();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("v ")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const z = Number(parts[3]);
    extendBounds(bounds, x, y, z);
  }
  return finalizeBounds(bounds);
}

function parseStlBBox(buffer) {
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 512));
  const isAscii = /^\s*solid\b/i.test(text) && /facet\s+normal/i.test(buffer.toString("utf8", 0, Math.min(buffer.length, 4096)));
  const bounds = createBounds();

  if (isAscii) {
    const src = buffer.toString("utf8");
    const re = /vertex\s+([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/gi;
    let m;
    while ((m = re.exec(src)) !== null) {
      extendBounds(bounds, Number(m[1]), Number(m[2]), Number(m[3]));
    }
    return finalizeBounds(bounds);
  }

  if (buffer.length < 84) return null;
  const triCount = buffer.readUInt32LE(80);
  let off = 84;
  for (let i = 0; i < triCount; i += 1) {
    if (off + 50 > buffer.length) break;
    off += 12; // normal
    for (let v = 0; v < 3; v += 1) {
      const x = buffer.readFloatLE(off);
      const y = buffer.readFloatLE(off + 4);
      const z = buffer.readFloatLE(off + 8);
      extendBounds(bounds, x, y, z);
      off += 12;
    }
    off += 2; // attribute byte count
  }
  return finalizeBounds(bounds);
}

function parseGlbBBox(buffer) {
  if (buffer.length < 20) return null;
  if (buffer.readUInt32LE(0) !== 0x46546c67) return null; // glTF
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) return null; // JSON
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonChunkLength;
  if (jsonEnd > buffer.length) return null;
  const gltf = JSON.parse(buffer.toString("utf8", jsonStart, jsonEnd));
  const accessors = Array.isArray(gltf.accessors) ? gltf.accessors : [];
  const bounds = createBounds();
  for (const acc of accessors) {
    if (acc?.type !== "VEC3") continue;
    const min = acc.min;
    const max = acc.max;
    if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) continue;
    extendBounds(bounds, Number(min[0]), Number(min[1]), Number(min[2]));
    extendBounds(bounds, Number(max[0]), Number(max[1]), Number(max[2]));
  }
  return finalizeBounds(bounds);
}

function parseStepBBox(text) {
  if (!text || typeof text !== "string") return null;
  const bounds = createBounds();
  const re = /CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*,\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*,\s*([+-]?\d*\.?\d+(?:E[+-]?\d+)?)\s*\)\s*\)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    extendBounds(bounds, Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return finalizeBounds(bounds);
}

ipcMain.handle("dialog:openFile", async (_, options) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Product CAD", extensions: ["obj", "stl", "glb", "gltf", "step", "stp"] },
      { name: "All Files", extensions: ["*"] },
    ],
    ...options,
  });
  return result;
});

ipcMain.handle("dialog:saveFile", async (_, options) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: "DXF File", extensions: ["dxf"] },
      { name: "PDF File", extensions: ["pdf"] },
      { name: "JSON", extensions: ["json"] },
    ],
    ...options,
  });
  return result;
});

ipcMain.handle("shell:openExternal", async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("cad:extractBBox", async (_, filePath) => {
  try {
    if (!filePath || typeof filePath !== "string") return { ok: false, error: "invalid path" };
    const ext = path.extname(filePath).toLowerCase();
    const buf = await fs.readFile(filePath);
    let bbox = null;
    if (ext === ".obj") {
      bbox = parseObjBBox(buf.toString("utf8"));
    } else if (ext === ".stl") {
      bbox = parseStlBBox(buf);
    } else if (ext === ".glb") {
      bbox = parseGlbBBox(buf);
    } else if (ext === ".step" || ext === ".stp") {
      bbox = parseStepBBox(buf.toString("utf8"));
    }
    if (!bbox) {
      return { ok: false, error: `unsupported-or-unparsed:${ext}` };
    }
    return { ok: true, bbox };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

