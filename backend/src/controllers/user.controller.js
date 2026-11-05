import pool from "../config/db.js";
import { uploadImage } from "../services/images.js";

const uploadBufferToCloudinary = uploadImage;

export const getProfile = async (req,res,next) => {
 try {
  const {rows}=await pool.query(`SELECT id_usuario,nombre,apellido,correo,telefono,direccion,foto,rol,estado,
   COALESCE(fecha_registro,fecha_creacion) AS fecha_registro,
   (SELECT COUNT(*)::int FROM favoritos f WHERE f.id_usuario=u.id_usuario) AS favorites_count
   FROM usuarios u WHERE id_usuario=$1`,[req.user.id]);
  if(!rows.length)return res.status(404).json({ok:false,message:'Usuario no encontrado.'});
  const {favorites_count,...user}=rows[0];
  res.set('Cache-Control','no-store');res.json({ok:true,user,summary:{favorites:favorites_count}});
 }catch(error){next(error);}
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { nombre, apellido, correo, telefono, direccion } = req.body;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const result = await pool.query(
      `
      UPDATE usuarios
      SET
        nombre = $1,
        apellido = $2,
        correo = $3,
        telefono = $4,
        direccion = $5
      WHERE id_usuario = $6
      RETURNING id_usuario, nombre, apellido, correo, telefono, direccion, foto
      `,
      [
        nombre || "",
        apellido || "",
        correo || "",
        telefono || "",
        direccion || "",
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Perfil actualizado correctamente",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error interno al actualizar perfil",
    });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "Debes seleccionar una imagen",
      });
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer);

    const result = await pool.query(
      `
      UPDATE usuarios
      SET foto = $1
      WHERE id_usuario = $2
      RETURNING id_usuario, nombre, apellido, correo, telefono, direccion, foto
      `,
      [uploaded.secure_url, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Foto de perfil actualizada correctamente",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("uploadProfilePhoto error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error interno al subir la foto de perfil",
    });
  }
};
