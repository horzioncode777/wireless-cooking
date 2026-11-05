import { fail } from '../utils/http.js';

export function wompiSettings(env = process.env) {
  const mode = env.PAYMENT_MODE === 'demo' && env.NODE_ENV !== 'production' ? 'demo' : 'wompi';
  const environment = env.WOMPI_ENVIRONMENT === 'prod' ? 'prod' : 'test';
  const publicKey = String(env.WOMPI_PUBLIC_KEY || '').trim();
  const privateKey = String(env.WOMPI_PRIVATE_KEY || '').trim();
  const integritySecret = String(env.WOMPI_INTEGRITY_SECRET || '').trim();
  const eventsSecret = String(env.WOMPI_EVENTS_SECRET || '').trim();
  const configured = publicKey.startsWith(environment === 'test' ? 'pub_test_' : 'pub_prod_') && privateKey.startsWith(environment === 'test' ? 'prv_test_' : 'prv_prod_') && !!integritySecret && !!eventsSecret;
  return { mode, environment, configured, publicKey, privateKey, integritySecret, eventsSecret, apiOrigin: environment === 'test' ? 'https://sandbox.wompi.co' : 'https://production.wompi.co' };
}

export function validateTransactionId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{3,100}$/.test(id)) throw fail(400, 'Identificador de transacción inválido.');
  return id;
}

export function wompiRedirectUrl(frontendUrl, orderId) {
  try {
    const url=new URL(frontendUrl);
    // Wompi's CloudFront rejects localhost in redirect-url, even in Sandbox.
    if(url.protocol!=='https:'||url.username||url.password||/^(localhost|127\.|\[?::1\]?)/i.test(url.hostname)||url.hostname.endsWith('.localhost')) return undefined;
    return `${url.origin}/pedido/${orderId}`;
  } catch { return undefined; }
}

export async function fetchWompiTransaction(id, { env = process.env, fetchImpl = fetch } = {}) {
  validateTransactionId(id);
  const config = wompiSettings(env);
  const prefix = config.environment === 'test' ? 'prv_test_' : 'prv_prod_';
  if (!config.privateKey.startsWith(prefix)) throw fail(503, 'Falta configurar la llave privada de Wompi para consultar los pagos.');
  const response = await fetchImpl(`${config.apiOrigin}/v1/transactions/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${config.privateKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw fail(response.status === 404 ? 404 : 502, response.status === 404 ? 'La transacción no se encontró en Wompi.' : 'No se pudo consultar la transacción con Wompi. Intenta de nuevo.');
  const transaction = (await response.json()).data;
  if (!transaction || transaction.id !== id || typeof transaction.reference !== 'string' || !['APPROVED','DECLINED','VOIDED','ERROR','PENDING'].includes(transaction.status) || !Number.isSafeInteger(transaction.amount_in_cents) || transaction.amount_in_cents <= 0) throw fail(502, 'Wompi devolvió una transacción no válida.');
  return transaction;
}
