export type MenuItemType = 'item' | 'divider'

export interface Menu {
  /** m3e 图标名,divider 可留空 */
  icon: string
  /** 显示文本,divider 可留空 */
  name: string
  /** 由调用方定义的标识,会原样回传 */
  id: string
  type: MenuItemType
  disabled?: boolean
}

/** 渲染进程请求打开上下文菜单时的载荷 */
export interface MenuRequest {
  /** 由调用方生成,用于把结果回传给正确的发起者 */
  requestId: string
  items: Menu[]
  x: number
  y: number
}

/** 菜单关闭后回传给发起者的结果 */
export interface MenuResult {
  requestId: string
  /** 被点击项的 id;菜单被取消时为 null */
  itemId: string | null
}
