<script setup lang="ts">
import Tabs from './components/Tabs.vue'

/**
 * 这里不再自己订阅标签页状态。
 *
 * 旧实现在 App.vue 和 Tabs.vue 各订阅一次 `update-tabs`,并在卸载时调用
 * `removeAllListeners('update-tabs')`,导致其中一个组件卸载后另一个也收不到
 * 更新。现在状态统一由 `stores/tabs.ts` 单例维护,组件只消费。
 */
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
