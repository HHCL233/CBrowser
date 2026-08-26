import { session, type Extension } from 'electron'
import type { ExtensionInfo, ExtensionsState } from '../shared/types/extensions'
import { ExtensionsChannel } from '../shared/ipc'
import { getShellWebContents } from './window'

/**
 * 扩展列表状态
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
