import pool from "../config/db.js";

export const getFavorites = async (req, res) => {
  try {
    const userId = req.user?.id;

    const query = `
      SELECT
        f.id,
        f.id_usuario,
        f.id_producto,
        f.fecha_agregado,
        p.id_producto AS product_id,
        p.nombre,
        p.descripcion,
        p.precio,
        p.imagen,
        p.id_categoria
      FROM favoritos f
      INNER JOIN productos p ON p.id_producto = f.id_producto
      WHERE f.id_usuario = $1
      ORDER BY f.fecha_agregado DESC
    `;

    const { rows } = await pool.query(query, [userId]);

    res.json(rows);
  } catch (error) {
    console.error("getFavorites error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener favoritos",
    });
  }
};

export const addFavorite = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        ok: false,
        message: "El productId es obligatorio",
      });
    }

    const query = `
      INSERT INTO favoritos (id_usuario, id_producto)
      VALUES ($1, $2)
      ON CONFLICT (id_usuario, id_producto) DO NOTHING
      RETURNING *
    `;

    const { rows } = await pool.query(query, [userId, productId]);

    res.json({
      ok: true,
      message: rows.length ? "Agregado a favoritos" : "Ya estaba en favoritos",
      favorite: rows[0] || null,
    });
  } catch (error) {
    console.error("addFavorite error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al agregar favorito",
    });
  }
};

export const removeFavorite = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    const query = `
      DELETE FROM favoritos
      WHERE id_usuario = $1 AND id_producto = $2
      RETURNING *
    `;

    const { rows } = await pool.query(query, [userId, productId]);

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Favorito no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Eliminado de favoritos",
    });
  } catch (error) {
    console.error("removeFavorite error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al eliminar favorito",
    });
  }
};

export const checkFavorite = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    const query = `
      SELECT 1
      FROM favoritos
      WHERE id_usuario = $1 AND id_producto = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [userId, productId]);

    res.json({
      ok: true,
      isFavorite: rows.length > 0,
    });
  } catch (error) {
    console.error("checkFavorite error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al verificar favorito",
    });
  }
};