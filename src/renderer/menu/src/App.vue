<script setup lang="ts">
import { M3eMenuElement, M3eMenuTriggerElement } from '@m3e/web/menu'
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import type { Menu } from '../../../shared/types/menu'

/**
 * 上下文菜单窗口。
 *
 * 旧实现的同步问题:
 * - 点击后先 `await setTimeout(200)` 再上报,这 200ms 内主进程状态可能已经变了,
 *   而且没有任何配对信息,连开两次菜单时结果会串台。
 * - 只在点击背景时上报「取消」,用 Esc 关闭或点击菜单外部由 m3e 自己关掉菜单时,
 *   主进程收不到通知,覆盖层就一直挡在页面上。
 *
 * 现在:每个请求带 requestId,菜单的 `toggle` 事件是唯一的关闭出口,
 * 无论怎么关都会上报一次且只上报一次。
 */

const x = ref('0px')
const y = ref('0px')
const menuItems = ref<Menu[]>([])
const menuRef = useTemplateRef<M3eMenuElement>('menu')
const triggerRef = useTemplateRef<M3eMenuTriggerElement>('trigger')

/** 当前请求;为 null 表示没有待处理的菜单 */
const activeRequestId = ref<string | null>(null)
/** 已选中的项;菜单关闭时决定上报 select 还是 dismiss */
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

  // 等 DOM 把 trigger 移到新坐标后再定位菜单,否则首帧会显示在旧位置
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await menu.show(trigger)
})

/** 菜单开合状态变化;`closed` 是唯一的结果上报出口 */
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
 * 记录选中项后交给菜单自行关闭。
 *
 * m3e 的 menu-item 被点击时会自动 `hideAll()`,所以这里不手动 hide,
 * 只留下选择结果,由 `onToggle` 统一上报 —— 保证「关闭」和「上报」一一对应。
 */
const onItemClick = (itemId: string): void => {
  selectedItemId = itemId
}

/** 点击菜单外的透明区域:直接关菜单,结果由 onToggle 上报为取消 */
const onBackdropClick = (): void => {
  menuRef.value?.hide()
  if (activeRequestId.value && !menuRef.value?.isOpen) {
    // 菜单已经处于关闭态,toggle 不会再触发,这里兜底上报
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
