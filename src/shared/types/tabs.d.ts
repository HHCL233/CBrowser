export interface Tab {
  id: string
  url: string
  title: string
  icon: string
}

export interface TabsState {
  tabs: Tab[]
  sortTabs: Tab[]
  currentTabId: string
  loadingTabId: string[]
}
