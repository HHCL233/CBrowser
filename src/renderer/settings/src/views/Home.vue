<script setup lang="ts">
document.title = '设置 - 关于CBrowser'
</script>

<template>
  <m3e-content-pane id="home">
    <m3e-heading variant="display" size="small">您与 Google</m3e-heading>
    <m3e-action-list variant="segmented" class="action-list">
      <m3e-list-item></m3e-list-item>
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
