interface DownloadItem {
  fileName: string
  progress: number
}

export interface DownloadState {
  /** 单调递增的版本号,用于丢弃乱序到达的旧快照 */
  revision: number
  downloads: DownloadItem[]
}
