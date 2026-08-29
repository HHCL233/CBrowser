<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Tabs from './components/Tabs.vue'
import { useElementBounding } from '@vueuse/core'

const webviewRef = useTemplateRef('webview')
const { x, y, width, height } = useElementBounding(webviewRef)

watch([x, y, width, height], ([newX, newY, newWidth, newHeight]) => {
  window.cb.window.updateSize({
    height: newHeight,
    width: newWidth,
    x: newX,
    y: newY
  })
})
</script>

<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div id="shell">
        <div :class="['density-3', 'shell-tabs']">
          <Tabs />
        </div>
        <div class="webview-div">
          <m3e-drawer-container end class="drawer-container">
            <div id="nav-drawer" slot="end" class="sidebar"><Sidebar /></div>
            <div ref="webview" class="webview"></div>
          </m3e-drawer-container>
        </div>
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
  background-color: var(--md-sys-color-surface-container-low);
  --m3e-drawer-container-color: var(--md-sys-color-surface-container-low);
  .shell-tabs {
    padding: 4px;
    box-sizing: border-box;
    width: 100%;
    height: 44px;
  }
  .webview-div {
    flex: 1;
    .drawer-container {
      height: 100%;
      .sidebar {
        width: 300px;
      }
      .webview {
        height: 100%;
      }
    }
  }
}
</style>
