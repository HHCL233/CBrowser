<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Tab } from '../../../../shared/types/tabs'
import { useTabs } from '../stores/tabs'

const { tabs, activeTabId } = useTabs()

/**
 * 地址栏是「受控但可被本地编辑」的输入框。
 *
 * 旧实现把 `v-model="tab.url"` 直接绑到快照对象上,并且每敲一个字符就
 * `send('change-sort-tabs-url')` 让主进程改状态、再广播回来覆盖输入框。
 * 结果是:输入过程中光标跳动、字符丢失,页面自身导航时也会把用户
 * 正在编辑的内容冲掉。
 *
 * 现在:编辑期间输入框只受本地草稿控制,主进程推送一律不覆盖草稿;
 * 提交(回车)或放弃(失焦/Esc)后才回到跟随主进程状态。
 */
const drafts = reactive<Record<string, string>>({})
const editingTabId = ref<string | null>(null)

const displayUrl = (tab: Tab): string => drafts[tab.id] ?? tab.url

// 标签页关闭后清掉它的草稿,避免 id 复用时残留(id 本身不复用,这里只是防泄漏)
watch(tabs, (list) => {
  const alive = new Set(list.map((tab) => tab.id))
  for (const id of Object.keys(drafts)) {
    if (!alive.has(id)) delete drafts[id]
  }
  if (editingTabId.value && !alive.has(editingTabId.value)) {
    editingTabId.value = null
  }
})

const onUrlInput = (tabId: string, event: Event): void => {
  const target = event.target as HTMLInputElement
  editingTabId.value = tabId
  drafts[tabId] = target.value
}

const submitUrl = (tabId: string): void => {
  const draft = drafts[tabId]
  editingTabId.value = null
  delete drafts[tabId]
  if (draft === undefined) return
  window.cb.tabs.navigate(tabId, draft)
}

const cancelEdit = (tabId: string): void => {
  editingTabId.value = null
  delete drafts[tabId]
}

const activate = (tabId: string): void => {
  window.cb.tabs.activate(tabId)
}

const createTab = (): void => {
  window.cb.tabs.create()
}

const closeTab = (tabId: string): void => {
  window.cb.tabs.close(tabId)
}

/**
 * 拖拽排序。
 *
 * 只把新的 id 顺序发给主进程,不回传整个 Tab 对象 —— 拖拽期间快照里的
 * title/url 可能已经过期,旧实现用 `Object.assign` 写回主进程会用陈旧数据
 * 覆盖刚更新的真实值。
 *
 * 拖拽结束前保持本地顺序,避免主进程广播打断动画。
 */
const localOrder = ref<Tab[] | null>(null)

const displayTabs = computed<Tab[]>(() => localOrder.value ?? tabs.value)

const onDragStart = (): void => {
  localOrder.value = [...tabs.value]
}

const onOrderUpdate = (next: Tab[]): void => {
  localOrder.value = next
}

const onDragEnd = (): void => {
  const order = localOrder.value
  localOrder.value = null
  if (!order) return
  window.cb.tabs.reorder(order.map((tab) => tab.id))
}

const openTabMenu = async (tabId: string, event: MouseEvent): Promise<void> => {
  event.stopPropagation()
  const itemId = await window.cb.contextMenu.open(
    [
      { icon: 'refresh', name: '刷新', type: 'item', id: 'reload' },
      { icon: '', name: '', type: 'divider', id: 'divider-1' },
      { icon: 'close', name: '关闭标签页', type: 'item', id: 'close' }
    ],
    event.clientX,
    event.clientY
  )

  if (itemId === 'reload') window.cb.tabs.reload(tabId)
  if (itemId === 'close') window.cb.tabs.close(tabId)
}

onBeforeUnmount(() => {
  localOrder.value = null
})
</script>

<template>
  <VueDraggable
    :model-value="displayTabs"
    class="tab-draggable"
    :animation="150"
    filter=".no-drag"
    :prevent-on-filter="false"
    @start="onDragStart"
    @update:model-value="onOrderUpdate"
    @end="onDragEnd"
  >
    <div
      v-for="tab in displayTabs"
      :key="tab.id"
      :class="{ tab: true, input: activeTabId === tab.id }"
    >
      <m3e-button
        v-if="activeTabId !== tab.id"
        variant="outlined"
        class="tab-button"
        size="small"
        @click="activate(tab.id)"
      >
        <m3e-icon-button
          slot="icon"
          variant="standard"
          class="tab-icon-button"
          size="small"
          width="wide"
          @click="openTabMenu(tab.id, $event)"
        >
          <m3e-loading-indicator v-if="tab.loading" class="tab-loading"></m3e-loading-indicator>
          <img v-else-if="tab.icon" :src="tab.icon" class="tab-icon" alt="" />
          <m3e-icon v-else name="public"></m3e-icon>
        </m3e-icon-button>
        <span class="tab-title">{{ tab.title || tab.url }}</span>
      </m3e-button>
      <m3e-search-bar v-else class="tab-input">
        <m3e-icon-button
          slot="leading"
          variant="standard"
          class="tab-icon-button"
          size="small"
          width="wide"
          @click="openTabMenu(tab.id, $event)"
        >
          <m3e-loading-indicator
            v-if="tab.loading"
            class="tab-input-loading"
          ></m3e-loading-indicator>
          <img v-else-if="tab.icon" :src="tab.icon" class="tab-input-icon" alt="" />
          <m3e-icon v-else name="public"></m3e-icon>
        </m3e-icon-button>
        <input
          slot="input"
          :value="displayUrl(tab)"
          spellcheck="false"
          type="text"
          :placeholder="tab.title"
          class="no-drag"
          @input="onUrlInput(tab.id, $event)"
          @keyup.enter="submitUrl(tab.id)"
          @keyup.esc="cancelEdit(tab.id)"
          @blur="cancelEdit(tab.id)"
        />
        <m3e-icon-button
          slot="trailing"
          variant="standard"
          class="tab-close no-drag"
          size="small"
          @click="closeTab(tab.id)"
        >
          <m3e-icon name="close"></m3e-icon>
        </m3e-icon-button>
      </m3e-search-bar>
    </div>
    <m3e-icon-button width="wide" variant="outlined" class="icon-tab no-drag" @click="createTab">
      <m3e-icon name="add"></m3e-icon>
    </m3e-icon-button>
  </VueDraggable>
</template>
<style lang="scss" scoped>
.tab-draggable {
  width: 100%;
  display: flex;
  gap: 4px;
  height: 100%;
  .tab {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 0;
    flex: 1 1 auto;
    transition:
      flex-grow 0.35s cubic-bezier(0.42, 1.67, 0.21, 0.9),
      flex 0.35s cubic-bezier(0.42, 1.67, 0.21, 0.9);
    transform-origin: center;
    &.input {
      justify-content: start;
      flex-grow: 8;
      &:hover {
        flex-grow: 8;
      }
    }
    &:hover {
      flex-grow: 2;
    }
    .tab-input {
      height: 100%;
      --m3e-search-bar-input-text-font-size: 14px;
      --m3e-search-bar-supporting-text-font-size: 14px;
      .tab-icon-button {
        width: 52px;
        .tab-input-icon {
          width: 16px;
          height: 16px;
        }
        .tab-input-loading {
          width: 44px;
          overflow: visible;
          transform: scale(0.5);
        }
      }
    }
    .tab-button {
      width: 100%;
      --m3e-button-shape-pressed-morph: 14px;
      --m3e-button-small-leading-space: var(--md-sys-measurement-space150);
      --m3e-button-container-height: 48px;
      .tab-icon-button {
        width: 16px;
        .tab-icon {
          width: 16px;
          height: 16px;
        }
        .tab-loading {
          width: 44px;
          overflow: visible;
          transform: scale(0.5);
        }
      }
    }
  }
  .icon-tab {
    white-space: nowrap;
    overflow: hidden;
    --m3e-icon-button-container-height: 48px;
    --m3e-icon-button-shape-pressed-morph: 9999px;
  }
}
</style>
