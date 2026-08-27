import Store from 'electron-store'

const store = new Store()

export function setStore(key: string, value: unknown): void {
  store.set(key, value)
}

export function getStore(key: string): unknown {
  return store.get(key)
}

export function deleteStore(key: string): void {
  store.delete(key)
}

export function hasStore(key: string): boolean {
  return store.has(key)
}
