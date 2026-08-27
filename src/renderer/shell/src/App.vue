<script setup lang="ts">
import Tabs from './components/Tabs.vue'

/**
 * 不再自己订阅标签页状态
 */
</script>

<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div id="shell">
        <div :class="['density-3', 'shell-tabs']">
          <Tabs />
        </div>
        <div class="webview-div">
          <h1>无法加载此页面</h1>
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
