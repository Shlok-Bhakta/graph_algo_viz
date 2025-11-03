import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import Screensaver from './Screensaver.svelte'

const isScreensaver = window.location.pathname === '/screensaver' || window.location.search.includes('screensaver');

const app = mount(isScreensaver ? Screensaver : App, {
  target: document.getElementById('app')!,
})

export default app
