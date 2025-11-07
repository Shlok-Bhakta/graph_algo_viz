import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import Screensaver from './Screensaver.svelte'

const isScreensaver = window.location.pathname === '/screensaver' || window.location.search.includes('screensaver');

let screensaverProps = {};

if (isScreensaver) {
  const urlParams = new URLSearchParams(window.location.search);
  const algosParam = urlParams.get('algorithms') || urlParams.get('algos');
  
  if (algosParam) {
    const algorithms = algosParam.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    screensaverProps = { algorithms };
  }
}

const app = mount(isScreensaver ? Screensaver : App, {
  target: document.getElementById('app')!,
  props: isScreensaver ? screensaverProps : {}
})

export default app
