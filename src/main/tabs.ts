import { WebContentsView, session, type BrowserWindow, type WebContents } from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { buildChromeContextMenu } from 'electron-chrome-context-menu'
import type { Tab, TabsState } from '../shared/types/tabs'
import {
  forgetView,
  getMainWindow,
  getShellWebContents,
  hasMainWindow,
  setContentView
} from './window'
import { TabsChannel } from '../shared/ipc'

const DEFAULT_URL = 'https://www.bing.com'

interface TabRecord {
  id: string
  view: WebContentsView
  url: string
  title: string
  icon: string
  /**
   * 是否正在加载。
   *
   * 取值始终来自 `webContents.isLoading()`,不由事件次数推算 ——
   * `did-start-loading` / `did-stop-loading` 在重定向和子框架场景下不严格成对,
   * 自行累加会让转圈动画永久残留。
   */
  loading: boolean
  destroyed: boolean
}

/** 递增计数器:id 永不复用,避免关闭标签页后新标签页撞上旧 id */
let nextTabSeq = 1

/** 每次状态变更递增,渲染进程靠它丢弃乱序到达的旧快照 */
let revision = 0

const tabs: TabRecord[] = []
let activeTabId: string | null = null
let extensions: ElectronChromeExtensions | null = null

export function initTabs(instance: ElectronChromeExtensions): void {
  extensions = instance
}

function findTab(tabId: string): TabRecord | undefined {
  return tabs.find((tab) => tab.id === tabId && !tab.destroyed)
}

function toSnapshot(): TabsState {
  return {
    revision,
    activeTabId,
    tabs: tabs
      .filter((tab) => !tab.destroyed)
      .map<Tab>((tab) => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        icon: tab.icon,
        loading: tab.loading
      }))
  }
}

/** 供 `tabs:get` 使用:不改变 revision,只读当前快照 */
export function getTabsSnapshot(): TabsState {
  return toSnapshot()
}

/**
 * 由 webContents 反查标签页 id。
 *
 * 扩展系统的回调只给 webContents,需要用它映射回我们的标签页标识。
 */
export function getTabIdByWebContents(contents: WebContents): string | null {
  const record = tabs.find((tab) => !tab.destroyed && tab.view.webContents === contents)
  return record ? record.id : null
}

let broadcastScheduled = false

/**
 * 广播状态变更。
 *
 * 一次导航会连续触发 title/favicon/url/loading 等多个事件,逐个 send 会让
 * 渲染进程收到一串中间态。这里把同一轮事件循环内的变更合并成一次推送,
 * 并直接带上完整快照 —— 渲染进程不再需要反过来 invoke 拉取,
 * 因此也不可能出现两个 invoke 的响应乱序覆盖的问题。
 */
function scheduleBroadcast(): void {
  if (broadcastScheduled) return
  broadcastScheduled = true
  setImmediate(() => {
    broadcastScheduled = false
    revision += 1
    const contents = getShellWebContents()
    if (!contents) return
    contents.send(TabsChannel.State, toSnapshot())
  })
}

/** 状态发生变化时调用;内部做合并,可以放心地频繁调用 */
export function publishTabs(): void {
  scheduleBroadcast()
}

/**
 * 把用户输入的地址栏文本转成可导航的 URL。
 *
 * 旧实现直接把输入原样交给 `loadURL`,输入 `bing.com` 会因为缺少协议而
 * 加载失败,失败后主进程里的 url 与渲染进程显示的又不一致。
 */
export function resolveUserInput(input: string): string {
  const text = input.trim()
  if (!text) return DEFAULT_URL

  if (/^[a-z][a-z0-9+\-.]*:/i.test(text)) return text

  const looksLikeHost = /^[^\s/?#]+\.[^\s/?#]+/.test(text) || text.startsWith('localhost')
  if (looksLikeHost) return `https://${text}`

  return `https://www.bing.com/search?q=${encodeURIComponent(text)}`
}

function applyActive(tabId: string | null): void {
  activeTabId = tabId
  const record = tabId ? findTab(tabId) : undefined
  setContentView(record ? record.view : null)
  if (record && extensions && !record.view.webContents.isDestroyed()) {
    // 让扩展系统知道活动标签页变了,否则 chrome.tabs.query({active:true}) 会返回旧标签页
    extensions.selectTab(record.view.webContents)
  }
}

export function activateTab(tabId: string): void {
  const record = findTab(tabId)
  if (!record || record.id === activeTabId) return
  applyActive(record.id)
  publishTabs()
}

/**
 * 按 id 顺序重排。
 *
 * 只接受 id 列表而不是整个 Tab 数组:渲染进程发回来的对象可能携带过期的
 * title/url,旧实现用 `Object.assign` 把它们写回主进程状态,从而用陈旧数据
 * 覆盖了刚刚更新的真实值。
 */
export function reorderTabs(orderedIds: string[]): void {
  const known = new Map(tabs.map((tab) => [tab.id, tab]))
  const reordered: TabRecord[] = []

  for (const id of orderedIds) {
    const record = known.get(id)
    if (record && !reordered.includes(record)) {
      reordered.push(record)
      known.delete(id)
    }
  }
  // 渲染进程没提到的标签页(例如重排期间新建的)保持原有相对顺序追加在后面
  for (const record of tabs) {
    if (known.has(record.id)) reordered.push(record)
  }

  const changed =
    reordered.length !== tabs.length || reordered.some((record, i) => tabs[i] !== record)
  if (!changed) return

  tabs.splice(0, tabs.length, ...reordered)
  publishTabs()
}

export function navigateTab(tabId: string, input: string): void {
  const record = findTab(tabId)
  if (!record || record.view.webContents.isDestroyed()) return
  const url = resolveUserInput(input)
  record.url = url
  publishTabs()
  record.view.webContents.loadURL(url).catch((error) => {
    console.warn(`[tabs] navigate failed ${url}:`, error)
  })
}

export function reloadTab(tabId: string): void {
  const record = findTab(tabId)
  if (!record || record.view.webContents.isDestroyed()) return
  record.view.webContents.reload()
}

export function closeTab(tabId: string): void {
  const record = findTab(tabId)
  if (!record) return
  // 真正的状态清理统一放在 'destroyed' 回调里,
  // 保证无论关闭来自 UI、window.close() 还是渲染进程崩溃,结果都一致。
  if (record.view.webContents.isDestroyed()) {
    disposeTab(record)
  } else {
    record.view.webContents.close()
  }
}

function disposeTab(record: TabRecord): void {
  if (record.destroyed) return
  record.destroyed = true

  const index = tabs.indexOf(record)
  if (index !== -1) tabs.splice(index, 1)

  forgetView(record.view)
  if (extensions && !record.view.webContents.isDestroyed()) {
    extensions.removeTab(record.view.webContents)
  }

  if (activeTabId === record.id) {
    // 优先激活原位置的邻居,行为与主流浏览器一致
    const fallback = tabs[Math.min(index, tabs.length - 1)]
    applyActive(fallback ? fallback.id : null)
  }

  publishTabs()
}

export function createTab(url?: string, activate = true): TabRecord | null {
  if (!extensions || !hasMainWindow()) return null

  const window = getMainWindow()
  const browserSession = session.defaultSession
  const record: TabRecord = {
    id: `tab-${nextTabSeq++}`,
    view: new WebContentsView({ webPreferences: { session: browserSession } }),
    url: url ? resolveUserInput(url) : DEFAULT_URL,
    title: '',
    icon: '',
    loading: false,
    destroyed: false
  }

  tabs.push(record)
  extensions.addTab(record.view.webContents, window)
  record.view.webContents.setUserAgent(
    browserSession
      .getUserAgent()
      .replace(/Electron\/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\s?/g, '')
      .trim()
  )

  attachTabEvents(record, window)

  if (activate) {
    applyActive(record.id)
  }
  // 先让 UI 看到这个标签页,再发起加载。
  // 旧实现 `await loadURL()` 之后才继续,导致新标签页在页面加载完成前
  // 完全不出现在标签栏里,用户看到的是「点了没反应」。
  publishTabs()

  record.view.webContents.loadURL(record.url).catch((error) => {
    // 加载失败不影响标签页存在;真实 URL 由 did-navigate 系列事件同步
    console.warn(`[tabs] initial load failed ${record.url}:`, error)
  })

  return record
}

function attachTabEvents(record: TabRecord, window: BrowserWindow): void {
  const contents = record.view.webContents

  const alive = (): boolean => !record.destroyed && !contents.isDestroyed()

  contents.setWindowOpenHandler(({ url }) => {
    createTab(url)
    return { action: 'deny' }
  })

  contents.on('page-title-updated', (event, title) => {
    event.preventDefault()
    if (!alive() || record.title === title) return
    record.title = title
    publishTabs()
  })

  contents.on('page-favicon-updated', (event, favicons) => {
    event.preventDefault()
    const icon = favicons[0] ?? ''
    if (!alive() || record.icon === icon) return
    record.icon = icon
    publishTabs()
  })

  // 只关心主框架的地址变化;子框架(广告 iframe 等)不该改写地址栏。
  const syncUrl = (url: string, isMainFrame: boolean): void => {
    if (!alive() || !isMainFrame || record.url === url) return
    record.url = url
    publishTabs()
  }

  contents.on('did-start-navigation', (details) => {
    syncUrl(details.url, details.isMainFrame)
  })
  contents.on('did-navigate', (_event, url) => {
    syncUrl(url, true)
  })
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    syncUrl(url, isMainFrame)
  })

  /**
   * 加载状态直接读 `webContents.isLoading()`,不自己累加计数。
   *
   * 旧实现用数组 push/filter 记录「哪些 tab 正在加载」,而
   * `did-start-loading` / `did-stop-loading` 在重定向、子框架场景下并不严格
   * 成对出现,次数一旦不对称,「正在加载」的转圈就永久残留。
   * 以 Electron 自己的状态为准就不存在配平问题。
   */
  const syncLoading = (): void => {
    if (!alive()) return
    const loading = contents.isLoading()
    if (record.loading === loading) return
    record.loading = loading
    publishTabs()
  }

  contents.on('did-start-loading', syncLoading)
  contents.on('did-stop-loading', syncLoading)
  contents.on('did-finish-load', syncLoading)
  contents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
    syncLoading()
    // -3 是用户主动中断,不算错误
    if (isMainFrame && errorCode !== -3) {
      console.warn(`[tabs] load failed ${errorCode}: ${errorDescription}`)
    }
  })

  contents.on('render-process-gone', () => {
    // 渲染进程没了,不会再有 did-stop-loading,必须手动结束加载态
    if (record.destroyed) return
    record.loading = false
    publishTabs()
  })

  contents.on('destroyed', () => {
    disposeTab(record)
  })

  contents.on('context-menu', (_event, params) => {
    if (!alive()) return
    const menu = buildChromeContextMenu({
      params,
      webContents: contents,
      openLink: (url) => {
        createTab(url)
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
    menu.popup({ window })
  })
}

/** 窗口关闭时释放所有标签页 */
export function destroyAllTabs(): void {
  for (const record of [...tabs]) {
    if (!record.view.webContents.isDestroyed()) {
      record.view.webContents.close()
    }
    disposeTab(record)
  }
}
