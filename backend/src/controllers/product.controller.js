import { catalogSnapshot } from "../services/catalog.js";
import pool from "../config/db.js";
import { planGallery, uploadGallery, discardGalleryUploads } from "../services/productGallery.js";

/**
 * Normaliza estado a texto para la BD
 */
const normalizeEstado = (value, defaultValue = "activo") => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      ["activo", "activa", "true", "1", "disponible", "enabled"].includes(
        normalized
      )
    ) {
      return "activo";
    }

    if (
      [
        "pausado",
        "pause",
        "paused",
        "false",
        "0",
        "inactivo",
        "inactive",
        "disabled",
      ].includes(normalized)
    ) {
      return "pausado";
    }

    if (["agotado", "soldout", "sin stock", "outofstock"].includes(normalized)) {
      return "agotado";
    }
  }

  if (typeof value === "boolean") {
    return value ? "activo" : "pausado";
  }

  if (typeof value === "number") {
    return value === 1 ? "activo" : "pausado";
  }

  return defaultValue;
};

/**
 * Busca el id_vendedor real a partir del id del usuario autenticado
 */
const getSellerIdByUserId = async (userId) => {
  const query = `
    SELECT id_vendedor
    FROM vendedores
    WHERE id_usuario = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0]?.id_vendedor || null;
};

/**
 * GET /api/seller/products
 * Público: listar productos con calificación y cantidad de reseñas
 */
export const getSellerProducts = async (req,res,next) => {
  try {
    const snapshot=await catalogSnapshot();
    res.set('Cache-Control','no-cache');
    // Optional bounded pagination is available to API clients. Legacy pages retain the complete catalog.
    if(req.query.page !== undefined) {
      const page=Number(req.query.page),pageSize=Number(req.query.pageSize||24);
      if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100) return res.status(400).json({ok:false,message:'Paginación inválida: de 1 a 100 productos por página.'});
      return res.json({ok:true,revision:snapshot.revision,total:snapshot.products.length,page,pageSize,products:snapshot.products.slice((page-1)*pageSize,page*pageSize)});
    }
    snapshot.body ??= JSON.stringify({ok:true,revision:snapshot.revision,products:snapshot.products});
    return res.type('json').send(snapshot.body);
  }catch(error){next(error);}
};

/**
 * GET /api/seller/products/:id
 * Público: detalle de producto con calificación y reseñas
 */
export const getSellerProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        p.id_producto,
        p.id_vendedor,
        p.id_categoria,
        p.nombre,
        p.descripcion,
        p.material,
        p.precio,
        p.stock,
        p.imagen,
        p.galeria,
        p.ficha,
        p.estado,
        p.vistas,
        p.ventas,
        p.fecha_creacion,
        p.fecha_actualizacion,
        v.nombre_tienda AS vendedor_nombre,
        c.nombre AS categoria,
        COALESCE(ROUND(AVG(r.puntuacion)::numeric, 1), 0) AS calificacion,
        COUNT(r.id_resena)::int AS resenas
      FROM productos p
      LEFT JOIN vendedores v ON v.id_vendedor=p.id_vendedor
      LEFT JOIN usuarios su ON su.id_usuario=v.id_usuario
      LEFT JOIN categorias c
        ON c.id_categoria = p.id_categoria
      LEFT JOIN resenas_producto r
        ON r.id_producto = p.id_producto
      WHERE p.id_producto = $1 AND LOWER(p.estado)='activo' AND (su.estado='activo' OR p.id_vendedor IS NULL)
      GROUP BY
        p.id_producto,
        p.id_vendedor,
        p.id_categoria,
        p.nombre,
        p.descripcion,
        p.material,
        p.precio,
        p.stock,
        p.imagen,
        p.estado,
        p.vistas,
        p.ventas,
        p.fecha_creacion,
        p.fecha_actualizacion,
        c.nombre,
        v.nombre_tienda
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [id]);

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    try {
      if(req.query.view !== '0') {
      await pool.query(
        `
        UPDATE productos
        SET vistas = COALESCE(vistas, 0) + 1,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_producto = $1
        `,
        [id]
      );
      }
    } catch (viewError) {
      console.error("update views error:", viewError);
    }

    return res.status(200).json({
      ok: true,
      product: rows[0],
    });
  } catch (error) {
    console.error("getSellerProductById error:", error);

    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al obtener el producto",
    });
  }
};

/**
 * GET /api/seller/products/categories/list
 * Público: listar categorías
 */
export const getCategories = async (req, res) => {
  try {
    const query = `
      SELECT
        id_categoria,
        nombre
      FROM categorias
      ORDER BY nombre ASC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      ok: true,
      categories: rows,
    });
  } catch (error) {
    console.error("getCategories error:", error);

    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al obtener categorías",
    });
  }
};

/**
 * POST /api/seller/products
 * Privado vendedor: crear producto
 */
export const createProduct = async (req, res) => {
  const uploaded = [];
  try {
    const userId = req.user?.id;

    const { id_categoria, nombre, descripcion, precio, stock, estado, material } = req.body;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const sellerId = await getSellerIdByUserId(userId);

    if (!sellerId) {
      return res.status(404).json({
        ok: false,
        message: "No existe un perfil de vendedor asociado a este usuario",
      });
    }

    if (
      !nombre?.trim() ||
      !descripcion?.trim() ||
      precio === undefined ||
      precio === null ||
      stock === undefined ||
      stock === null ||
      !id_categoria
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Los campos nombre, descripcion, precio, stock e id_categoria son obligatorios",
      });
    }

    const precioNumber = Number(precio);
    const stockNumber = Number(stock);
    const categoriaNumber = Number(id_categoria);
    const estadoValue = normalizeEstado(estado, "activo");

    if (!Number.isFinite(precioNumber) || precioNumber < 0) {
      return res.status(400).json({
        ok: false,
        message: "El precio debe ser un número válido mayor o igual a 0",
      });
    }

    if (
      Number.isNaN(stockNumber) ||
      stockNumber < 0 ||
      !Number.isInteger(stockNumber)
    ) {
      return res.status(400).json({
        ok: false,
        message: "El stock debe ser un número entero mayor o igual a 0",
      });
    }

    if (Number.isNaN(categoriaNumber)) {
      return res.status(400).json({
        ok: false,
        message: "La categoría no es válida",
      });
    }

    const gallery = await uploadGallery(planGallery(req), uploaded);
    const imageUrl = gallery[0];

    const query = `
      INSERT INTO productos (
        id_vendedor,
        id_categoria,
        nombre,
        descripcion,
        precio,
        stock,
        imagen,
        galeria,
        estado,
        vistas,
        ventas,
        fecha_creacion,
        fecha_actualizacion,
        material
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $10::jsonb, $8, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9)
      RETURNING *
    `;

    const values = [
      Number(sellerId),
      categoriaNumber,
      nombre.trim(),
      descripcion.trim(),
      precioNumber,
      stockNumber,
      imageUrl,
      estadoValue,
      typeof material === "string" ? material.trim().slice(0,100) : null,
      JSON.stringify(gallery),
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      ok: true,
      message: "Producto creado correctamente",
      product: rows[0],
    });
  } catch (error) {
    await discardGalleryUploads(uploaded);
    console.error("createProduct error:", error);

    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al crear producto",
    });
  }
};

/**
 * PUT /api/seller/products/:id
 * Privado vendedor: actualizar producto
 */
export const updateProduct = async (req, res) => {
  let client, transactionOpen=false;
  const uploaded = [];
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const { id_categoria, nombre, descripcion, precio, stock, estado, material } = req.body;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const sellerId = await getSellerIdByUserId(userId);

    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen=true;
    const existingQuery = `SELECT * FROM productos WHERE id_producto=$1 FOR UPDATE`;
    const existingResult = await client.query(existingQuery, [id]);

    if (!existingResult.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    const existingProduct = existingResult.rows[0];

    if (
      Number(existingProduct.id_vendedor) !== Number(sellerId) &&
      req.user?.rol !== "admin"
    ) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para editar este producto",
      });
    }

    const categoriaValue =
      id_categoria !== undefined && id_categoria !== null && id_categoria !== ""
        ? Number(id_categoria)
        : null;

    const precioValue =
      precio !== undefined && precio !== null && precio !== ""
        ? Number(precio)
        : null;

    const stockValue =
      stock !== undefined && stock !== null && stock !== ""
        ? Number(stock)
        : null;

    const estadoValue =
      estado !== undefined && estado !== null && estado !== ""
        ? normalizeEstado(estado, existingProduct.estado)
        : null;

    if (categoriaValue !== null && Number.isNaN(categoriaValue)) {
      return res.status(400).json({
        ok: false,
        message: "La categoría no es válida",
      });
    }

    if (precioValue !== null && (!Number.isFinite(precioValue) || precioValue < 0)) {
      return res.status(400).json({
        ok: false,
        message: "El precio debe ser un número válido mayor o igual a 0",
      });
    }

    if (
      stockValue !== null &&
      (Number.isNaN(stockValue) || stockValue < 0 || !Number.isInteger(stockValue))
    ) {
      return res.status(400).json({
        ok: false,
        message: "El stock debe ser un número entero mayor o igual a 0",
      });
    }

    const plan = planGallery(req, existingProduct);
    const gallery = plan ? await uploadGallery(plan, uploaded) : null;
    const imageUrl = gallery?.[0] ?? null;

    const query = `
      UPDATE productos
      SET
        id_categoria = COALESCE($1, id_categoria),
        nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion),
        precio = COALESCE($4, precio),
        stock = COALESCE($5, stock),
        imagen = COALESCE($6, imagen),
        galeria = COALESCE($10::jsonb, galeria),
        estado = COALESCE($7, estado),
        material = COALESCE($9, material),
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_producto = $8
      RETURNING *
    `;

    const values = [
      categoriaValue,
      nombre !== undefined && nombre !== null ? nombre.trim() : null,
      descripcion !== undefined && descripcion !== null ? descripcion.trim() : null,
      precioValue,
      stockValue,
      imageUrl,
      estadoValue,
      id,
      typeof material === "string" ? material.trim().slice(0,100) : null,
      gallery ? JSON.stringify(gallery) : null,
    ];

    const { rows } = await client.query(query, values);
    await client.query('COMMIT');
    transactionOpen=false;

    return res.status(200).json({
      ok: true,
      message: "Producto actualizado correctamente",
      product: rows[0],
    });
  } catch (error) {
    if (transactionOpen) { await client.query('ROLLBACK').catch(()=>{}); transactionOpen=false; }
    await discardGalleryUploads(uploaded);
    console.error("updateProduct error:", error);

    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al actualizar producto",
    });
  } finally {
    if (client) {
      if (transactionOpen) await client.query('ROLLBACK').catch(()=>{});
      client.release();
    }
  }
};

/**
 * DELETE /api/seller/products/:id
 * Privado vendedor: eliminar producto
 */
export const deleteProduct = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const sellerId = await getSellerIdByUserId(userId);

    const existingQuery = `
      SELECT *
      FROM productos
      WHERE id_producto = $1
      LIMIT 1
    `;

    const existingResult = await pool.query(existingQuery, [id]);

    if (!existingResult.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    const existingProduct = existingResult.rows[0];

    if (
      Number(existingProduct.id_vendedor) !== Number(sellerId) &&
      req.user?.rol !== "admin"
    ) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para eliminar este producto",
      });
    }

    await pool.query(
      `
      UPDATE productos SET estado='eliminado', fecha_actualizacion=now()
      WHERE id_producto = $1
      `,
      [id]
    );

    return res.status(200).json({
      ok: true,
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("deleteProduct error:", error);

    return res.status(error.status || 500).json({
      ok: false,
      message: error.status ? error.message : "Error al eliminar producto",
    });
  }
};
export const getOwnProducts = async (req,res,next) => {
 try {
  const seller=await getSellerIdByUserId(req.user.id);
  const {rows}=await pool.query("SELECT p.*,c.nombre AS categoria FROM productos p LEFT JOIN categorias c USING(id_categoria) WHERE p.id_vendedor=$1 AND p.estado!='eliminado' ORDER BY p.fecha_creacion DESC",[seller]);
  res.json({ok:true,products:rows});
 }catch(error){next(error);}
};
export const getOwnProduct = async (req,res,next) => {
 try {
  const seller=await getSellerIdByUserId(req.user.id);
  const {rows}=await pool.query('SELECT * FROM productos WHERE id_producto=$1 AND id_vendedor=$2',[req.params.id,seller]);
  if(!rows.length) return res.status(404).json({ok:false,message:'Producto no encontrado en tu inventario.'});
  res.json({ok:true,product:rows[0]});
 }catch(error){next(error);}
};
