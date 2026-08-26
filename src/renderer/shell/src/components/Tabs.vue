<script setup lang="ts">
import { ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { TabsState } from '../../../../shared/types/tabs'
//const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
//window.electron.ipcRenderer.invoke('ping')

const tabsState = ref<TabsState>({
  currentTabId: '',
  loadingTabId: [],
  sortTabs: [],
  tabs: []
})

const clickTabButton = (tabId: string): void => {
  window.electron.ipcRenderer.send('switch-tab', tabId)
}

const handleTabsChanged = async (): Promise<void> => {
  console.log('收到主进程send过来的数据')
  tabsState.value = (await window.electron.ipcRenderer.invoke('sync-tabs', 'get')) as TabsState
}

// 注册监听
window.electron.ipcRenderer.on('update-tabs', handleTabsChanged)

const newPage = async (): Promise<void> => {
  await window.electron.ipcRenderer.send('new-tab')
}

const changeTabUrl = async (tabId: string, event: InputEvent): Promise<void> => {
  const target = event.target as HTMLInputElement
  await window.electron.ipcRenderer.send('change-sort-tabs-url', tabId, target.value)
}

const syncTabUrl = async (tabId: string): Promise<void> => {
  await window.electron.ipcRenderer.send('sync-tab', tabId)
}

const openTabMenu = async (tabId: string, event: MouseEvent): Promise<void> => {
  console.log(tabId)
  const mouseX = event.clientX
  const mouseY = event.clientY
  await window.electron.ipcRenderer.send(
    'context-menu',
    [
      {
        icon: '',
        name: 'test',
        type: 'item',
        id: JSON.stringify(['test', tabId])
      }
    ],
    mouseX,
    mouseY
  )
}
</script>

<template>
  <VueDraggable
    ref="el"
    v-model="tabsState.sortTabs"
    class="tab-draggable"
    :animation="150"
    filter=".no-drag"
    :prevent-on-filter="false"
  >
    <div
      v-for="tab in tabsState.sortTabs"
      :key="tab.id"
      :class="{ tab: true, input: tabsState.currentTabId == tab.id }"
    >
      <m3e-button
        v-if="tabsState.currentTabId != tab.id"
        variant="outlined"
        class="tab-button"
        size="small"
        @click="clickTabButton(tab.id)"
      >
        <m3e-icon-button
          slot="icon"
          variant="standard"
          class="tab-icon-button"
          size="small"
          width="wide"
          @click="openTabMenu(tab.id, $event)"
        >
          <m3e-loading-indicator
            v-if="tabsState.loadingTabId.includes(tab.id)"
            class="tab-loading"
          ></m3e-loading-indicator>
          <img v-else :src="tab.icon" class="tab-icon" />
        </m3e-icon-button>
        <span class="tab-title">{{ tab.title }}</span>
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
            v-if="tabsState.loadingTabId.includes(tab.id)"
            class="tab-input-loading"
          ></m3e-loading-indicator>
          <img v-else :src="tab.icon" class="tab-input-icon" />
        </m3e-icon-button>
        <input
          slot="input"
          v-model="tab.url"
          spellcheck="false"
          type="url"
          :placeholder="tab.title"
          class="no-drag"
          @input="changeTabUrl(tab.id, $event)"
          @keyup.enter="syncTabUrl(tab.id)"
        />
      </m3e-search-bar>

      <m3e-menu :id="`menu-${tab.id}`" class="tab-menu">
        <m3e-menu-item disabled>
          <m3e-icon slot="icon" name="title"></m3e-icon>
          {{ tab.title }}
        </m3e-menu-item>
        <m3e-divider></m3e-divider>
        <m3e-menu-item>
          <m3e-icon slot="icon" name="close"></m3e-icon>
          关闭标签页
        </m3e-menu-item>
      </m3e-menu>
    </div>
    <m3e-icon-button width="wide" variant="outlined" class="icon-tab no-drag" @click="newPage">
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
    .tab-menu {
      --md-sys-density-scale: -1;
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
