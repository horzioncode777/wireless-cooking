import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
const Home = lazy(() => import("../pages/Home"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ProductDetail = lazy(() => import("../pages/ProductDetail"));
const Products = lazy(() => import("../pages/Products"));
const Cart = lazy(() => import("../pages/Cart"));
const Checkout = lazy(() => import("../pages/Checkout"));
const SellerOrder = lazy(() => import("../pages/SellerOrder"));
const SellerDispatchOrders = lazy(() => import('../pages/SellerDispatchOrders'));
const ShippingGuide = lazy(() => import('../pages/ShippingGuide'));
const SellerWallet = lazy(() => import('../pages/SellerWallet'));
const AdminWallets = lazy(() => import('../pages/admin/AdminWallets'));
const SellerDashboard = lazy(() => import("../pages/SellerDashboard"));
import Favorites from  "../pages/Favorites";
const AccountSettings = lazy(() => import("../pages/AccountSettings"));
const Profile = lazy(() => import("../pages/Profile"));
const ProfileProducts = lazy(() => import("../pages/ProfileProducts"));
const CrearProducto = lazy(() => import("../pages/CrearProducto"));
const EditarProducto = lazy(() => import("../pages/EditarProducto"));

import AdminRoute from "./AdminRoute";
import AdminLayout from "../components/admin/AdminLayout";
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("../pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("../pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers"));
const AdminSellers = lazy(() => import("../pages/admin/AdminSellers"));
const AdminReports = lazy(() => import("../pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("../pages/admin/AdminSettings"));
import ProtectedRoute from './ProtectedRoute';
const Pqr = lazy(() => import("../pages/Pqr"));
const AfterSales = lazy(() => import('../pages/AfterSales'));
const Marketplace = lazy(() => import("../pages/Marketplace"));
const PublicStore = lazy(() => import('../pages/PublicStore'));
const Order = lazy(() => import("../pages/Order"));
const Orders = lazy(() => import("../pages/Orders"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const Help = lazy(() => import("../pages/Help"));
const Contact = lazy(() => import('../pages/Contact'));
const PublicInformation = lazy(() => import('../pages/PublicInformation'));
const Notifications = lazy(() => import('../pages/Notifications'));

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/recuperar-password" element={<ForgotPassword />} />
      <Route path="/restablecer-password" element={<ResetPassword />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/tienda/:id" element={<PublicStore />} />
      <Route path="/ayuda" element={<Help />} />
      <Route path="/contacto" element={<Contact />} />
      <Route path="/nosotros" element={<PublicInformation topic="nosotros" />} />
      <Route path="/terminos" element={<PublicInformation topic="terminos" />} />
      <Route path="/privacidad" element={<PublicInformation topic="privacidad" />} />
      <Route path="/envios-devoluciones" element={<PublicInformation topic="envios" />} />
      <Route element={<ProtectedRoute />}>
      <Route path="/pqr" element={<Pqr />} />
      <Route path="/postventa" element={<AfterSales />} />
      <Route path="/pedido/:id/guia/:seller" element={<ShippingGuide />} />
      <Route path="/postventa/:id/guia" element={<ShippingGuide returning />} />
      <Route path="/notificaciones" element={<Notifications />} />
      <Route path="/mis-pedidos" element={<Orders />} />
      <Route path="/pedido/:id" element={<Order />} />
      <Route path="/favoritos" element={<Favorites />} />
      <Route path="/perfil" element={<Profile />} />
      <Route path="/configuracion" element={<AccountSettings />} />
      </Route>
      <Route path="/productos" element={<Products />} />
      <Route path="/producto/:id" element={<ProductDetail />} />
      <Route element={<ProtectedRoute />}>
      <Route path="/carrito" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      </Route>
      <Route element={<ProtectedRoute seller />}>
      <Route path="/perfil-vendedor" element={<ProfileProducts />} />
      <Route path="/vendedor" element={<SellerDashboard />} />
      <Route path="/vendedor/monedero" element={<SellerWallet />} />
      <Route path="/vendedor/pedido/:id" element={<SellerOrder />} />
      <Route path="/vendedor/pedidos-por-enviar" element={<SellerDispatchOrders />} />
      <Route path="/crear-producto" element={<CrearProducto />} />
      <Route path="/editar-producto/:id" element={<EditarProducto />} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="productos" element={<AdminProducts />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="usuarios" element={<AdminUsers />} />
          <Route path="vendedores" element={<AdminSellers />} />
          <Route path="reportes" element={<AdminReports />} />
          <Route path="pqr" element={<Pqr admin />} />
          <Route path="postventa" element={<AfterSales admin />} />
          <Route path="monederos" element={<AdminWallets />} />
          <Route path="configuracion" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Help />} />
    </Routes>
  );
}
