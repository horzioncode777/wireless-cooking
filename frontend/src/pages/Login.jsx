import { API_URL } from '../services/apiConfig.js';
import { appFetch } from "../services/notifications.js";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import MainLayout from "../components/layout/MainLayout";



export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberEmail");

    if (rememberedEmail) {
      setForm((prev) => ({
        ...prev,
        email: rememberedEmail,
        remember: true,
      }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
      general: "",
    }));
  };

  const validateForm = () => {
    const newErrors = {};

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

  const redirectByRole = (userData) => {
    const returnTo=location.state?.reviewReturnTo;
    if(typeof returnTo==='string' && /^\/producto\/\d+#calificar-producto$/.test(returnTo)){
      navigate(returnTo,{replace:true});return;
    }
    const role = normalizeRole(
      userData?.rol || userData?.role || userData?.tipo_usuario
    );

    if (role === "vendedor") {
      navigate("/vendedor", { replace: true });
      return;
    }

    if (role === "admin") {
      navigate("/admin", { replace: true });
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

      const response = await appFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          correo: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({
          general: data.message || "No se pudo iniciar sesión.",
        });
        return;
      }

      completeLogin(data);
    } catch (error) {
      console.error("login error:", error);
      setErrors({general: 'No se pudo conectar con el servidor. Intenta nuevamente.'});
    } finally {
      setIsSubmitting(false);
    }
  };

  function completeLogin(data) {
      const userData = {
        ...(data.user || {}),
        rol: normalizeRole(
          data?.user?.rol || data?.user?.role || data?.user?.tipo_usuario
        ),
      };

      localStorage.setItem("token", data.token || "");

      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }

      localStorage.setItem("user", JSON.stringify(userData));
      window.dispatchEvent(new Event('storage'));

      if (form.remember) {
        localStorage.setItem("rememberEmail", form.email.trim());
      } else {
        localStorage.removeItem("rememberEmail");
      }

      redirectByRole(userData);
  }

  return (
    <MainLayout hideAssistant>
      <section className="min-h-[calc(100vh-160px)] bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-12">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
          <div className="hidden flex-col justify-between bg-gradient-to-br from-orange-500 to-amber-500 p-10 text-white lg:flex">
            <div>
              <p className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                Wireless Cooking
              </p>

              <h1 className="text-4xl font-extrabold leading-tight">
                Bienvenido de nuevo
              </h1>

              <p className="mt-4 max-w-md text-white/90">
                Inicia sesión para seguir explorando productos, gestionar tu
                carrito y realizar tus compras de forma rápida y segura.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <h3 className="text-lg font-semibold">Compra fácil</h3>
                <p className="mt-1 text-sm text-white/90">
                  Accede a tus productos favoritos y continúa donde lo dejaste.
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <h3 className="text-lg font-semibold">Más rápido</h3>
                <p className="mt-1 text-sm text-white/90">
                  Guarda tu sesión y realiza pedidos en menos pasos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center lg:text-left">
                <h2 className="text-3xl font-bold text-gray-900">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Ingresa tus datos para acceder a tu cuenta
                </p>
              </div>

              {errors.general && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errors.general}
                </div>
              )}

              {location.state?.passwordUpdated&&<p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Tu contraseña se actualizó. Inicia sesión con tu nueva contraseña.</p>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Correo electrónico
                  </label>

                  <div
                    className={`flex items-center rounded-2xl border bg-white px-4 transition ${
                      errors.email
                        ? "border-red-400"
                        : "border-gray-200 focus-within:border-orange-400"
                    }`}
                  >
                    <Mail size={18} className="text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full rounded-2xl px-3 py-4 text-sm text-gray-800 outline-none"
                    />
                  </div>

                  {errors.email && (
                    <p className="mt-2 text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Contraseña
                  </label>

                  <div
                    className={`flex items-center rounded-2xl border bg-white px-4 transition ${
                      errors.password
                        ? "border-red-400"
                        : "border-gray-200 focus-within:border-orange-400"
                    }`}
                  >
                    <Lock size={18} className="text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      value={form.password}
                      onChange={handleChange}
                      className="w-full rounded-2xl px-3 py-4 text-sm text-gray-800 outline-none"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-gray-400 transition hover:text-orange-500"
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

                <div className="flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={form.remember}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    Recordarme
                  </label>

                  <Link
                    to="/recuperar-password"
                    className="font-medium text-orange-500 hover:text-orange-600"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-4 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Ingresando..." : "Entrar"}
                  {!isSubmitting && <ArrowRight size={18} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600 lg:text-left">
                ¿No tienes cuenta?{" "}
                <Link
                  to="/registro"
                  className="font-semibold text-orange-500 hover:text-orange-600"
                >
                  Crear cuenta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
