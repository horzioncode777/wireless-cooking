import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
  import { useState } from "react";
  import { Link, useNavigate } from "react-router-dom";
  import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Store,
    Phone,
    MapPin,
    FileText,
    BadgeCheck,
    ShoppingBag,
  } from "lucide-react";
  import MainLayout from "../components/layout/MainLayout";



  export default function Register() {
    const navigate = useNavigate();

    const [accountType, setAccountType] = useState("buyer");

    const [form, setForm] = useState({
      name: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      storeName: "",
      phone: "",
      document: "",
      address: "",
      businessAddress: "",
      city: "",
      description: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
      const { name, value } = e.target;

      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));

      setErrors((prev) => ({
        ...prev,
        [name]: "",
        general: "",
      }));
    };

    const validateForm = () => {
      const newErrors = {};

      if (!form.name.trim()) {
        newErrors.name = "El nombre es obligatorio";
      }

      if (!form.email.trim()) {
        newErrors.email = "El correo es obligatorio";
      } else if (!/\S+@\S+\.\S+/.test(form.email)) {
        newErrors.email = "Ingresa un correo válido";
      }

      if (!form.password.trim()) {
        newErrors.password = "La contraseña es obligatoria";
      } else if (form.password.length < 6) {
        newErrors.password = "La contraseña debe tener al menos 6 caracteres";
      }

      if (!form.confirmPassword.trim()) {
        newErrors.confirmPassword = "Debes confirmar la contraseña";
      } else if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }

      if (accountType === "seller") {
        if (!form.storeName.trim()) {
          newErrors.storeName = "El nombre de la tienda es obligatorio";
        }

        if (!form.phone.trim()) {
          newErrors.phone = "El teléfono es obligatorio para vendedores";
        }
      }

      return newErrors;
    };

    const normalizeRole = (role) => {
      if (!role) return "comprador";

      const cleanRole = String(role).trim().toLowerCase();

      if (
        cleanRole === "vendedor" ||
        cleanRole === "seller" ||
        cleanRole === "vendor"
      ) {
        return "vendedor";
      }

      if (cleanRole === "admin" || cleanRole === "administrador") {
        return "admin";
      }

      return "comprador";
    };

    const redirectByRole = (role) => {
      const normalizedRole = normalizeRole(role);

      if (normalizedRole === "vendedor") {
        navigate("/vendedor", { replace: true });
        return;
      }

      if (normalizedRole === "admin") {
        navigate("/vendedor", { replace: true });
        return;
      }

      navigate("/perfil", { replace: true });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();

      const validationErrors = validateForm();

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      try {
        setIsSubmitting(true);
        setErrors({});

        const endpoint =
          accountType === "seller"
            ? `${API_URL}/api/auth/register/seller`
            : `${API_URL}/api/auth/register/buyer`;

        const payload =
          accountType === "seller"
            ? {
                nombre: form.name.trim(),
                apellido: form.lastName.trim(),
                correo: form.email.trim().toLowerCase(),
                password: form.password,
                telefono: form.phone.trim(),
                direccion:
                  form.businessAddress.trim() || form.address.trim() || null,
                nombre_tienda: form.storeName.trim(),
                descripcion: form.description.trim() || null,
              }
            : {
                nombre: form.name.trim(),
                apellido: form.lastName.trim(),
                correo: form.email.trim().toLowerCase(),
                password: form.password,
                telefono: form.phone.trim() || null,
                direccion: form.address.trim() || null,
              };

        const response = await appFetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          setErrors({
            general: data.message || "No se pudo crear la cuenta.",
          });
          return;
        }

        const userData = {
          ...(data.user || {}),
          rol: normalizeRole(data?.user?.rol),
        };

        localStorage.setItem("token", data.token || "");
        localStorage.setItem("user", JSON.stringify(userData));

        redirectByRole(userData.rol);
      } catch (error) {
        console.error("register error:", error);
        setErrors({
          general:
            "No se pudo conectar con el servidor. Verifica que el backend esté encendido.",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <MainLayout hideAssistant>
        <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-12">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_80px_rgba(0,0,0,0.08)] lg:grid-cols-2">
            <div className="hidden flex-col justify-between bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-10 text-white lg:flex">
              <div>
                <p className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-medium backdrop-blur-sm">
                  Wireless Cooking
                </p>

                <h1 className="text-4xl font-extrabold leading-tight">
                  Crea tu cuenta y empieza hoy
                </h1>

                <p className="mt-4 max-w-md text-white/90">
                  Regístrate como comprador para explorar y comprar, o como
                  vendedor para publicar y gestionar tus productos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                    <ShoppingBag size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">Compra fácil</h3>
                  <p className="mt-1 text-sm text-white/90">
                    Descubre productos únicos, guarda favoritos y compra en pocos
                    pasos.
                  </p>
                </div>

                <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                    <Store size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">Vende tu catálogo</h3>
                  <p className="mt-1 text-sm text-white/90">
                    Crea tu perfil de vendedor y comienza a ofrecer tus productos.
                  </p>
                </div>

                <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                    <BadgeCheck size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">Todo organizado</h3>
                  <p className="mt-1 text-sm text-white/90">
                    Administra tu cuenta, tus compras o tu tienda desde un solo
                    lugar.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
              <div className="w-full max-w-xl">
                <div className="mb-8">
                  <p className="mb-3 inline-flex rounded-full bg-orange-100 px-4 py-1 text-sm font-semibold text-orange-600">
                    Registro de usuario
                  </p>

                  <h2 className="text-3xl font-bold text-gray-900">
                    Crear cuenta
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Selecciona el tipo de cuenta y completa la información.
                  </p>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAccountType("buyer")}
                    className={`rounded-3xl border p-5 text-left transition ${
                      accountType === "buyer"
                        ? "border-orange-500 bg-orange-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                    }`}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <User
                        size={22}
                        className={
                          accountType === "buyer"
                            ? "text-orange-500"
                            : "text-gray-500"
                        }
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Comprador</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Para explorar productos, guardar favoritos y comprar.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("seller")}
                    className={`rounded-3xl border p-5 text-left transition ${
                      accountType === "seller"
                        ? "border-orange-500 bg-orange-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                    }`}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Store
                        size={22}
                        className={
                          accountType === "seller"
                            ? "text-orange-500"
                            : "text-gray-500"
                        }
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Vendedor</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Para registrar tu tienda y publicar tus productos.
                    </p>
                  </button>
                </div>

                {errors.general && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errors.general}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="register-field-1" className="mb-2 block text-sm font-semibold text-gray-700">
                        Nombre
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <User size={18} className="text-gray-400" />
                        <input id="register-field-1"
                          type="text"
                          name="name"
                          placeholder="Juan"
                          value={form.name}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                      </div>
                      {errors.name && (
                        <p className="mt-2 text-sm text-red-500">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-field-2" className="mb-2 block text-sm font-semibold text-gray-700">
                        Apellido
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <User size={18} className="text-gray-400" />
                        <input id="register-field-2"
                          type="text"
                          name="lastName"
                          placeholder="Delgado"
                          value={form.lastName}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="register-field-3" className="mb-2 block text-sm font-semibold text-gray-700">
                        Correo electrónico
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <Mail size={18} className="text-gray-400" />
                        <input id="register-field-3"
                          type="email"
                          name="email"
                          placeholder="correo@ejemplo.com"
                          value={form.email}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-2 text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-field-4" className="mb-2 block text-sm font-semibold text-gray-700">
                        Teléfono
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <Phone size={18} className="text-gray-400" />
                        <input id="register-field-4"
                          type="text"
                          name="phone"
                          placeholder="3001234567"
                          value={form.phone}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                      </div>
                      {errors.phone && (
                        <p className="mt-2 text-sm text-red-500">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-field-5" className="mb-2 block text-sm font-semibold text-gray-700">
                        Dirección
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <MapPin size={18} className="text-gray-400" />
                        <input id="register-field-5"
                          type="text"
                          name="address"
                          placeholder="Dirección"
                          value={form.address}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                      </div>
                    </div>

                    {accountType === "seller" && (
                      <>
                        <div className="sm:col-span-2">
                          <label htmlFor="register-field-6" className="mb-2 block text-sm font-semibold text-gray-700">
                            Nombre de la tienda
                          </label>

                          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                            <Store size={18} className="text-gray-400" />
                            <input id="register-field-6"
                              type="text"
                              name="storeName"
                              placeholder="Mi tienda artesanal"
                              value={form.storeName}
                              onChange={handleChange}
                              className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                            />
                          </div>
                          {errors.storeName && (
                            <p className="mt-2 text-sm text-red-500">
                              {errors.storeName}
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="register-field-7" className="mb-2 block text-sm font-semibold text-gray-700">
                            Documento / NIT
                          </label>

                          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                            <FileText size={18} className="text-gray-400" />
                            <input id="register-field-7"
                              type="text"
                              name="document"
                              placeholder="Número de identificación"
                              value={form.document}
                              onChange={handleChange}
                              className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="register-field-8" className="mb-2 block text-sm font-semibold text-gray-700">
                            Ciudad
                          </label>

                          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                            <MapPin size={18} className="text-gray-400" />
                            <input id="register-field-8"
                              type="text"
                              name="city"
                              placeholder="Cajicá"
                              value={form.city}
                              onChange={handleChange}
                              className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="register-field-9" className="mb-2 block text-sm font-semibold text-gray-700">
                            Dirección del negocio
                          </label>

                          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                            <MapPin size={18} className="text-gray-400" />
                            <input id="register-field-9"
                              type="text"
                              name="businessAddress"
                              placeholder="Dirección de la tienda o negocio"
                              value={form.businessAddress}
                              onChange={handleChange}
                              className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="register-field-10" className="mb-2 block text-sm font-semibold text-gray-700">
                            Descripción de la tienda
                          </label>

                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                            <textarea id="register-field-10"
                              name="description"
                              placeholder="Cuéntanos qué vendes, qué te hace diferente o qué tipo de productos ofreces..."
                              value={form.description}
                              onChange={handleChange}
                              rows={4}
                              className="w-full resize-none bg-transparent py-4 text-sm outline-none"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="register-field-11" className="mb-2 block text-sm font-semibold text-gray-700">
                        Contraseña
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <Lock size={18} className="text-gray-400" />
                        <input id="register-field-11"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="********"
                          value={form.password}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-500 hover:text-orange-500"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-2 text-sm text-red-500">
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-field-12" className="mb-2 block text-sm font-semibold text-gray-700">
                        Confirmar contraseña
                      </label>

                      <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
                        <Lock size={18} className="text-gray-400" />
                        <input id="register-field-12"
                          type={showConfirm ? "text" : "password"}
                          name="confirmPassword"
                          placeholder="********"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          className="w-full bg-transparent px-3 py-4 text-sm outline-none"
                        />
                        <button
                          type="button"
                          aria-label={showConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'} aria-pressed={showConfirm}
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="text-gray-500 hover:text-orange-500"
                        >
                          {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-2 text-sm text-red-500">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-gray-700">
                    {accountType === "buyer"
                      ? "Estás creando una cuenta de comprador."
                      : "Estás creando una cuenta de vendedor."}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-4 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting
                      ? "Creando cuenta..."
                      : accountType === "buyer"
                      ? "Crear cuenta de comprador"
                      : "Crear cuenta de vendedor"}
                    {!isSubmitting && <ArrowRight size={18} />}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600 lg:text-left">
                  ¿Ya tienes cuenta?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-orange-500 hover:text-orange-600"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }
