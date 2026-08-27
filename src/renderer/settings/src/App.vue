<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRouter } from 'vue-router'

const router = useRouter()
const currentRouter = computed(() => router.currentRoute.value)
</script>

<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div id="settings">
        <m3e-app-bar>
          <m3e-icon-button slot="leading" aria-label="Menu" toggle>
            <m3e-icon name="menu"></m3e-icon>
            <m3e-icon slot="selected" name="menu_open"></m3e-icon>
            <m3e-drawer-toggle for="nav-drawer"></m3e-drawer-toggle>
          </m3e-icon-button>
          <span slot="title">设置</span>
        </m3e-app-bar>
        <m3e-drawer-container class="drawer-container" start-mode="auto">
          <div id="nav-drawer" slot="start">
            <m3e-nav-menu>
              <m3e-nav-menu-item
                v-for="(value, index) in router.getRoutes()"
                :key="index"
                :selected="currentRouter.name === value.name"
              >
                <m3e-icon
                  slot="icon"
                  :name="value.meta.icon ?? 'info'"
                  aria-hidden="true"
                ></m3e-icon>
                <span slot="label">{{ value.meta.name ?? '' }}</span>
              </m3e-nav-menu-item>
            </m3e-nav-menu>
          </div>
          <div class="content-container-div">
            <RouterView />
          </div>
        </m3e-drawer-container>
      </div>
    </m3e-theme>
  </Teleport>
</template>
<style lang="scss" scoped>
#settings {
  height: 100vh;
  display: flex;
  flex-direction: column;
  .drawer-container {
    height: 100%;
    flex: 1;
    .content-container-div {
      height: 100%;
    }
  }
}
</style>
