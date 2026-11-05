import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import InformationLayout from '../components/InformationLayout';
import { informationPages } from '../services/publicInformation';

export default function PublicInformation({ topic }) {
  const page = informationPages[topic];
  return <InformationLayout eyebrow={page.eyebrow} title={page.title} description={page.description}>
    {page.notice && <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">{page.notice}</p>}
    <article className="information-paper">
      <div className="mb-7 flex items-center gap-2 border-b border-stone-100 pb-5 text-xs font-semibold text-stone-500"><FileText size={16} aria-hidden="true"/>Actualizado el 21 de octubre de 2026</div>
      <nav aria-label="En esta página" className="mb-8 flex flex-wrap gap-2">{page.sections.map(section => <a key={section.id} href={`#${section.id}`} className="rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:border-amber-700 hover:text-amber-900">{section.title.replace(/^\d\. /, '')}</a>)}</nav>
      <div className="space-y-9">{page.sections.map(section => <section id={section.id} key={section.id} className="scroll-mt-52"><h2 className="text-xl font-bold text-[#293b32]">{section.title}</h2><div className="mt-3 space-y-3 text-[15px] leading-7 text-stone-600">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>{section.link && <Link to={section.link} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-amber-900">{section.action}<ArrowRight size={16} aria-hidden="true"/></Link>}</section>)}</div>
      {page.source && <p className="mt-9 border-t border-stone-100 pt-5 text-sm"><a href={page.source.href} target="_blank" rel="noreferrer" className="text-amber-900 underline underline-offset-4">{page.source.label}<span className="sr-only"> (abre en otra pestaña)</span></a></p>}
    </article>
  </InformationLayout>;
}
