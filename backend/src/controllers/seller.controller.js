import pool from "../config/db.js";
import { uploadImage } from "../services/images.js";
import { validatePublicProfile, validateSellerFields } from "../services/storeProfile.js";

const uploadBufferToCloudinary = uploadImage;

export const getSellerProfile = async (req, res) => {
  try {
    const userId = req.user.id_usuario;

    const result = await pool.query(
      `
      SELECT
        v.id_vendedor,
        v.nombre_tienda,
        v.descripcion,
        v.ciudad,
        v.perfil_publico,
        v.logo,
        v.banner_url,
        v.verificado,
        v.calificacion,
        v.total_resenas,
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.foto
      FROM vendedores v
      INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.id_usuario = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Perfil de vendedor no encontrado",
      });
    }

    return res.json({
      ok: true,
      seller: result.rows[0],
    });
  } catch (error) {
    console.error("getSellerProfile error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al obtener el perfil del vendedor",
    });
  }
};

export const updateSellerProfile = async (req, res) => {
  let client;
  try {
    const userId = req.user.id_usuario;
    const fields = validateSellerFields(req.body);
    const publicPatch = Object.hasOwn(req.body, 'perfil_publico') ? validatePublicProfile(req.body.perfil_publico) : {};
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1 FOR UPDATE', [userId]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok:false, message:'Vendedor no encontrado' });
    }
    await client.query(`UPDATE usuarios SET nombre=COALESCE($1,nombre), apellido=COALESCE($2,apellido),
      correo=COALESCE($3,correo), telefono=COALESCE($4,telefono), direccion=COALESCE($5,direccion),
      foto=COALESCE($6,foto), fecha_actualizacion=now() WHERE id_usuario=$7`,
      [fields.nombre??null,fields.apellido??null,fields.correo??null,fields.telefono??null,fields.direccion??null,fields.foto??null,userId]);
    await client.query(`UPDATE vendedores SET nombre_tienda=COALESCE($1,nombre_tienda), descripcion=COALESCE($2,descripcion),
      logo=COALESCE($3,logo), banner_url=COALESCE($4,banner_url), ciudad=COALESCE($5,ciudad),
      perfil_publico=COALESCE(perfil_publico,'{}'::jsonb) || $6::jsonb, fecha_actualizacion=now() WHERE id_usuario=$7`,
      [fields.nombre_tienda??null,fields.descripcion??null,fields.logo??null,fields.banner_url??null,fields.ciudad??null,JSON.stringify(publicPatch),userId]);
    const updated = await client.query(`SELECT v.id_vendedor,v.nombre_tienda,v.descripcion,v.ciudad,v.perfil_publico,
      v.logo,v.banner_url,v.verificado,v.calificacion,v.total_resenas,u.id_usuario,u.nombre,u.apellido,u.correo,u.telefono,u.direccion,u.foto
      FROM vendedores v JOIN usuarios u USING(id_usuario) WHERE v.id_usuario=$1`, [userId]);
    await client.query('COMMIT');
    return res.json({ ok:true, message:'Perfil actualizado correctamente', seller:updated.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(()=>{});
    const status = error.code==='23505' ? 409 : error.status||500;
    console.error('updateSellerProfile error:', error.code||error.message);
    return res.status(status).json({ ok:false, message:error.code==='23505'?'Ese correo ya está en uso por otra cuenta':status<500?error.message:'Error al actualizar el perfil del vendedor' });
  } finally {
    client?.release();
  }
};

export const updateSellerPhoto = async (req, res) => {
  try {
    const userId = req.user.id_usuario;

    const existingSeller = await pool.query(
      `SELECT id_vendedor FROM vendedores WHERE id_usuario = $1 LIMIT 1`,
      [userId]
    );

    if (existingSeller.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        message: "No se envió ninguna imagen",
      });
    }

    const uploadedImage = await uploadBufferToCloudinary(
      req.file.buffer,
      "wireless-cooking/sellers/photo"
    );

    const imageUrl = uploadedImage.secure_url;

    await pool.query(
      `
      UPDATE usuarios
      SET
        foto = $1,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_usuario = $2
      `,
      [imageUrl, userId]
    );

    await pool.query(
      `
      UPDATE vendedores
      SET
        logo = $1,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_usuario = $2
      `,
      [imageUrl, userId]
    );

    const updatedProfile = await pool.query(
      `
      SELECT
        v.id_vendedor,
        v.nombre_tienda,
        v.descripcion,
        v.ciudad,
        v.perfil_publico,
        v.logo,
        v.banner_url,
        v.verificado,
        v.calificacion,
        v.total_resenas,
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.foto
      FROM vendedores v
      INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.id_usuario = $1
      LIMIT 1
      `,
      [userId]
    );

    return res.json({
      ok: true,
      message: "Logo actualizado correctamente",
      seller: updatedProfile.rows[0],
      photo: imageUrl,
    });
  } catch (error) {
    console.error("updateSellerPhoto error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al actualizar el logo del vendedor",
    });
  }
};

export const updateSellerBanner = async (req, res) => {
  try {
    const userId = req.user.id_usuario;

    const existingSeller = await pool.query(
      `SELECT id_vendedor FROM vendedores WHERE id_usuario = $1 LIMIT 1`,
      [userId]
    );

    if (existingSeller.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        message: "No se envió ninguna imagen",
      });
    }

    const uploadedImage = await uploadBufferToCloudinary(
      req.file.buffer,
      "wireless-cooking/sellers/banner"
    );

    const imageUrl = uploadedImage.secure_url;

    await pool.query(
      `
      UPDATE vendedores
      SET
        banner_url = $1,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_usuario = $2
      `,
      [imageUrl, userId]
    );

    const updatedProfile = await pool.query(
      `
      SELECT
        v.id_vendedor,
        v.nombre_tienda,
        v.descripcion,
        v.ciudad,
        v.perfil_publico,
        v.logo,
        v.banner_url,
        v.verificado,
        v.calificacion,
        v.total_resenas,
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.foto
      FROM vendedores v
      INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.id_usuario = $1
      LIMIT 1
      `,
      [userId]
    );

    return res.json({
      ok: true,
      message: "Banner actualizado correctamente",
      seller: updatedProfile.rows[0],
      banner: imageUrl,
    });
  } catch (error) {
    console.error("updateSellerBanner error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al actualizar el banner del vendedor",
    });
  }
};

export const getSellerStats = async (req, res) => {
  try {
    const userId = req.user.id_usuario;

    const sellerResult = await pool.query(
      `SELECT id_vendedor FROM vendedores WHERE id_usuario = $1 LIMIT 1`,
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    const { id_vendedor } = sellerResult.rows[0];

    const statsResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_productos,
        COUNT(*) FILTER (WHERE estado = 'activo')::int AS productos_activos,
        COALESCE(SUM(ventas), 0)::int AS total_ventas,
        COALESCE(SUM(vistas), 0)::int AS total_vistas,
        COALESCE(SUM(precio * ventas), 0)::numeric AS ingresos_estimados
      FROM productos
      WHERE id_vendedor = $1
      `,
      [id_vendedor]
    );

    return res.json({
      ok: true,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error("getSellerStats error:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al obtener estadísticas del vendedor",
    });
  }
};