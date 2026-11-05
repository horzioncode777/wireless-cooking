import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, ArrowRight } from 'lucide-react';
import InformationLayout from '../components/InformationLayout';
import { commonQuestions } from '../services/publicInformation';

const groups = ['Todas', ...new Set(commonQuestions.map(item => item.group))];
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Help() {
  const [query, setQuery] = useState(''), [group, setGroup] = useState('Todas');
  const questions = commonQuestions.filter(item => (group === 'Todas' || item.group === group) && normalize(`${item.question} ${item.answer}`).includes(normalize(query.trim())));
  return <InformationLayout eyebrow="RESPUESTAS A MANO" title="¿En qué te ayudamos?" description="Encuentra respuestas sobre tu cuenta, compras, entregas y cómo empezar a vender.">
    <div className="information-paper min-w-0">
      <label htmlFor="help-search" className="text-sm font-bold">Busca tu pregunta</label><div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-3 sm:gap-3 sm:px-4"><Search size={20} aria-hidden="true" className="shrink-0 text-stone-500"/><input id="help-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Contraseña, entrega, pago…" className="min-h-13 min-w-0 flex-1 bg-transparent text-base sm:text-sm"/></div>
      <div role="group" aria-label="Filtrar por tema" className="mt-5 flex flex-wrap gap-2">{groups.map(item => <button type="button" key={item} onClick={() => setGroup(item)} aria-pressed={group === item} className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold sm:px-4 ${group === item ? 'border-[#293b32] bg-[#293b32] text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{item}</button>)}</div>
      <p role="status" className="mt-5 text-xs text-stone-500">{questions.length} {questions.length === 1 ? 'respuesta disponible' : 'respuestas disponibles'}</p>
      <div className="mt-3 min-w-0 divide-y divide-stone-100">{questions.map(item => <details key={item.question} className="group min-w-0 py-1"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm leading-6 font-semibold sm:gap-4 sm:text-[15px]"><span className="min-w-0 break-words">{item.question}</span><ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180"/></summary><div className="break-words pb-5 text-sm leading-7 text-stone-600"><p>{item.answer}</p>{item.path && <Link to={item.path} className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 font-bold text-amber-900"><span className="min-w-0">{item.action}</span><ArrowRight size={15} aria-hidden="true" className="shrink-0"/></Link>}</div></details>)}</div>
      {!questions.length && <div className="py-8 text-center"><h2 className="font-bold">No encontramos esa pregunta</h2><p className="mt-2 text-sm text-stone-600">Prueba otra palabra o consulta directamente con soporte.</p><button onClick={() => { setQuery(''); setGroup('Todas'); }} className="mt-4 min-h-11 px-4 text-sm font-bold text-amber-900 underline">Ver todas las preguntas</button></div>}
    </div>
    <div className="mt-5 flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-2xl bg-[#ecefe8] p-5 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:p-6"><div className="min-w-0"><h2 className="font-bold leading-6">¿Tu pregunta sigue sin respuesta?</h2><p className="mt-2 text-sm leading-6 text-stone-600">Cuéntanos qué necesitas y te orientamos.</p></div><Link to="/contacto" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#293b32] px-4 py-3 text-sm font-bold text-white">Contactar con soporte<ArrowRight size={16} aria-hidden="true" className="shrink-0"/></Link></div>
  </InformationLayout>;
}
