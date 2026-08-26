<script setup lang="ts">
import { M3eMenuElement, M3eMenuTriggerElement } from '@m3e/web/menu'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { Menu } from '../../../shared/types/menu'
import { IpcRendererEvent } from 'electron'

const x = ref('0px')
const y = ref('0px')
const menuRef = useTemplateRef<M3eMenuElement>('menu')
const menuItems = ref<Menu[]>([])
const triggerButton = useTemplateRef<M3eMenuTriggerElement>('trigger')

onMounted(() => {})

const handleContextMenu = (
  _: IpcRendererEvent,
  menuString: string,
  mouseX: number,
  mouseY: number
): void => {
  if (!menuRef.value || !triggerButton.value) return

  x.value = `${mouseX}px`
  y.value = `${mouseY}px`
  const menu = JSON.parse(menuString) as Menu[]
  menuItems.value = menu

  menuRef.value.show(triggerButton.value)
}

const clickBackground = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  window.electron.ipcRenderer.send('context-menu-event', 'background', [])
}

const clickContextMenuItem = async (itemId: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  window.electron.ipcRenderer.send('context-menu-event', 'item', [itemId])
}

// 注册监听
window.electron.ipcRenderer.on('context-menu', handleContextMenu)

onUnmounted(() => {
  // 取消监听
  window.electron.ipcRenderer.removeAllListeners('context-menu')
})
</script>
<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div class="menu" @click="clickBackground">
        <div ref="trigger" class="trigger">
          <m3e-menu-trigger></m3e-menu-trigger>
        </div>
        <m3e-menu ref="menu" @click.stop>
          <m3e-menu-item
            v-for="(item, index) in menuItems"
            :key="index"
            @click="clickContextMenuItem(item.id)"
          >
            <m3e-icon slot="icon" :name="item.icon"></m3e-icon>
            {{ item.name }}
          </m3e-menu-item>
        </m3e-menu>
      </div>
    </m3e-theme>
  </Teleport>
</template>
<style lang="scss" scoped>
.menu {
  background-color: rgba(255, 0, 0, 0);
  width: 100vw;
  height: 100vh;
  .trigger {
    position: fixed;
    top: v-bind(y);
    left: v-bind(x);
  }
}
</style>
