import { createApp } from 'vue'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.vue'
import { i18n } from './i18n'
import { initGoogleAnalytics } from './services/googleAnalytics'

initGoogleAnalytics()
createApp(App).use(i18n).mount('#app')
