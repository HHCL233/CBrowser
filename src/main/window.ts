import { BrowserWindow, WebContentsView, shell, type Rectangle } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

/** 顶部标签栏高度 */
export const TOOLBAR_HEIGHT = 44

let mainWindow: BrowserWindow | null = null

/**
 * 当前的图层
 */
const layers: { content: WebContentsView | null; overlay: WebContentsView | null } = {
  content: null,
  overlay: null
}

/** 已经真正挂载到窗口上的图层顺序
 * 用于无变化就不动的比较 */
let attached: WebContentsView[] = []

/** 已下发的bounds
 * 避免重复setBounds造成的抖动 */
const appliedBounds = new WeakMap<WebContentsView, Rectangle>()

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const window = mainWindow

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 窗口尺寸变化只影响布局
  // 不应该顺带触发状态广播
  window.on('resize', updateLayout)
  window.on('enter-full-screen', updateLayout)
  window.on('leave-full-screen', updateLayout)

  window.on('closed', () => {
    mainWindow = null
    attached = []
    layers.content = null
    layers.overlay = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/shell/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/shell/index.html'))
  }

  return window
}

export function getMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('MainWindow has not been initialized yet!')
  }
  return mainWindow
}

/** 主窗口是否可用
 * IPC 回调里先判断它再操作
 * 避免关闭过程中抛错 */
export function hasMainWindow(): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed()
}

/** 主窗口自身webContents
 * 用于向 shell 渲染进程推送快照 */
export function getShellWebContents(): Electron.WebContents | null {
  if (!hasMainWindow()) return null
  const contents = mainWindow!.webContents
  return contents.isDestroyed() ? null : contents
}

/** 设置底层内容视图(当前标签页) */
export function setContentView(view: WebContentsView | null): void {
  if (layers.content === view) return
  layers.content = view
  applyLayers()
  updateLayout()
}

/** 设置顶层覆盖视图(上下文菜单) */
export function setOverlayView(view: WebContentsView | null): void {
  if (layers.overlay === view) return
  layers.overlay = view
  applyLayers()
  updateLayout()
}

function desiredLayers(): WebContentsView[] {
  return [layers.content, layers.overlay].filter((view): view is WebContentsView => view !== null)
}

/**
 * 把期望的图层顺序同步到窗口
 */
function applyLayers(): void {
  if (!hasMainWindow()) return
  const window = mainWindow!
  const desired = desiredLayers()

  if (desired.length === attached.length && desired.every((view, i) => attached[i] === view)) {
    return
  }

  for (const view of attached) {
    if (!desired.includes(view)) {
      window.contentView.removeChildView(view)
    }
  }

  // 找到从头开始仍然一致的前缀,前缀内的视图无需重挂
  let stable = 0
  while (stable < desired.length && attached[stable] === desired[stable]) {
    stable++
  }
  for (let index = stable; index < desired.length; index++) {
    window.contentView.addChildView(desired[index], index)
  }

  attached = desired
}

/** 按当前窗口尺寸重新计算各图层的位置 */
export function updateLayout(): void {
  if (!hasMainWindow()) return
  const [width, height] = mainWindow!.getContentSize()

  if (layers.content) {
    setBoundsIfChanged(layers.content, {
      x: 0,
      y: TOOLBAR_HEIGHT,
      width,
      height: Math.max(0, height - TOOLBAR_HEIGHT)
    })
  }
  if (layers.overlay) {
    setBoundsIfChanged(layers.overlay, { x: 0, y: 0, width, height })
  }
}

function setBoundsIfChanged(view: WebContentsView, bounds: Rectangle): void {
  const previous = appliedBounds.get(view)
  if (
    previous &&
    previous.x === bounds.x &&
    previous.y === bounds.y &&
    previous.width === bounds.width &&
    previous.height === bounds.height
  ) {
    return
  }
  appliedBounds.set(view, bounds)
  view.setBounds(bounds)
}

/** 视图销毁时清理布局引用,防止悬空引用被再次挂载 */
export function forgetView(view: WebContentsView): void {
  if (layers.content === view) layers.content = null
  if (layers.overlay === view) layers.overlay = null
  attached = attached.filter((attachedView) => attachedView !== view)
  appliedBounds.delete(view)
}
