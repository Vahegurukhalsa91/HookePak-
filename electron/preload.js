import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hookepak", {
  openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
  saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  extractCadBBox: (filePath) => ipcRenderer.invoke("cad:extractBBox", filePath),
  platform: process.platform,
  version: process.env.npm_package_version || "0.1.0",
});

