import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, RotateCcw, Sparkles, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api';
import Dialog from './Dialog';

const greeting = { text: '¡Hola! Soy el asistente de Wireless Cooking. ¿Buscas algo para tu cocina o necesitas ayuda con la web?', role: 'assistant' };
const suggestions = ['¿Qué productos tienen?', '¿Cómo hago una compra?', '¿Cómo funciona la entrega?'];
const fallbackLabels = { not_configured: 'La IA aún no está conectada. Te acompaño con la ayuda local.', daily_limit: 'Por hoy alcanzamos el límite de consultas de IA. La ayuda local sigue disponible.', unavailable: 'La IA no está disponible en este momento. Te acompaño con la ayuda local.' };

function AssistantText({ text }) {
  return text.split(/(\/?producto\/\d+\b|\/(?:productos|mis-pedidos|postventa|pqr|ayuda|contacto|envios-devoluciones|recuperar-password|registro|privacidad)\b)/g).map((part, index) => /^(?:\/?producto\/\d+|\/(?:productos|mis-pedidos|postventa|pqr|ayuda|contacto|envios-devoluciones|recuperar-password|registro|privacidad))$/.test(part) ? <Link key={index} to={part.startsWith('/') ? part : `/${part}`} className="font-semibold text-amber-900 underline underline-offset-2">{part}</Link> : part);
}

export default function ChatAssistant({ compactOnMobile = false }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState(''), [items, setItems] = useState([greeting]), [busy, setBusy] = useState(false), [mode, setMode] = useState(''), [fallback, setFallback] = useState('');
  const processing = useRef(false), messages = useRef(null), input = useRef(null);
  useEffect(() => { if (open && messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, [open, items, busy]);
  async function send(text) {
    if (!text.trim() || processing.current) return;
    processing.current = true;
    const history = items.slice(1).slice(-6).map(item => ({ role: item.role, text: item.text.slice(0, 800) }));
    setMessage(''); setItems(previous => [...previous, { role: 'user', text }]); setBusy(true);
    try {
      const data = await api('/chat', { method: 'POST', body: JSON.stringify({ message: text, history }) });
      setMode(data.mode); setFallback(data.fallbackReason || '');
      setItems(previous => [...previous, { role: 'assistant', text: data.answer }]);
    } catch (error) {
      setItems(previous => [...previous, { role: 'assistant', text: error.message }]);
    } finally { processing.current = false; setBusy(false); input.current?.focus(); }
  }
  return <div className="fixed bottom-5 right-4 z-50 print:hidden">
    {open && <Dialog label="Asistente Wireless Cooking" onClose={() => setOpen(false)} className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-3 sm:p-5">
      <section className="flex max-h-[calc(100dvh-40px)] w-full max-w-[410px] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-[#faf9f6] shadow-2xl">
        <header className="border-b border-stone-200 bg-white px-5 py-4"><div className="flex items-center justify-between gap-3"><img src="/logo.png" alt="Wireless Cooking" width="145" className="h-auto w-36"/><div className="flex items-center gap-1"><button type="button" disabled={busy} aria-label="Nueva conversación" onClick={() => { setItems([greeting]); setMode(''); setFallback(''); setMessage(''); input.current?.focus(); }} className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 disabled:opacity-40"><RotateCcw size={17}/></button><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente" className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"><X size={20}/></button></div></div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#3a5543]"><Sparkles size={14} aria-hidden="true"/>{mode === 'ia' ? 'Conectado con OpenAI' : mode === 'ayuda_local' ? 'Ayuda local' : 'Tu asistente de compras'}</div></header>
        <div ref={messages} role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" className="min-h-40 flex-1 space-y-4 overflow-y-auto px-4 py-5" style={{ maxHeight: 'min(48dvh, 400px)' }}>
          {items.map((item, index) => <div key={index} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'ml-auto rounded-br-sm bg-[#293b32] text-white' : 'mr-auto rounded-bl-sm border border-stone-200 bg-white text-stone-700'}`}><span className="sr-only">{item.role === 'user' ? 'Tú: ' : 'Asistente: '}</span><p className="whitespace-pre-wrap break-words">{item.role === 'assistant' ? <AssistantText text={item.text}/> : item.text}</p></div>)}
          {busy && <p role="status" className="flex items-center gap-2 px-2 text-xs text-stone-500"><LoaderCircle size={15} className="checkout-spinner" aria-hidden="true"/>Estoy consultando…</p>}
          {items.length === 1 && <div className="flex flex-wrap gap-2">{suggestions.map(text => <button key={text} type="button" onClick={() => send(text)} disabled={busy} className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:border-amber-700">{text}</button>)}</div>}
        </div>
        <div className="border-t border-stone-200 bg-white p-4">{fallback && <p role="status" className="mb-3 text-xs leading-5 text-stone-600">{fallbackLabels[fallback]}</p>}<form onSubmit={event => { event.preventDefault(); send(message); }} className="flex gap-2"><input ref={input} aria-label="Tu pregunta" required maxLength={1500} value={message} onChange={event => setMessage(event.target.value)} placeholder="¿En qué te puedo ayudar?" className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 text-sm"/><button type="submit" disabled={busy || !message.trim()} aria-label="Enviar pregunta" className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#293b32] text-white disabled:opacity-40"><Send size={18}/></button></form><p className="mt-3 text-[11px] leading-4 text-stone-500">Al enviar, tu pregunta y los mensajes recientes se procesan con OpenAI cuando está disponible. No incluyas datos privados. <Link to="/privacidad" className="underline">Privacidad</Link></p><Link to="/contacto" className="mt-3 flex min-h-9 items-center justify-between gap-2 text-xs font-bold text-amber-900">Necesito atención del equipo<ArrowUpRight size={15} aria-hidden="true"/></Link></div>
      </section>
    </Dialog>}
    <button aria-expanded={open} aria-label={open ? 'Cerrar chat' : 'Abrir asistente de Wireless Cooking'} onClick={() => setOpen(!open)} className={`chat-launcher${compactOnMobile ? ' chat-launcher--compact-mobile' : ''}${open ? ' is-open' : ''}`}>
      <span className="chat-launcher-icon" aria-hidden="true"><MessageCircle size={25} strokeWidth={1.8}/><span className="chat-launcher-spark"><Sparkles size={12} strokeWidth={2}/></span></span>
      <span className="chat-launcher-copy"><span className="chat-launcher-caption">WIRELESS COOKING</span><span className="chat-launcher-title">¿Te ayudamos?</span><span className="chat-launcher-detail">Tu asistente de cocina</span></span>
      <ArrowUpRight className="chat-launcher-arrow" size={18} aria-hidden="true"/>
    </button>
  </div>;
}
