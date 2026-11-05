import Navbar from "../Navbar";
import Footer from "../Footer";
import ChatAssistant from '../ChatAssistant';

export default function MainLayout({ children, hideAssistant = false, compactAssistant = false }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:p-4">Saltar al contenido</a>
      <Navbar />
      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
      <Footer />
      {!hideAssistant && <ChatAssistant compactOnMobile={compactAssistant} />}
    </div>
  );
}
