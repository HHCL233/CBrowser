import { app, BrowserWindow, ipcMain, protocol, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { installChromeWebStore } from 'electron-chrome-web-store'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import type { TabsState } from '../shared/types/tabs'
import type { ExtensionsState } from '../shared/types/extensions'
import type { MenuRequest } from '../shared/types/menu'
import { ExtensionsChannel, MenuChannel, TabsChannel } from '../shared/ipc'
import { privilegedSchemes, registerCbProtocol } from './protocol'
import { createWindow, getMainWindow } from './window'
import {
  activateTab,
  closeTab,
  createTab,
  destroyAllTabs,
  getTabIdByWebContents,
  getTabs,
  getTabsSnapshot,
  initTabs,
  navigateTab,
  publishTabs,
  reloadTab,
  reorderTabs
} from './tabs'
import { abandonMenuFor, closeMenu, initMenu, openMenu } from './menu'
import { getExtensionsSnapshot, initExtensionsState } from './extensions'
// import { googleOAuth } from './oauth'

app.commandLine.appendSwitch('enable-gpu-rasterization')
protocol.registerSchemesAsPrivileged(privilegedSchemes)

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.cb')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerCbProtocol()

  const mainWindow = createWindow()

  // shell 渲染进程重载(HMR、F5、崩溃恢复)后本地状态被清空,
  // 这里在它加载完成时主动重推一次,让两侧重新对齐
  mainWindow.webContents.on('did-finish-load', () => {
    publishTabs()
  })

  mainWindow.on('close', () => {
    destroyAllTabs()
  })

  const extensions = new ElectronChromeExtensions({
    license: 'GPL-3.0',
    session: session.defaultSession,
    // 让扩展的chrome.tabs.create走标签页系统
    createTab: async (details) => {
      const record = createTab(details.url ?? undefined, details.active !== false)
      if (!record) throw new Error('无法创建标签页')
      return [record.view.webContents, getMainWindow()]
    },
    selectTab: (tab) => {
      const id = getTabIdByWebContents(tab)
      if (id) activateTab(id)
    },
    removeTab: (tab) => {
      const id = getTabIdByWebContents(tab)
      if (id) closeTab(id)
    }
  })

  initTabs(extensions)
  await installChromeWebStore({ session: session.defaultSession })
  initExtensionsState()
  await initMenu()
  createTab()
  // await googleOAuth()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 标签页 IPC

// 只读拉取
// 渲染进程首帧或重载后补齐快照
ipcMain.handle(TabsChannel.Get, (): TabsState => getTabsSnapshot())

ipcMain.on(TabsChannel.Create, (_event, url?: string) => {
  createTab(typeof url === 'string' ? url : undefined)
})

ipcMain.on(TabsChannel.Activate, (_event, tabId: unknown) => {
  if (typeof tabId === 'string') activateTab(tabId)
})

ipcMain.on(TabsChannel.Close, (_event, tabId: unknown) => {
  const tabs = getTabs()
  const mainWindow = getMainWindow()
  if (tabs.length > 1) {
    if (typeof tabId === 'string') closeTab(tabId)
  } else {
    mainWindow.close()
  }
})

ipcMain.on(TabsChannel.Reorder, (_event, orderedIds: unknown) => {
  if (Array.isArray(orderedIds) && orderedIds.every((id) => typeof id === 'string')) {
    reorderTabs(orderedIds as string[])
  }
})

ipcMain.on(TabsChannel.Navigate, (_event, tabId: unknown, input: unknown) => {
  if (typeof tabId === 'string' && typeof input === 'string') {
    navigateTab(tabId, input)
  }
})

ipcMain.on(TabsChannel.Reload, (_event, tabId: unknown) => {
  if (typeof tabId === 'string') reloadTab(tabId)
})

// 扩展IPC(只读)

ipcMain.handle(ExtensionsChannel.Get, (): ExtensionsState => getExtensionsSnapshot())

// 上下文菜单IPC

ipcMain.handle(
  MenuChannel.Open,
  async (event, payload: Omit<MenuRequest, 'requestId'>): Promise<string | null> => {
    const { items, x, y } = payload
    if (!Array.isArray(items)) return null
    return openMenu(event.sender, items, Number(x) || 0, Number(y) || 0)
  }
)

ipcMain.on(MenuChannel.Select, (_event, requestId: unknown, itemId: unknown) => {
  if (typeof requestId === 'string' && typeof itemId === 'string') {
    closeMenu(requestId, itemId)
  }
})

ipcMain.on(MenuChannel.Dismiss, (_event, requestId: unknown) => {
  if (typeof requestId === 'string') closeMenu(requestId, null)
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('destroyed', () => {
    abandonMenuFor(contents)
  })
})
