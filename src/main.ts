import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import Screensaver from './Screensaver.svelte'

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const path = window.location.pathname.startsWith(base)
  ? window.location.pathname.slice(base.length) || '/'
  : window.location.pathname;
const params = new URLSearchParams(window.location.search);
const isScreensaver =
  path === '/screensaver' ||
  params.has('screensaver') ||
  params.has('play');

const app = mount(isScreensaver ? Screensaver : App, {
  target: document.getElementById('app')!,
})

export default app
