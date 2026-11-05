// In production the web and API share one public origin. A separate API remains optional.
export function resolveApiUrl({ configuredUrl, production = false, origin = '' } = {}) {
  const configured = configuredUrl?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  return production ? origin : 'http://localhost:6001';
}

export const API_URL = resolveApiUrl({
  configuredUrl: import.meta.env?.VITE_API_URL,
  production: import.meta.env?.PROD,
  origin: globalThis.location?.origin,
});
