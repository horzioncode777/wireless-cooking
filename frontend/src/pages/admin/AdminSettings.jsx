import { API_URL } from '../../services/apiConfig.js';
import { appFetch } from "../../services/notifications.js";
import { imageUrl, readUser } from "../../services/api";
import { useEffect, useEffectEvent, useState } from "react";
import { Save, Lock, Upload, Camera } from "lucide-react";



export default function AdminSettings() {
  const [user, setUser] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    foto: "",
  });

  const [password, setPassword] = useState({
    actual: "",
    nueva: "",
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("token");

  const loadProfile = async () => {
    try {
      setError("");

      const res = await appFetch(`${API_URL}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.ok) {
        setUser({
          nombre: data.user?.nombre || "",
          apellido: data.user?.apellido || "",
          correo: data.user?.correo || "",
          foto: data.user?.foto || "",
        });
      } else {
        setError(data.message || "No se pudo cargar el perfil");
      }
    } catch (err) {
      console.error("Error cargando perfil:", err);
      setError("No se pudo cargar el perfil");
    }
  };

  const synchronizeProfile = useEffectEvent(() => {
    loadProfile();
  });
  useEffect(() => { synchronizeProfile(); }, [token]);

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const res = await appFetch(`${API_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: user.nombre,
          apellido: user.apellido,
          correo: user.correo,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        const updatedUser = {
          ...readUser(),
          ...user,
          ...data.user,
        };

        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setSuccess("Perfil actualizado correctamente");
      } else {
        setError(data.message || "Error actualizando perfil");
      }
    } catch (err) {
      console.error("Error actualizando perfil:", err);
      setError("Error en la actualización");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const res = await appFetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(password),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess("Contraseña actualizada. Inicia sesión nuevamente.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setPassword({ actual: "", nueva: "" });
      } else {
        setError(data.message || "Error cambiando contraseña");
      }
    } catch (err) {
      console.error("Error cambiando contraseña:", err);
      setError("Error en contraseña");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedPhoto(file);
    setError("");
    setSuccess("");
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) {
      setError("Selecciona una imagen para subir.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("photo", selectedPhoto);

      const res = await appFetch(`${API_URL}/api/user/profile/photo`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "No se pudo subir la foto.");
        return;
      }

      const updatedUser = {
        ...readUser(),
        ...user,
        ...data.user,
      };

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setSelectedPhoto(null);
      setSuccess("Foto de perfil actualizada correctamente.");
    } catch (err) {
      console.error("Error subiendo imagen:", err);
      setError("Error subiendo la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>


      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Perfil administrador</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="adminsettings-field-1" className="text-sm font-medium text-slate-700">Nombre</label>
            <input id="adminsettings-field-1"
              value={user.nombre}
              onChange={(e) =>
                setUser({ ...user, nombre: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label htmlFor="adminsettings-field-2" className="text-sm font-medium text-slate-700">Apellido</label>
            <input id="adminsettings-field-2"
              value={user.apellido}
              onChange={(e) =>
                setUser({ ...user, apellido: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-400"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="adminsettings-field-3" className="text-sm font-medium text-slate-700">Correo</label>
            <input id="adminsettings-field-3"
              value={user.correo}
              onChange={(e) =>
                setUser({ ...user, correo: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Foto de perfil</label>

            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {selectedPhoto ? (
                  <img loading="lazy"
                    src={imageUrl(URL.createObjectURL(selectedPhoto))}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : user.foto ? (
                  <img loading="lazy"
                    src={imageUrl(user.foto)}
                    alt="Perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera size={28} className="text-slate-400" />
                )}
              </div>

              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-2xl file:border-0 file:bg-amber-100 file:px-4 file:py-2.5 file:font-semibold file:text-amber-700 hover:file:bg-amber-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Sube una imagen JPG, PNG o WEBP. Máximo 5 MB.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUploadPhoto}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Upload size={16} />
                {uploading ? "Subiendo..." : "Subir foto"}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleUpdateProfile}
          disabled={loading}
          className="mt-6 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Save size={16} />
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Seguridad</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input aria-label="Contraseña actual"
            type="password"
            placeholder="Contraseña actual"
            value={password.actual}
            onChange={(e) =>
              setPassword({ ...password, actual: e.target.value })
            }
            className="rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-400"
          />

          <input aria-label="Nueva contraseña"
            type="password"
            placeholder="Nueva contraseña"
            value={password.nueva}
            onChange={(e) =>
              setPassword({ ...password, nueva: e.target.value })
            }
            className="rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-400"
          />
        </div>

        <button
          onClick={handleChangePassword}
          disabled={loading}
          className="mt-4 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Lock size={16} />
          {loading ? "Procesando..." : "Cambiar contraseña"}
        </button>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Configuración general</h2>

        <div className="space-y-3 text-sm text-slate-600">
          <p>✔ Plataforma activa</p>
          <p>✔ Pagos habilitados</p>
          <p>✔ Marketplace operativo</p>
        </div>
      </div>
    </div>
  );
}
