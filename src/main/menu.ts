import { WebContentsView, type WebContents } from 'electron'
import { join } from 'node:path'
import type { Menu, MenuResult } from '../shared/types/menu'
import { MenuChannel } from '../shared/ipc'
import { forgetView, setOverlayView, updateLayout } from './window'

/**
 * 上下文菜单覆盖层。
 *
 * 旧实现的问题:
 * - 菜单视图在每次标签页状态更新时被重新 `addChildView`,不断被提到最上层,
 *   即使它是隐藏的,也会打乱内容视图的层级。
 * - 打开菜单的渲染进程和接收结果的渲染进程之间没有配对信息,
 *   多次打开菜单时结果可能被投递给错误的发起者。
 * - 菜单窗口用 `setTimeout(200)` 延迟上报点击,期间主进程状态已经变了。
 *
 * 现在:覆盖层只在菜单打开期间挂载,每次请求带 `requestId`,
 * 结果只回传给发起请求的那个 webContents。
 */

let menuView: WebContentsView | null = null
let ready: Promise<void> | null = null

/** 当前打开的菜单请求;没有打开的菜单时为 null */
let pending: { requestId: string; requester: WebContents } | null = null

/** 请求序号,保证 requestId 唯一 */
let requestSeq = 0

export async function initMenu(): Promise<void> {
  if (menuView) return ready ?? Promise.resolve()

  const view = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      transparent: true
    }
  })
  menuView = view

  // Alpha 必须写在最前,否则解析出的颜色不是透明
  view.setBackgroundColor('#00ffffff')

  view.webContents.on('destroyed', () => {
    forgetView(view)
    if (menuView === view) {
      menuView = null
      ready = null
      pending = null
    }
  })

  ready = view.webContents.loadURL('cb-chrome://menu').then(() => undefined)
  await ready
}

/**
 * 打开上下文菜单。
 *
 * @param requester 发起请求的渲染进程,菜单结果只会回传给它
 * @returns 分配给本次请求的 requestId
 */
export async function openMenu(
  requester: WebContents,
  items: Menu[],
  x: number,
  y: number
): Promise<string | null> {
  await initMenu()
  if (!menuView || menuView.webContents.isDestroyed()) return null

  // 上一个菜单还开着就先给它一个「取消」结果,不让发起者永远等下去
  if (pending) {
    deliverResult(null)
  }

  const requestId = `menu-${++requestSeq}`
  pending = { requestId, requester }

  setOverlayView(menuView)
  updateLayout()
  menuView.setVisible(true)
  menuView.webContents.send(MenuChannel.Show, { requestId, items, x, y })
  // 菜单需要键盘焦点来支持方向键选择
  menuView.webContents.focus()

  return requestId
}

/** 关闭菜单并把结果回传给发起者 */
export function closeMenu(requestId: string, itemId: string | null): void {
  // requestId 不匹配说明这是上一个已经结束的菜单的迟到消息,直接忽略
  if (!pending || pending.requestId !== requestId) return
  deliverResult(itemId)
}

function deliverResult(itemId: string | null): void {
  const current = pending
  pending = null

  if (menuView && !menuView.webContents.isDestroyed()) {
    menuView.setVisible(false)
  }
  // 覆盖层用完即卸,内容视图重新成为唯一图层
  setOverlayView(null)

  if (!current) return
  const result: MenuResult = { requestId: current.requestId, itemId }
  if (!current.requester.isDestroyed()) {
    current.requester.send(MenuChannel.Result, result)
  }
}

/** 发起者所在的渲染进程消失时放弃菜单,避免覆盖层卡在屏幕上 */
export function abandonMenuFor(contents: WebContents): void {
  if (pending?.requester === contents) {
    deliverResult(null)
  }
}
