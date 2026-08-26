import { ElectronAPI } from '@electron-toolkit/preload'
import type { CbApi } from '../shared/types/api'

declare global {
  interface Window {
    electron: ElectronAPI
    cb: CbApi
  }
}

export {}
