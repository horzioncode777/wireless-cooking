import { API_URL } from './api';

const subscribers = new Set();
let source, fallback, refreshTimer;
function notify() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { for (const callback of subscribers) callback(); },120);
}
function connect() {
  if (source || document.hidden || !subscribers.size) return;
  source = new EventSource(`${API_URL}/api/catalog/events`);
  source.addEventListener('catalog',notify);
  source.onopen = () => { clearInterval(fallback); fallback = null; };
  source.onerror = () => {
    if (!fallback) fallback = setInterval(notify,15000);
  };
}
function disconnect() { source?.close(); source = null; clearInterval(fallback); fallback = null; }
function visibility() { if (document.hidden) disconnect(); else { notify(); connect(); } }
export function subscribeCatalog(callback) {
  subscribers.add(callback);
  if (subscribers.size===1) {
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('online',visibility);
    window.addEventListener('focus',notify);
    window.addEventListener('catalog:personalization',notify);
  }
  connect();
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) {
      disconnect(); clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('online',visibility);
      window.removeEventListener('focus',notify);
      window.removeEventListener('catalog:personalization',notify);
    }
  };
}
