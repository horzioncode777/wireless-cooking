export const isAdmin = (req, res, next) => {
  const user = req.user;
  const role = user?.rol || user?.role || user?.tipo_usuario;

  if (role !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "No autorizado",
    });
  }

  next();
};