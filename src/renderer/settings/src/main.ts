import './assets/main.scss'
import './assets/icons/m3.css'
import './assets/fonts/googlesans.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router/router.ts'

import '@m3e/web/all'

createApp(App).use(router).mount('#app')
