import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const prefixes = ['m3e-', 'webview']

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer/shell': resolve('src/renderer/shell/src'),
        '@renderer/settings': resolve('src/renderer/settings/src')
      }
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // treat all tags with a dash as custom elements
            isCustomElement: (tag) => prefixes.some((prefix) => tag.startsWith(prefix))
          }
        }
      })
    ],
    build: {
      rollupOptions: {
        input: {
          // 主页面
          main: resolve('src/renderer/shell/index.html'),
          // 独立设置页面
          settings: resolve('src/renderer/settings/index.html'),
          // 菜单页面
          menu: resolve('src/renderer/menu/index.html')
        }
      }
    }
  }
})
