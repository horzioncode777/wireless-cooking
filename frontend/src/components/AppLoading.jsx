// Keep this markup in sync with the initial loader in index.html.
// Its stylesheet is loaded in the document head, before React starts.
export default function AppLoading() {
  return (
    <section className="wc-loading" aria-label="Cargando Wireless Cooking">
      <div className="wc-loading__card">
        <div className="wc-loading__brand">
          <img src="/logo.png" alt="Wireless Cooking" width="467" height="211" fetchPriority="high" />
        </div>
        <p className="wc-loading__eyebrow">Hecho para conectar</p>
        <h1 className="wc-loading__title">El buen gusto empieza aquí.</h1>
        <p className="wc-loading__description">Cocina, artesanía y comercio local.</p>
        <div className="wc-loading__track" aria-hidden="true"><span /></div>
        <p className="wc-loading__status" role="status">
          <span className="wc-loading__dot" aria-hidden="true" />
          Cargando tu experiencia…
        </p>
      </div>
    </section>
  );
}
