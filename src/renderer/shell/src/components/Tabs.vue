<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Tab } from '../../../../shared/types/tabs'
import { useTabs } from '../stores/tabs'

const { tabs, activeTabId } = useTabs()

const emits = defineEmits<{
  startDarg: []
  endDarg: []
}>()

/**
 * 地址栏是受控但可被本地编辑的输入框
 */

const drafts = reactive<Record<string, string>>({})
const editingTabId = ref<string | null>(null)
const displayUrl = (tab: Tab): string => drafts[tab.id] ?? tab.url

// 标签页关闭后清掉它的草稿
// 避免 id 复用时残留
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

const closeTab = async (tabId: string): Promise<void> => {
  window.cb.tabs.close(tabId)
}

/**
 * 拖拽排序
 */
let dargSyncing = false

const localOrder = ref<Tab[] | null>(null)

const displayTabs = computed<Tab[]>(() => localOrder.value ?? tabs.value)

const onDragStart = (): void => {
  emits('startDarg')
  localOrder.value = [...tabs.value]
}

const onOrderUpdate = (next: Tab[]): void => {
  localOrder.value = next
  const order = localOrder.value
  if (!order) return
  window.cb.tabs.reorder(order.map((tab) => tab.id))
}

const onDragEnd = async (): Promise<void> => {
  emits('endDarg')
  const order = localOrder.value
  if (!order) return
  dargSyncing = true
  window.cb.tabs.reorder(order.map((tab) => tab.id))
}

window.cb.tabs.onState(() => {
  // 拖拽更改同步后再删除本地tab顺序
  if (dargSyncing) {
    localOrder.value = null
    dargSyncing = false
  }
})

const openTabMenu = async (tabId: string, event: MouseEvent): Promise<void> => {
  event.stopPropagation()
  const tab = tabs.value.find((tab) => tab.id === tabId)
  if (!tab) return
  const itemId = await window.cb.contextMenu.open(
    [
      { icon: 'label', name: tab.title, type: 'item', id: 'label' },
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
    target=".sort-target"
    :prevent-on-filter="false"
    @start="onDragStart"
    @update:model-value="onOrderUpdate"
    @end="onDragEnd"
  >
    <TransitionGroup tag="ul" name="fade" class="sort-target">
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
            <m3e-icon v-else-if="tab.crash" name="error"></m3e-icon>
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
            <m3e-icon v-else-if="tab.crash" name="error"></m3e-icon>
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
      <m3e-icon-button
        key="add"
        width="wide"
        variant="outlined"
        class="icon-tab no-drag"
        @click="createTab"
      >
        <m3e-icon name="add"></m3e-icon>
      </m3e-icon-button>
      <m3e-icon-button
        key="sidebar"
        variant="outlined"
        toggle
        class="icon-tab no-drag"
        width="wide"
      >
        <m3e-icon name="right_panel_open"></m3e-icon>
        <m3e-icon slot="selected" name="right_panel_close"></m3e-icon>
        <m3e-drawer-toggle for="nav-drawer"></m3e-drawer-toggle>
      </m3e-icon-button>
    </TransitionGroup>
  </VueDraggable>
</template>
<style lang="scss" scoped>
.tab-draggable {
  width: 100%;
  height: 100%;
  .sort-target {
    width: 100%;
    height: 100%;
    display: flex;
    gap: 4px;
    padding: 0;
    margin: 0;
    .tab {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 0;
      min-width: 0;
      flex-grow: 2;
      flex-shrink: 1;
      flex-basis: auto;
      transform-origin: center;
      transition: all 0.5s cubic-bezier(0.38, 1.21, 0.22, 1);
      &.input {
        justify-content: start;
        flex-grow: 8;
      }
      .tab-input {
        height: 100%;
        --m3e-search-bar-input-text-font-size: 14px;
        --m3e-search-bar-supporting-text-font-size: 14px;
        .tab-icon-button {
          --_icon-button-size: 24px;
          max-width: 24px;
          margin-left: -16px;
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
          --_icon-button-size: 24px;
          max-width: 24px;
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
    }
  }
}

.fade-move,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.38, 1.21, 0.22, 1);
}

/** 进入动画 */
.fade-enter-from {
  opacity: 0;
  flex-grow: 0 !important;
}

/** 离开动画 */
.fade-leave-to {
  opacity: 0;
  flex-grow: 0 !important;
}

.fade-leave-active {
}
</style>
