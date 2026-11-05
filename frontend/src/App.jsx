import { Suspense } from "react";
import AppRouter from "./routes/AppRouter";
import NotificationProvider from './components/NotificationProvider';
import AppLoading from './components/AppLoading';

export default function App() {
  return <NotificationProvider><Suspense fallback={<AppLoading />}><AppRouter /></Suspense></NotificationProvider>;
}
