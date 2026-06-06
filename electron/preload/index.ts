import { ipcRenderer, contextBridge, webUtils } from 'electron'

// 保存 on/off 的 wrapper 映射，确保 off 能正确移除监听
// WeakMap<原始listener, wrapper函数>
const listenerMap = new WeakMap<Function, Function>();

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    const wrapper = (event: Electron.IpcRendererEvent, ...a: unknown[]) => listener(event, ...a)
    listenerMap.set(listener, wrapper);
    return ipcRenderer.on(channel, wrapper)
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, listener] = args
    const wrapper = listenerMap.get(listener);
    if (wrapper) {
      ipcRenderer.off(channel, wrapper as (...args: any[]) => void);
      listenerMap.delete(listener);
    }
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  getFilePath(file: any) {
    return webUtils.getPathForFile(file);
  }

  // You can expose other APTs you need here.
  // ...
})
