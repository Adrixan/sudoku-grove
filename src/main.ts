import './ui/styles.css';
import { startApp } from './ui/app.ts';

startApp();

// Offline support only in the built site; the worker's scope is this game's folder.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* offline mode unavailable; the game still works online */
    });
  });
}
