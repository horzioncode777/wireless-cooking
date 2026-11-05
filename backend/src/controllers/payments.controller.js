import pool from "../config/db.js";

export const getPaymentMethods = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const result = await pool.query(
      `
      SELECT
        id,
        tipo,
        numero
      FROM metodos_pago
      WHERE id_usuario = $1
      ORDER BY id DESC
      `,
      [id_usuario]
    );

    return res.status(200).json({
      ok: true,
      methods: result.rows,
    });
  } catch (error) {
    console.error("getPaymentMethods error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al obtener métodos de pago",
    });
  }
};