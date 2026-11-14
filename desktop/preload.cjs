const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("dayline", {
  focusSnapshot: () => ipcRenderer.invoke("dayline:focus-snapshot"),
  focusAction: (action, options) =>
    ipcRenderer.invoke("dayline:focus-action", action, options),
  theme: (id) => ipcRenderer.invoke("dayline:theme", id),
  locale: (language) => ipcRenderer.invoke("dayline:locale", language),
  windowVisible: () => ipcRenderer.invoke("dayline:window-visible"),
  onWindowVisibility: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on("dayline:window-visibility", listener);
    return () =>
      ipcRenderer.removeListener("dayline:window-visibility", listener);
  },
  snapshot: (date, revision) =>
    ipcRenderer.invoke("dayline:snapshot", date, revision),
  pause: (paused) => ipcRenderer.invoke("dayline:pause", paused),
  category: (id, category) =>
    ipcRenderer.invoke("dayline:category", id, category),
  allocation: (id, values) =>
    ipcRenderer.invoke("dayline:allocation", id, values),
  saveType: (definition) => ipcRenderer.invoke("dayline:type", definition),
  removeType: (id) => ipcRenderer.invoke("dayline:remove-type", id),
  siteCategory: (domain, type) => ipcRenderer.invoke("dayline:site-category", domain, type),
  hideApp: (id, hidden) => ipcRenderer.invoke("dayline:hide-app", id, hidden),
  icon: (id, reset = false) => ipcRenderer.invoke("dayline:icon", id, reset),
  entry: (date, entry) => ipcRenderer.invoke("dayline:entry", date, entry),
  settings: (settings) => ipcRenderer.invoke("dayline:settings", settings),
  exportData: () => ipcRenderer.invoke("dayline:export"),
  importData: () => ipcRenderer.invoke("dayline:import"),
  openFolder: () => ipcRenderer.invoke("dayline:folder"),
  onChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("dayline:changed", listener);
    return () => ipcRenderer.removeListener("dayline:changed", listener);
  },
});
