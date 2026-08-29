<script setup lang="ts"></script>
<template>
  <div id="sidebar">
    <m3e-app-bar class="app-bar" for="sidebar">
      <m3e-icon-button slot="leading" aria-label="Back">
        <m3e-icon name="arrow_back"></m3e-icon>
      </m3e-icon-button>
      <span slot="title">首页</span>
    </m3e-app-bar>
    <div class="content">
      <m3e-action-list variant="segmented" class="action-list">
        <m3e-list-action>我是傻逼</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
        <m3e-list-action>你好</m3e-list-action>
      </m3e-action-list>
    </div>
  </div>
</template>
<style lang="scss" scoped>
#sidebar {
  width: 300px;
  box-sizing: border-box;
  overflow-y: auto;
  height: 100%;
  .app-bar {
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .content {
    padding: 12px;
  }
}
</style>
