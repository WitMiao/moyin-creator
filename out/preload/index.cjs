"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("imageStorage", {
  // Save image from URL to local storage
  saveImage: (url, category, filename) => electron.ipcRenderer.invoke("save-image", { url, category, filename }),
  // Get actual file path for a local-image:// URL
  getImagePath: (localPath) => electron.ipcRenderer.invoke("get-image-path", localPath),
  // Delete a locally stored image
  deleteImage: (localPath) => electron.ipcRenderer.invoke("delete-image", localPath),
  // Read local image as base64 (for AI API calls like video generation)
  readAsBase64: (localPath) => electron.ipcRenderer.invoke("read-image-base64", localPath),
  // Get absolute file path (for local video generation tools like FFmpeg)
  getAbsolutePath: (localPath) => electron.ipcRenderer.invoke("get-absolute-path", localPath)
});
electron.contextBridge.exposeInMainWorld("fileStorage", {
  getItem: (key) => electron.ipcRenderer.invoke("file-storage-get", key),
  setItem: (key, value) => electron.ipcRenderer.invoke("file-storage-set", key, value),
  removeItem: (key) => electron.ipcRenderer.invoke("file-storage-remove", key),
  exists: (key) => electron.ipcRenderer.invoke("file-storage-exists", key),
  listKeys: (prefix) => electron.ipcRenderer.invoke("file-storage-list", prefix),
  removeDir: (prefix) => electron.ipcRenderer.invoke("file-storage-remove-dir", prefix)
});
electron.contextBridge.exposeInMainWorld("storageManager", {
  getPaths: () => electron.ipcRenderer.invoke("storage-get-paths"),
  selectDirectory: () => electron.ipcRenderer.invoke("storage-select-directory"),
  // Unified storage operations (single base path)
  validateDataDir: (dirPath) => electron.ipcRenderer.invoke("storage-validate-data-dir", dirPath),
  moveData: (newPath) => electron.ipcRenderer.invoke("storage-move-data", newPath),
  linkData: (dirPath) => electron.ipcRenderer.invoke("storage-link-data", dirPath),
  exportData: (targetPath) => electron.ipcRenderer.invoke("storage-export-data", targetPath),
  importData: (sourcePath) => electron.ipcRenderer.invoke("storage-import-data", sourcePath),
  // Cache
  getCacheSize: () => electron.ipcRenderer.invoke("storage-get-cache-size"),
  clearCache: (options) => electron.ipcRenderer.invoke("storage-clear-cache", options),
  updateConfig: (config) => electron.ipcRenderer.invoke("storage-update-config", config)
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  saveFileDialog: (options) => electron.ipcRenderer.invoke("save-file-dialog", options)
});
