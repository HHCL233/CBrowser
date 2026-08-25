<script setup lang="ts">
import browserInfo from '../../../../../package.json'

document.title = '设置 - 关于CBrowser'

const clickOSList = (): void => {
  alert('但是我现在还没有整理')
}
</script>

<template>
  <m3e-content-pane id="home">
    <m3e-heading variant="display" size="small">关于 {{ browserInfo.name }}</m3e-heading>
    <m3e-action-list variant="segmented" class="action-list">
      <m3e-list-item>版本 {{ browserInfo.version }}</m3e-list-item>
      <!-- Additional actions omitted for brevity -->
    </m3e-action-list>
    <m3e-action-list variant="segmented" class="action-list">
      <m3e-list-item>
        <span>
          {{ browserInfo.name }} 的诞生离不开
          <a href="https://www.chromium.org/" target="_blank">Chromium</a>
          开源项目以及其他
          <a variant="text" class="button-text" href="" @click.prevent="clickOSList">开源软件</a>。
        </span>
      </m3e-list-item>
      <!-- Additional actions omitted for brevity -->
    </m3e-action-list>
  </m3e-content-pane>
</template>

<style lang="scss" scoped>
#home {
  height: 100%;
  --m3e-content-pane-container-color: var(--md-sys-color-surface-container-lowest);
  .action-list {
    margin: 16px 0;
    .item-text {
      display: inline-flex;
      align-items: center;
    }
  }
}
</style>
