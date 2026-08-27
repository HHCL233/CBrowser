import type { TabsState } from './tabs'
import type { ExtensionsState } from './extensions'
import type { Menu } from './menu'

/**
 * `window.cb` 的契约
 * 所有订阅方法都返回取消订阅函数,组件卸载时只移除自己的监听
 */
export interface CbTabsApi {
  onState(listener: (state: TabsState) => void): () => void
  get(): Promise<TabsState>
  create(url?: string): void
  activate(tabId: string): void
  close(tabId: string): void
  reorder(orderedIds: string[]): void
  navigate(tabId: string, input: string): void
  reload(tabId: string): void
}

export interface CbExtensionsApi {
  onState(listener: (state: ExtensionsState) => void): () => void
  get(): Promise<ExtensionsState>
}

export interface CbContextMenuApi {
  /** 打开菜单并解析为被选中项的 id
   * 取消时为 null */
  open(items: Menu[], x: number, y: number): Promise<string | null>
}

export interface MenuShowPayload {
  requestId: string
  items: Menu[]
  x: number
  y: number
}

/** 仅上下文菜单窗口使用 */
export interface CbMenuHostApi {
  onShow(listener: (payload: MenuShowPayload) => void): () => void
  select(requestId: string, itemId: string): void
  dismiss(requestId: string): void
}

export interface CbApi {
  tabs: CbTabsApi
  extensions: CbExtensionsApi
  contextMenu: CbContextMenuApi
  menuHost: CbMenuHostApi
}
