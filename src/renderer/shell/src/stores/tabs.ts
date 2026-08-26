import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import type { Tab, TabsState } from '../../../../shared/types/tabs'

const state = ref<TabsState>({
  revision: -1,
  tabs: [],
  activeTabId: null
})

let started = false
let stopListening: (() => void) | null = null

function accept(next: TabsState): void {
  // 丢弃乱序到达的旧快照
  if (!next || next.revision <= state.value.revision) return
  state.value = next
}

function start(): void {
  if (started) return
  started = true
  stopListening = window.cb.tabs.onState(accept)
  // 首帧补齐:主进程可能在渲染进程注册监听之前就完成了初始化
  void window.cb.tabs.get().then(accept)
}

export function useTabs(): {
  tabs: ComputedRef<Tab[]>
  activeTabId: ComputedRef<string | null>
  state: Readonly<Ref<TabsState>>
} {
  start()
  return {
    tabs: computed(() => state.value.tabs),
    activeTabId: computed(() => state.value.activeTabId),
    state: readonly(state) as Readonly<Ref<TabsState>>
  }
}

/** 供 HMR 场景释放监听,避免热更新后监听翻倍 */
export function disposeTabs(): void {
  stopListening?.()
  stopListening = null
  started = false
}
