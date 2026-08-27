export interface Tab {
  id: string
  url: string
  title: string
  icon: string
  crash: boolean
  /** 该标签页是否正在加载 */
  loading: boolean
}

/**
 * 标签页状态快照
 */
export interface TabsState {
  /** 单调递增的版本号,用于丢弃乱序到达的旧快照 */
  revision: number
  /** 按显示顺序排列的标签页 */
  tabs: Tab[]
  /** 当前激活的标签页,没有标签页时为 null */
  activeTabId: string | null
}
