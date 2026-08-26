<script setup lang="ts">
import { M3eMenuElement, M3eMenuTriggerElement } from '@m3e/web/menu'
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import type { Menu } from '../../../shared/types/menu'

/**
 * 上下文菜单窗口
 */

const x = ref('0px')
const y = ref('0px')
const menuItems = ref<Menu[]>([])
const menuRef = useTemplateRef<M3eMenuElement>('menu')
const triggerRef = useTemplateRef<M3eMenuTriggerElement>('trigger')

/** 当前请求
 * null为没有待处理的菜单 */
const activeRequestId = ref<string | null>(null)
/** 已选中的项
 * 菜单关闭时决定上报select还是dismiss */
let selectedItemId: string | null = null

const stopShowListener = window.cb.menuHost.onShow(async ({ requestId, items, x: mx, y: my }) => {
  const menu = menuRef.value
  const trigger = triggerRef.value
  if (!menu || !trigger) {
    // 组件还没就绪,立刻回报取消,避免主进程的覆盖层卡住
    window.cb.menuHost.dismiss(requestId)
    return
  }

  // 上一个菜单还开着:先无条件关掉,它自己的 toggle 处理会上报取消
  if (menu.isOpen) menu.hide()

  activeRequestId.value = requestId
  selectedItemId = null
  menuItems.value = items
  x.value = `${mx}px`
  y.value = `${my}px`

  // 等DOM把 trigger移到新坐标后再定位菜单
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await menu.show(trigger)
})

/** 菜单开合状态变化;`closed`是唯一的结果上报出口 */
const onToggle = (event: Event): void => {
  const toggleEvent = event as ToggleEvent
  if (toggleEvent.newState !== 'closed') return

  const requestId = activeRequestId.value
  if (!requestId) return
  activeRequestId.value = null

  if (selectedItemId !== null) {
    window.cb.menuHost.select(requestId, selectedItemId)
  } else {
    window.cb.menuHost.dismiss(requestId)
  }
  selectedItemId = null
}

/**
 * 记录选中项后交给菜单自行关闭
 */
const onItemClick = (itemId: string): void => {
  selectedItemId = itemId
}

/** 点击菜单外的透明区域
 * 直接关菜单
 * 结果由 onToggle 上报为取消 */
const onBackdropClick = (): void => {
  menuRef.value?.hide()
  if (activeRequestId.value && !menuRef.value?.isOpen) {
    // 菜单已经处于关闭态,toggle 不会再触发
    const requestId = activeRequestId.value
    activeRequestId.value = null
    window.cb.menuHost.dismiss(requestId)
  }
}

onBeforeUnmount(() => {
  stopShowListener()
})
</script>
<template>
  <Teleport to="body">
    <m3e-theme scheme="dark">
      <div class="menu" @click="onBackdropClick" @contextmenu.prevent>
        <div ref="trigger" class="trigger">
          <m3e-menu-trigger></m3e-menu-trigger>
        </div>
        <m3e-menu ref="menu" @click.stop @toggle="onToggle">
          <template v-for="(item, index) in menuItems" :key="`${item.id}-${index}`">
            <m3e-divider v-if="item.type === 'divider'"></m3e-divider>
            <m3e-menu-item v-else :disabled="item.disabled" @click="onItemClick(item.id)">
              <m3e-icon v-if="item.icon" slot="icon" :name="item.icon"></m3e-icon>
              {{ item.name }}
            </m3e-menu-item>
          </template>
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
