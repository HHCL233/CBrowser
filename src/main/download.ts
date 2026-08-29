import { type DownloadItem as DownloadInstance } from 'electron'
import { getShellWebContents } from './window'
import { downloadChannel } from '../shared/ipc'
import { DownloadState, DownloadItem } from '../shared/types/download'

interface DownloadRecord {
  fileName: string
  progress: number
  id: string
  item: DownloadInstance
}

// 下载数据
const downloadData: DownloadRecord[] = []
let itemIndex = 0
let revision = 0
let cache: DownloadItem[] = []
let scheduled = false

function toItem(download: DownloadRecord): DownloadItem {
  return {
    fileName: download.fileName,
    progress: download.progress
  }
}

function toItems(downloads: DownloadRecord[]): DownloadItem[] {
  return downloads.map(toItem)
}

export function newDownload(fileName: string, progress: number, item: DownloadInstance): void {
  const data = { fileName, progress, item, id: `download-${itemIndex}` }
  downloadData.push(data)
  itemIndex += 1
  scheduleBroadcast()

  const totalBytes = item.getTotalBytes() === 0 ? 1 : 0

  const handleUpdate = (_event: unknown, state: 'progressing' | 'interrupted'): void => {
    if (state === 'interrupted') {
      console.log('下载任务被中断')
    } else if (state === 'progressing') {
      if (item.isPaused()) {
        console.log('下载已暂停')
      } else {
        // 计算进度
        const receivedBytes = item.getReceivedBytes()
        const progress = Math.round((receivedBytes / totalBytes) * 100)
        data.progress = progress
        console.log(`下载进度 ${progress}`)
      }
    }
    scheduleBroadcast()
  }
  // 监听状态更新
  item.removeListener('updated', handleUpdate)
  item.on('updated', handleUpdate)

  item.once('done', (_event, state) => {
    item.removeListener('updated', handleUpdate)

    if (state === 'completed') {
      data.progress = 100
      console.log('下载成功')
    } else {
      console.log(`下载失败: ${state}`)
    }
    scheduleBroadcast()
  })
}

export function getDownloadSnapshot(): DownloadState {
  return { revision, downloads: cache }
}

export function scheduleBroadcast(): void {
  if (scheduled) return
  scheduled = true
  setImmediate(() => {
    scheduled = false
    cache = toItems(downloadData)
    revision += 1
    const contents = getShellWebContents()
    if (!contents) return
    contents.send(downloadChannel.Data, getDownloadSnapshot())
  })
}
