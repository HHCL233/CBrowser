import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import type { Tab, TabsState } from '../../../../shared/types/tabs'

/**
 * 标签页状态的唯一渲染进程副本。
 *
 * 旧实现的两个同步缺陷:
 * - App.vue 和 Tabs.vue 各自持有一份 `ref` 状态并各自注册 `update-tabs` 监听。
 *   其中任一组件卸载时调用 `removeAllListeners('update-tabs')`,
 *   会把另一份的监听一起删掉,那一份就永久停止更新。
 * - 收到「有变化」的通知后再 `invoke('sync-tabs','get')` 回拉数据,
 *   连续变更会产生多个并发请求,响应乱序返回时旧快照覆盖新快照。
 *
 * 现在:模块级单例、主进程直接推送完整快照、revision 单调递增校验。
 */

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
