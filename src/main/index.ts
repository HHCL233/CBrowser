import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  WebContentsView,
  session,
  Extension,
  IpcMainEvent
} from 'electron'
import { join, normalize, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { installChromeWebStore } from 'electron-chrome-web-store'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { buildChromeContextMenu } from 'electron-chrome-context-menu'
import icon from '../../resources/icon.png?asset'
import type { TabsState, Tab } from '../shared/types/tabs'
import type { Menu } from '../shared/types/menu'

app.commandLine.appendSwitch('enable-gpu-rasterization')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cb-chrome',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
])

let extensions: ElectronChromeExtensions | null = null
let mainWindow: BrowserWindow | null = null
let tabsState: TabsState = {
  tabs: [],
  sortTabs: [],
  currentTabId: 'tab-1',
  loadingTabId: []
}
let allExtensions: Extension[] = []

function createWindow(): BrowserWindow {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/shell/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/shell/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error('MainWindow has not been initialized yet!')
  }
  return mainWindow
}

const webviews = new Map<string, WebContentsView>()
const menuWebviews = new Set<WebContentsView>()

const updateLayout = (): void => {
  const mainWindow = getMainWindow()
  const size = mainWindow.getContentSize()
  for (const webView of webviews.values()) {
    webView.setBounds({ x: 0, y: 44, width: size[0], height: size[1] - 44 })
  }
  for (const webView of menuWebviews) {
    webView.setBounds({ x: 0, y: 0, width: size[0], height: size[1] })
  }
}

/**
 * 开发模式下向 Vite 开发服务器取资源。
 *
 * 一旦defaultSession里加载了带webRequest/declarativeNetRequest权限的扩展，
 * net.fetch 发起的 http(s)请求会让主进程直接崩溃整个应用闪退）
 * 详见 https://github.com/electron/electron/pull/45050
 */
const devFetch = (targetUrl: string): Promise<Response> => globalThis.fetch(targetUrl)

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.cb')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  protocol.handle('cb-chrome', (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const pageName = url.hostname
    const subPath = url.pathname

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const devBase = process.env['ELECTRON_RENDERER_URL']

      // 处理Vite开发服务器的内部特殊路径
      if (
        subPath.startsWith('/@fs/') ||
        subPath.startsWith('/@id/') ||
        subPath.startsWith('/@vite/') ||
        subPath.startsWith('/node_modules/')
      ) {
        const viteInternalUrl = `${devBase}${subPath}${url.search}`
        return devFetch(viteInternalUrl)
      }

      // 请求HTML页面本体
      if (subPath === '/' || !extname(subPath)) {
        return devFetch(`${devBase}/${pageName}/index.html`)
      }

      // 请求常规业务静态资源
      let cleanSubPath = subPath
      if (cleanSubPath.startsWith(`/${pageName}`)) {
        cleanSubPath = cleanSubPath.replace(`/${pageName}`, '')
      }

      const devResourceUrl = `${devBase}/${pageName}${cleanSubPath}${url.search}`
      return devFetch(devResourceUrl)
    }

    let relativePath = normalize(`${pageName}${subPath}`)
    if (subPath === '/' || !extname(subPath)) {
      relativePath = join(pageName, 'index.html')
    }

    const absolutePath = join(__dirname, '../renderer', relativePath)
    return net.fetch(pathToFileURL(absolutePath).toString())
  })

  mainWindow.on('resize', () => {
    updateLayout()
  })

  // cb-chrome://settings
  extensions = new ElectronChromeExtensions({ license: 'GPL-3.0' })
  await installChromeWebStore({ session: session.defaultSession })
  await initMenu()
  await newPage()
})

const addTopMenu = (): void => {
  const mainWindow = getMainWindow()
  for (const menuView of menuWebviews) {
    mainWindow.contentView.addChildView(menuView)
  }
}

const switchPage = (tabId: string): void => {
  const mainWindow = getMainWindow()
  const oldView = webviews.get(tabsState.currentTabId)
  const newView = webviews.get(tabId)
  if (!oldView || !newView) return

  mainWindow.contentView.removeChildView(oldView)
  mainWindow.contentView.addChildView(newView)
  tabsState.currentTabId = tabId
  updateTabsState()
}

const findTab = (tabId: string): (Tab | void)[] => {
  const sortTabData = tabsState.sortTabs.find((tab) => tab.id == tabId)
  const tabData = tabsState.tabs.find((tab) => tab.id == tabId)
  return [sortTabData, tabData]
}

const syncPageData = async (tabData: Tab, tabView: WebContentsView): Promise<void> => {
  await tabView.webContents.loadURL(tabData.url)
}

const initMenu = async (): Promise<WebContentsView | void> => {
  const mainWindow = getMainWindow()

  const menuView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  await menuView.webContents.loadURL('cb-chrome://menu')
  menuWebviews.add(menuView)
  mainWindow.contentView.addChildView(menuView)
  menuView.webContents.openDevTools()

  // 设置背景颜色为黑色
  // 由于解析问题,需把Alpha写在最前
  menuView.setBackgroundColor('#00ffffff')
  menuView.setVisible(false)

  updateTabsState()
  updateLayout()
}

const newPage = async (url?: string, title?: string): Promise<WebContentsView | void> => {
  if (!extensions) return

  const browserSession = session.defaultSession
  const mainWindow = getMainWindow()
  const tabId = `tab-${tabsState.tabs.length + 1}`
  const tabData = {
    id: tabId,
    url: url ?? 'https://www.bing.com',
    title: title ?? '',
    icon: ''
  }

  const tabView = new WebContentsView({
    webPreferences: {
      session: browserSession
    }
  })
  extensions.addTab(tabView.webContents, mainWindow)
  tabsState.tabs.push(structuredClone(tabData))
  tabsState.sortTabs.push(structuredClone(tabData))
  tabView.webContents.setUserAgent(
    `${browserSession.getUserAgent().replace(/Electron\/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\b/g, '')}`
  )
  // 设置事件回调
  tabView.webContents.setWindowOpenHandler(({ url, frameName }) => {
    console.log('网站尝试打开新页面:', url)
    ;(async () => {
      await newPage(url, frameName)
      updateTabsState()
    })()
    return { action: 'deny' }
  })
  tabView.webContents.on('page-title-updated', (event, title) => {
    event.preventDefault()
    console.log('网页标题更新为:', title)
    const [sortTabData, tabData] = findTab(tabId)
    if (!tabData || !sortTabData) return
    sortTabData.title = title
    tabData.title = title
    updateTabsState()
  })
  tabView.webContents.on('page-favicon-updated', (event, favicons) => {
    event.preventDefault()
    console.log('网页图标更新为:', favicons)
    const [sortTabData, tabData] = findTab(tabId)
    if (!tabData || !sortTabData) return
    sortTabData.icon = favicons[0]
    tabData.icon = favicons[0]
    updateTabsState()
  })
  tabView.webContents.on('will-navigate', (_event, url, _, isMainFrame) => {
    if (!isMainFrame) return
    console.log('网页链接更新为:', url)
    const [sortTabData, tabData] = findTab(tabId)
    if (!tabData || !sortTabData) return
    sortTabData.url = url
    tabData.url = url
    updateTabsState()
  })
  tabView.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame) return
    console.log('网页链接更新为:', url)
    const [sortTabData, tabData] = findTab(tabId)
    if (!tabData || !sortTabData) return
    sortTabData.url = url
    tabData.url = url
    updateTabsState()
  })
  tabView.webContents.on('did-navigate', (_event, url) => {
    console.log('网页链接更新为:', url)
    const [sortTabData, tabData] = findTab(tabId)
    if (!tabData || !sortTabData) return
    sortTabData.url = url
    tabData.url = url
    updateTabsState()
  })
  tabView.webContents.on('did-start-loading', () => {
    console.log('网页开始加载')
    tabsState.loadingTabId.push(tabId)
    updateTabsState()
  })
  tabView.webContents.on('did-stop-loading', () => {
    console.log('网页停止加载')
    tabsState.loadingTabId = tabsState.loadingTabId.filter((loadingTab) => tabId !== loadingTab)
    updateTabsState()
  })
  tabView.webContents.on('context-menu', (e, params) => {
    const menu = buildChromeContextMenu({
      params,
      webContents: tabView.webContents,
      openLink: (url) => {
        newPage(url)
      },
      labels: {
        undo: '撤销',
        redo: '重做',
        cut: '剪切',
        copy: '复制',
        delete: '删除',
        paste: '粘贴',
        selectAll: '全选',
        back: '返回',
        forward: '前进',
        reload: '刷新',
        inspect: '检查',
        addToDictionary: '添加至字典',
        exitFullScreen: '退出全屏模式',
        emoji: '表情符号与符号',
        openInNewTab: () => '在新标签页中打开链接',
        openInNewWindow: () => '在新窗口中打开链接',
        copyAddress: () => '复制链接地址'
      }
    })

    menu.popup()
  })

  webviews.set(tabId, tabView)

  mainWindow.contentView.addChildView(tabView)
  updateLayout()
  switchPage(tabId)
  updateTabsState()

  await syncPageData(tabData, tabView)

  return tabView
}

const updateTabsState = (): void => {
  const mainWindow = getMainWindow()
  addTopMenu()
  mainWindow.webContents.send('update-tabs')
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 对数据进行同步
ipcMain.handle('sync-tabs', (_event, action: 'get' | 'set', payload?: TabsState): TabsState => {
  if (action == 'get') {
    return tabsState
  } else {
    if (!payload) return tabsState
    tabsState = payload
    updateTabsState()
    return tabsState
  }
})

ipcMain.on('change-sort-tabs-url', (_event, tabId: string, payload: string) => {
  const [sortTabData] = findTab(tabId)
  if (!sortTabData) return
  sortTabData.url = payload
})

ipcMain.on('sync-tab', async (_event, tabId: string) => {
  const [sortTabData, tabData] = findTab(tabId)
  const tabView = webviews.get(tabId)
  if (!sortTabData || !tabData || !tabView) return
  Object.assign(tabData, sortTabData)

  await syncPageData(tabData, tabView)
  updateTabsState()
})

// 对数据进行同步
ipcMain.handle(
  'sync-extensions',
  (_event, action: 'get' | 'set', payload?: Extension[]): Extension[] => {
    if (action == 'get') {
      return allExtensions
    } else {
      if (!payload) return allExtensions
      allExtensions = payload
      updateTabsState()
      return allExtensions
    }
  }
)

// 打开上下文菜单
ipcMain.on('context-menu', async (_: IpcMainEvent, menu: Menu[], x: number, y: number) => {
  for (const menuView of menuWebviews) {
    menuView.setVisible(true)
    menuView.webContents.send('context-menu', JSON.stringify(menu), x, y)
  }
})

ipcMain.on('context-menu-event', async (_: IpcMainEvent, type: string, items: string[]) => {
  const mainWindow = getMainWindow()
  if (!mainWindow) return
  for (const menuView of menuWebviews) {
    menuView.setVisible(false)
  }
  mainWindow.webContents.send('context-menu-event', type, items)
})

// 新建页面
ipcMain.on('new-tab', async () => {
  await newPage()
})

// 切换页面
ipcMain.on('switch-tab', (_event, tabId: string) => {
  switchPage(tabId)
})
