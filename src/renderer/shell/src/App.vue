<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import type { TabsState } from '../../../shared/types/tabs'
import Tabs from './components/Tabs.vue'
//const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
//window.electron.ipcRenderer.invoke('ping')

const tabsState = ref<TabsState>({
  currentTabId: '',
  loadingTabId: [],
  sortTabs: [],
  tabs: []
})

const handleTabsChanged = async (): Promise<void> => {
  console.log('收到主进程send过来的数据')
  tabsState.value = (await window.electron.ipcRenderer.invoke('sync-tabs', 'get')) as TabsState
}

// 注册监听
window.electron.ipcRenderer.on('update-tabs', handleTabsChanged)

onUnmounted(() => {
  // 取消监听
  window.electron.ipcRenderer.removeAllListeners('update-tabs')
})
</script>

<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div id="shell">
        <div :class="['density-3', 'shell-tabs']">
          <Tabs />
        </div>
        <div class="webview-div"></div>
      </div>
    </m3e-theme>
  </Teleport>
</template>
<style lang="scss" scoped>
#shell {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .shell-tabs {
    padding: 4px;
    box-sizing: border-box;
    width: 100%;
    height: 44px;
  }
  .webview-div {
    flex: 1;
  }
}
</style>
