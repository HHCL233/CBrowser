import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import 'electron-chrome-extensions/preload'
import 'electron-chrome-web-store/preload'
import { injectBrowserAction } from 'electron-chrome-extensions/browser-action'
import { ExtensionsChannel, MenuChannel, TabsChannel } from '../shared/ipc'
import type { TabsState } from '../shared/types/tabs'
import type { ExtensionsState } from '../shared/types/extensions'
import type { Menu, MenuResult } from '../shared/types/menu'
import type { CbApi, MenuShowPayload } from '../shared/types/api'

/**
 * 暴露给渲染进程的受限API
 *。
 * 订阅函数统一返回取消订阅闭包,组件卸载时精确移除自己的监听
 */
const api: CbApi = {
  tabs: {
    /** 订阅主进程推送的完整快照 */
    onState(listener: (state: TabsState) => void): () => void {
      const handler = (_event: unknown, state: TabsState): void => listener(state)
      ipcRenderer.on(TabsChannel.State, handler)
      return () => {
        ipcRenderer.removeListener(TabsChannel.State, handler)
      }
    },
    /** 主动拉取一次快照 */
    get(): Promise<TabsState> {
      return ipcRenderer.invoke(TabsChannel.Get)
    },
    create(url?: string): void {
      ipcRenderer.send(TabsChannel.Create, url)
    },
    activate(tabId: string): void {
      ipcRenderer.send(TabsChannel.Activate, tabId)
    },
    close(tabId: string): void {
      ipcRenderer.send(TabsChannel.Close, tabId)
    },
    reorder(orderedIds: string[]): void {
      ipcRenderer.send(TabsChannel.Reorder, orderedIds)
    },
    navigate(tabId: string, input: string): void {
      ipcRenderer.send(TabsChannel.Navigate, tabId, input)
    },
    reload(tabId: string): void {
      ipcRenderer.send(TabsChannel.Reload, tabId)
    }
  },
  extensions: {
    onState(listener: (state: ExtensionsState) => void): () => void {
      const handler = (_event: unknown, state: ExtensionsState): void => listener(state)
      ipcRenderer.on(ExtensionsChannel.State, handler)
      return () => {
        ipcRenderer.removeListener(ExtensionsChannel.State, handler)
      }
    },
    get(): Promise<ExtensionsState> {
      return ipcRenderer.invoke(ExtensionsChannel.Get)
    }
  },
  contextMenu: {
    /**
     * 打开上下文菜单并等待结果。
     *
     * 把「打开」和「拿到结果」合并成一个 Promise,调用方不需要自己配对
     * requestId,也就不会出现结果串台。
     */
    open(items: Menu[], x: number, y: number): Promise<string | null> {
      return new Promise((resolve) => {
        void ipcRenderer
          .invoke(MenuChannel.Open, { items, x, y })
          .then((requestId: string | null) => {
            if (!requestId) {
              resolve(null)
              return
            }
            const handler = (_event: unknown, result: MenuResult): void => {
              if (result.requestId !== requestId) return
              ipcRenderer.removeListener(MenuChannel.Result, handler)
              resolve(result.itemId)
            }
            ipcRenderer.on(MenuChannel.Result, handler)
          })
          .catch(() => resolve(null))
      })
    }
  },
  /** 仅菜单窗口使用 */
  menuHost: {
    onShow(listener: (payload: MenuShowPayload) => void): () => void {
      const handler = (_event: unknown, payload: MenuShowPayload): void => listener(payload)
      ipcRenderer.on(MenuChannel.Show, handler)
      return () => {
        ipcRenderer.removeListener(MenuChannel.Show, handler)
      }
    },
    select(requestId: string, itemId: string): void {
      ipcRenderer.send(MenuChannel.Select, requestId, itemId)
    },
    dismiss(requestId: string): void {
      ipcRenderer.send(MenuChannel.Dismiss, requestId)
    }
  }
}

injectBrowserAction()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('cb', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.cb = api
}
