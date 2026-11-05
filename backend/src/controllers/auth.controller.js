import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { sessionResult } from '../services/authSession.js';

const buildToken = (user) => {
  return sessionResult(user).token;
};

export const registerBuyer = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      correo,
      password,
      telefono,
      direccion,
    } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({
        ok: false,
        message: "Nombre, correo y contraseña son obligatorios",
      });
    }

    const cleanEmail = correo.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE correo = $1 LIMIT 1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: "El correo ya está registrado",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO usuarios
      (nombre, apellido, correo, contrasena_hash, telefono, direccion, rol, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'comprador', 'activo')
      RETURNING
        id_usuario,
        nombre,
        apellido,
        correo,
        telefono,
        direccion,
        foto,
        rol,
        estado
      `,
      [
        nombre.trim(),
        apellido?.trim() || null,
        cleanEmail,
        hashedPassword,
        telefono?.trim() || null,
        direccion?.trim() || null,
      ]
    );

    const user = result.rows[0];
    const token = buildToken(user);

    return res.status(201).json({
      ok: true,
      message: "Comprador registrado correctamente",
      token,
      user,
    });
  } catch (error) {
    console.error("registerBuyer error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al registrar comprador",
    });
  }
};

export const registerSeller = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const {
      nombre,
      apellido,
      correo,
      password,
      telefono,
      direccion,
      nombre_tienda,
      descripcion,
    } = req.body;

    if (!nombre || !correo || !password || !nombre_tienda || !telefono) {
      return res.status(400).json({
        ok: false,
        message:
          "Nombre, correo, contraseña, teléfono y nombre de la tienda son obligatorios",
      });
    }

    const cleanEmail = correo.trim().toLowerCase();

    await client.query("BEGIN");
    transactionStarted = true;

    const existingUser = await client.query(
      "SELECT id_usuario FROM usuarios WHERE correo = $1 LIMIT 1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        ok: false,
        message: "El correo ya está registrado",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO usuarios
      (nombre, apellido, correo, contrasena_hash, telefono, direccion, rol, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'vendedor', 'activo')
      RETURNING
        id_usuario,
        nombre,
        apellido,
        correo,
        telefono,
        direccion,
        foto,
        rol,
        estado
      `,
      [
        nombre.trim(),
        apellido?.trim() || null,
        cleanEmail,
        hashedPassword,
        telefono?.trim() || null,
        direccion?.trim() || null,
      ]
    );

    const user = userResult.rows[0];

    await client.query(
      `
      INSERT INTO vendedores
      (
        id_usuario,
        nombre_tienda,
        descripcion,
        logo,
        banner_url,
        verificado,
        calificacion,
        total_resenas
      )
      VALUES ($1, $2, $3, $4, $5, FALSE, 0, 0)
      `,
      [
        user.id_usuario,
        nombre_tienda.trim(),
        descripcion?.trim() || null,
        null,
        null,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({ ...sessionResult(user), message: 'Vendedor registrado correctamente' });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("rollback registerSeller error:", rollbackError);
      }
    }

    console.error("registerSeller error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error interno al registrar vendedor",
    });
  } finally {
    client.release();
  }
};

export const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    res.set('Cache-Control', 'no-store');
    if (typeof correo !== 'string' || correo.length > 150 || typeof password !== 'string' || !password || password.length > 72) {
      return res.status(400).json({
        ok: false,
        message: "Correo y contraseña son obligatorios",
      });
    }

    const cleanEmail = correo.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.foto,
        u.rol,
        u.estado,
        u.token_version,
        u.contrasena_hash
      FROM usuarios u
      WHERE u.correo = $1
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "Revisa tu correo y contraseña. Si la olvidaste, usa Recuperar contraseña.",
      });
    }

    const user = result.rows[0];

    if (user.estado !== "activo") {
      return res.status(403).json({
        ok: false,
        message: "Tu cuenta está inactiva",
      });
    }

    const isValidPassword = await bcrypt.compare(
      password,
      user.contrasena_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({
        ok: false,
        message: "Revisa tu correo y contraseña. Si la olvidaste, usa Recuperar contraseña.",
      });
    }

    await pool.query("SELECT avisar_usuario($1,'seguridad','Nuevo inicio de sesión','Se inició sesión en tu cuenta. Si no reconoces esta actividad, cambia tu contraseña y contacta con soporte.','/pqr','info')",[user.id_usuario]);
    return res.status(200).json(sessionResult(user));
  } catch (error) {
    console.error("login error:", error.code || error.status || 'internal');
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error interno al iniciar sesión",
    });
  }
};
