import { session, type Extension } from 'electron'
import type { ExtensionInfo, ExtensionsState } from '../shared/types/extensions'
import { ExtensionsChannel } from '../shared/ipc'
import { getShellWebContents } from './window'

/**
 * 扩展列表状态。
 *
 * 旧实现让渲染进程通过 `sync-extensions` 的 `'set'` 分支写入列表,
 * 主进程只是被动存储 —— 渲染进程和 Electron 真实的扩展状态可以任意分叉。
 * 现在主进程直接以 `session.extensions` 为唯一数据源,
 * 并在 loaded/unloaded 事件时推送快照,渲染进程只读。
 */

let revision = 0
let cache: ExtensionInfo[] = []

function toInfo(extension: Extension): ExtensionInfo {
  return {
    id: extension.id,
    name: extension.name,
    version: extension.version,
    url: extension.url
  }
}

function readFromSession(): ExtensionInfo[] {
  return session.defaultSession.extensions
    .getAllExtensions()
    .map(toInfo)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getExtensionsSnapshot(): ExtensionsState {
  return { revision, extensions: cache }
}

let scheduled = false

function scheduleBroadcast(): void {
  if (scheduled) return
  scheduled = true
  setImmediate(() => {
    scheduled = false
    cache = readFromSession()
    revision += 1
    const contents = getShellWebContents()
    if (!contents) return
    contents.send(ExtensionsChannel.State, getExtensionsSnapshot())
  })
}

export function initExtensionsState(): void {
  cache = readFromSession()

  const { extensions } = session.defaultSession
  extensions.on('extension-loaded', scheduleBroadcast)
  extensions.on('extension-unloaded', scheduleBroadcast)
  extensions.on('extension-ready', scheduleBroadcast)

  scheduleBroadcast()
}
