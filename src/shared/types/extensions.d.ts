export interface ExtensionInfo {
  id: string
  name: string
  version: string
  /** 扩展的 `chrome-extension://` 根地址 */
  url: string
}

export interface ExtensionsState {
  /** 单调递增的版本号,用于丢弃乱序到达的旧快照 */
  revision: number
  extensions: ExtensionInfo[]
}
