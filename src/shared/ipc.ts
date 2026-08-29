/**
 * 主进程与渲染进程之间的IPC契约
 */
export const TabsChannel = {
  /** 主进程推送完整标签页快照 */
  State: 'tabs:state',
  /** 渲染进程主动拉取一次快照(用于首帧/重载后补齐) */
  Get: 'tabs:get',
  /** 新建标签页 */
  Create: 'tabs:create',
  /** 激活标签页 */
  Activate: 'tabs:activate',
  /** 关闭标签页 */
  Close: 'tabs:close',
  /** 按新的 id 顺序重排标签页 */
  Reorder: 'tabs:reorder',
  /** 让某个标签页导航到用户输入的地址 */
  Navigate: 'tabs:navigate',
  /** 重新加载标签页 */
  Reload: 'tabs:reload'
} as const

export const ExtensionsChannel = {
  /** 主进程推送已加载扩展列表 */
  State: 'extensions:state',
  /** 渲染进程主动拉取一次扩展列表 */
  Get: 'extensions:get'
} as const

export const MenuChannel = {
  /** 渲染进程请求打开上下文菜单 */
  Open: 'menu:open',
  /** 主进程通知菜单窗口渲染菜单项 */
  Show: 'menu:show',
  /** 菜单窗口通知主进程菜单已关闭 */
  Dismiss: 'menu:dismiss',
  /** 菜单窗口通知主进程某一项被点击 */
  Select: 'menu:select',
  /** 主进程把菜单结果转发回发起方 */
  Result: 'menu:result'
} as const

export const downloadChannel = {
  /** 主进程把下载数据提供给渲染进程 */
  Data: 'download:data'
}

export const WindowChannel = {
  /** 更新webview位置 */
  updateSize: 'window:update'
}
