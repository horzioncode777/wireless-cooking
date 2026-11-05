export function Panel({children,title}){return <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">{title&&<h2 className="mb-4 text-xl font-bold">{title}</h2>}{children}</section>;}
export function Field({label,...props}){return <label className="block text-sm font-semibold">{label}<input {...props} className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 font-normal"/></label>;}
export function Notice({children}){return children?<p role="status" className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">{children}</p>:null;}
export const buttonClass='inline-flex items-center justify-center rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white hover:bg-amber-800 disabled:opacity-50';
