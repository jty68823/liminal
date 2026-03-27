/**
 * Preload script — exposes safe APIs to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('liminal', {
  platform: process.platform,
  isDesktop: true,

  // File dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', content, defaultName),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
});
