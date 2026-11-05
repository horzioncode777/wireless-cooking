import jwt from "jsonwebtoken";
import pool from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const userId =
      decoded?.id ||
      decoded?.id_usuario ||
      decoded?.userId ||
      decoded?.usuario_id;

    if (!decoded || !userId || (decoded.purpose && decoded.purpose !== 'session')) {
      return res.status(401).json({
        ok: false,
        message: "Token inválido",
      });
    }

    const result = await pool.query('SELECT rol,estado,correo,token_version FROM usuarios WHERE id_usuario=$1', [userId]);
    const account=result.rows[0];
    if(!account || account.estado !== 'activo' || Number(decoded.version || 0)!==account.token_version) {
      return res.status(401).json({ok:false,message:'Sesión revocada o cuenta inactiva. Inicia sesión nuevamente.'});
    }

    req.user = {
      id: userId,
      id_usuario: userId,
      email: account.correo,
      correo: account.correo,
      rol: account.rol,
      token_version: account.token_version,
    };

    next();
  } catch (error) {
    if (!['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(error.name)) console.error('verifyToken error:', error.code || error.name);

    return res.status(401).json({
      ok: false,
      message: "Token inválido o expirado",
    });
  }
};

export const verifySeller = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    if (req.user.rol !== "vendedor" && req.user.rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para esta acción",
      });
    }

    next();
  } catch (error) {
    console.error("verifySeller error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al validar permisos",
    });
  }
};

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
