import { transitionOrder } from "../services/orders.js";
import pool from "../config/db.js";
import { shipmentsFor } from '../services/shipments.js';

const isAdminUser = (user) => {
  return user?.rol === "admin" || user?.role === "admin";
};

export const getAllProductsAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const query = `
      SELECT
        p.id_producto,
        p.id_vendedor,
        p.id_categoria,
        p.nombre,
        p.descripcion,
        p.precio,
        p.stock,
        p.imagen,
        p.estado,
        p.vistas,
        p.ventas,
        p.fecha_creacion,
        p.fecha_actualizacion,
        c.nombre AS categoria
      FROM productos p
      LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.estado <> 'eliminado'
      ORDER BY p.fecha_creacion DESC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      ok: true,
      products: rows,
    });
  } catch (error) {
    console.error("getAllProductsAdmin error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener productos",
    });
  }
};

export const getAdminCategories = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

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
    console.error("getAdminCategories error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener categorías",
    });
  }
};

export const createProductAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const {
      id_vendedor,
      id_categoria,
      nombre,
      descripcion,
      precio,
      stock,
      imagen,
      estado,
    } = req.body;

    if (!nombre || !descripcion || !precio || stock === undefined || !id_categoria) {
      return res.status(400).json({
        ok: false,
        message:
          "Los campos nombre, descripcion, precio, stock e id_categoria son obligatorios",
      });
    }

    const query = `
      INSERT INTO productos (
        id_vendedor,
        id_categoria,
        nombre,
        descripcion,
        precio,
        stock,
        imagen,
        estado,
        vistas,
        ventas,
        fecha_creacion,
        fecha_actualizacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'Activo'), 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      id_vendedor ?? null,
      Number(id_categoria),
      nombre,
      descripcion,
      Number(precio),
      Number(stock),
      imagen || null,
      estado || "Activo",
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      ok: true,
      message: "Producto creado correctamente",
      product: rows[0],
    });
  } catch (error) {
    console.error("createProductAdmin error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al crear producto",
    });
  }
};

export const updateProductAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;
    const {
      id_vendedor,
      id_categoria,
      nombre,
      descripcion,
      precio,
      stock,
      imagen,
      estado,
    } = req.body;

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

    const query = `
      UPDATE productos
      SET
        id_vendedor = COALESCE($1, id_vendedor),
        id_categoria = COALESCE($2, id_categoria),
        nombre = COALESCE($3, nombre),
        descripcion = COALESCE($4, descripcion),
        precio = COALESCE($5, precio),
        stock = COALESCE($6, stock),
        imagen = COALESCE($7, imagen),
        estado = COALESCE($8, estado),
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_producto = $9
      RETURNING *
    `;

    const values = [
      id_vendedor !== undefined ? id_vendedor : null,
      id_categoria !== undefined ? Number(id_categoria) : null,
      nombre ?? null,
      descripcion ?? null,
      precio !== undefined ? Number(precio) : null,
      stock !== undefined ? Number(stock) : null,
      imagen ?? null,
      estado ?? null,
      id,
    ];

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      ok: true,
      message: "Producto actualizado correctamente",
      product: rows[0],
    });
  } catch (error) {
    console.error("updateProductAdmin error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar producto",
    });
  }
};

export const deleteProductAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;

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

    await pool.query(
      `
      UPDATE productos SET estado='eliminado'
      WHERE id_producto = $1
      `,
      [id]
    );

    return res.status(200).json({
      ok: true,
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("deleteProductAdmin error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al eliminar producto",
    });

  }
};
export const getAdminDashboard = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const totalVentasQuery = `
      SELECT COALESCE(SUM(total), 0) AS total_ventas
      FROM pedidos
      WHERE LOWER(estado) IN ('pagado', 'empacando', 'enviado', 'entregado')
    `;

    const productosActivosQuery = `
      SELECT COUNT(*) AS productos_activos
      FROM productos
      WHERE LOWER(estado) = 'activo'
    `;

    const totalPedidosQuery = `
      SELECT COUNT(*) AS total_pedidos
      FROM pedidos
    `;

    const totalUsuariosQuery = `
      SELECT COUNT(*) AS total_usuarios
      FROM usuarios
    `;

    const vendedoresActivosQuery = `
      SELECT COUNT(*) AS vendedores_activos
      FROM usuarios
      WHERE LOWER(rol) = 'vendedor' AND LOWER(estado) = 'activo'
    `;

    const vendedoresPendientesQuery = `
      SELECT COUNT(*) AS vendedores_pendientes
      FROM usuarios
      WHERE LOWER(rol) = 'vendedor' AND LOWER(estado) = 'pendiente'
    `;

    const stockBajoQuery = `
      SELECT COUNT(*) AS stock_bajo
      FROM productos
      WHERE stock <= 5
    `;

    const pedidosPendientesQuery = `
      SELECT COUNT(*) AS pedidos_pendientes
      FROM pedidos
      WHERE LOWER(estado) = 'pendiente'
    `;

    const recentOrdersQuery = `
      SELECT
        p.id_pedido,
        COALESCE(u.nombre || ' ' || u.apellido, 'Cliente') AS customer,
        COALESCE(v.nombre_tienda, 'Tienda principal') AS seller,
        p.total,
        p.estado AS status,
        p.fecha_creacion
      FROM pedidos p
      LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      LEFT JOIN productos pr ON pr.id_producto = dp.id_producto
      LEFT JOIN vendedores v ON v.id_vendedor = pr.id_vendedor
      ORDER BY p.fecha_creacion DESC
      LIMIT 10
    `;

    const recentUsersQuery = `
      SELECT
        id_usuario,
        nombre,
        apellido,
        rol AS type,
        estado AS status,
        fecha_registro
      FROM usuarios
      ORDER BY fecha_registro DESC
      LIMIT 10
    `;

    const [
      totalVentasResult,
      productosActivosResult,
      totalPedidosResult,
      totalUsuariosResult,
      vendedoresActivosResult,
      vendedoresPendientesResult,
      stockBajoResult,
      pedidosPendientesResult,
      recentOrdersResult,
      recentUsersResult,
    ] = await Promise.all([
      pool.query(totalVentasQuery),
      pool.query(productosActivosQuery),
      pool.query(totalPedidosQuery),
      pool.query(totalUsuariosQuery),
      pool.query(vendedoresActivosQuery),
      pool.query(vendedoresPendientesQuery),
      pool.query(stockBajoQuery),
      pool.query(pedidosPendientesQuery),
      pool.query(recentOrdersQuery),
      pool.query(recentUsersQuery),
    ]);

    return res.status(200).json({
      ok: true,
      summary: {
        totalVentas: Number(totalVentasResult.rows[0].total_ventas || 0),
        productosActivos: Number(productosActivosResult.rows[0].productos_activos || 0),
        totalPedidos: Number(totalPedidosResult.rows[0].total_pedidos || 0),
        totalUsuarios: Number(totalUsuariosResult.rows[0].total_usuarios || 0),
      },
      sellers: {
        activos: Number(vendedoresActivosResult.rows[0].vendedores_activos || 0),
        pendientes: Number(vendedoresPendientesResult.rows[0].vendedores_pendientes || 0),
      },
      alerts: {
        stockBajo: Number(stockBajoResult.rows[0].stock_bajo || 0),
        vendedoresPendientes: Number(vendedoresPendientesResult.rows[0].vendedores_pendientes || 0),
        pedidosPendientes: Number(pedidosPendientesResult.rows[0].pedidos_pendientes || 0),
      },
      recentOrders: recentOrdersResult.rows,
      recentUsers: recentUsersResult.rows,
    });
  } catch (error) {
    console.error("getAdminDashboard error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener dashboard",
    });
  }
};
export const getAdminUsers = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const query = `
      SELECT
        id_usuario,
        nombre,
        apellido,
        correo,
        telefono,
        direccion,
        rol,
        estado,
        fecha_registro,
        foto
      FROM usuarios
      ORDER BY fecha_registro DESC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      ok: true,
      users: rows,
    });
  } catch (error) {
    console.error("getAdminUsers error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener usuarios",
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;
    const { estado } = req.body;

    if (Number(id) === Number(req.user.id) && estado !== 'activo') {
      return res.status(409).json({ok:false,message:'No puedes desactivar tu propia cuenta administrativa.'});
    }

    const estadosValidos = ["activo", "inactivo", "pendiente", "bloqueado"];

    if (!estado || !estadosValidos.includes(String(estado).toLowerCase())) {
      return res.status(400).json({
        ok: false,
        message: "Estado inválido",
      });
    }

    const query = `
      UPDATE usuarios
      SET estado = $1
      WHERE id_usuario = $2
      RETURNING id_usuario, nombre, apellido, correo, rol, estado
    `;

    const { rows, rowCount } = await pool.query(query, [
      String(estado).toLowerCase(),
      id,
    ]);

    if (!rowCount) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Estado actualizado correctamente",
      user: rows[0],
    });
  } catch (error) {
    console.error("updateUserStatus error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar estado del usuario",
    });
  }
};
export const getAdminOrders = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const query = `
      SELECT
        p.id_pedido,
        p.id_usuario,
        p.total,
        p.estado,
        p.direccion_entrega,
        p.tipo_entrega,
        p.metodo_pago,
        p.fecha_creacion,
        p.fecha_actualizacion,
        COALESCE(u.nombre || ' ' || u.apellido, 'Cliente') AS cliente,
        COUNT(dp.id_detalle) AS total_items
        ,(SELECT ambiente FROM pagos WHERE id_pedido=p.id_pedido) AS ambiente
      FROM pedidos p
      LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      GROUP BY
        p.id_pedido,
        p.id_usuario,
        p.total,
        p.estado,
        p.direccion_entrega,
        p.tipo_entrega,
        p.metodo_pago,
        p.fecha_creacion,
        p.fecha_actualizacion,
        u.nombre,
        u.apellido
      ORDER BY p.fecha_creacion DESC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      ok: true,
      orders: rows,
    });
  } catch (error) {
    console.error("getAdminOrders error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener pedidos",
    });
  }
};

export const getAdminOrderById = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;

    const orderQuery = `
      SELECT
        p.id_pedido,
        p.id_usuario,
        p.total,
        p.estado,
        p.direccion_entrega,
        p.tipo_entrega,
        p.metodo_pago,
        p.fecha_creacion,
        p.fecha_actualizacion,
        p.tipo_entrega,p.transportadora,p.guia,p.fecha_estimada,p.nota_entrega,
        p.nombre_destinatario,p.telefono_entrega,
        (SELECT ambiente FROM pagos WHERE id_pedido=p.id_pedido) AS ambiente,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono
      FROM pedidos p
      LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE p.id_pedido = $1
      LIMIT 1
    `;

    const detailsQuery = `
      SELECT
        dp.id_detalle,
        dp.id_pedido,
        dp.id_producto,
        dp.cantidad,
        dp.precio_unitario,
        dp.subtotal,
        COALESCE(dp.nombre_producto,pr.nombre) AS producto_nombre,
        pr.imagen AS producto_imagen
      FROM detalle_pedido dp
      LEFT JOIN productos pr ON pr.id_producto = dp.id_producto
      WHERE dp.id_pedido = $1
      ORDER BY dp.id_detalle ASC
    `;

    const [orderResult, detailsResult,historyResult] = await Promise.all([
      pool.query(orderQuery, [id]),
      pool.query(detailsQuery, [id]),
      pool.query('SELECT id,estado,tipo,mensaje,fecha FROM pedido_historial WHERE id_pedido=$1 ORDER BY fecha,id',[id]),
    ]);

    if (!orderResult.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Pedido no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      order: {...orderResult.rows[0],shipments:await shipmentsFor(pool,orderResult.rows[0])},
      items: detailsResult.rows,
      history: historyResult.rows,
    });
  } catch (error) {
    console.error("getAdminOrderById error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener detalle del pedido",
    });
  }
};

export const updateAdminOrderStatus = async(req,res,next)=>{
 try {const order=await transitionOrder(req.params.id,req.body.estado);res.json({ok:true,order});}catch(error){next(error);}
};
export const getAdminSellers = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const query = `
      SELECT
        v.id_vendedor,
        v.id_usuario,
        v.nombre_tienda,
        v.descripcion,
        v.logo,
        v.banner_url,
        v.verificado,
        v.calificacion,
        v.total_resenas,
        v.fecha_creacion,
        v.fecha_actualizacion,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.estado,
        u.foto
      FROM vendedores v
      LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
      ORDER BY v.fecha_creacion DESC
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      ok: true,
      sellers: rows,
    });
  } catch (error) {
    console.error("getAdminSellers error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener vendedores",
    });
  }
};

export const getAdminSellerById = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;

    const sellerQuery = `
      SELECT
        v.id_vendedor,
        v.id_usuario,
        v.nombre_tienda,
        v.descripcion,
        v.logo,
        v.banner_url,
        v.verificado,
        v.calificacion,
        v.total_resenas,
        v.fecha_creacion,
        v.fecha_actualizacion,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.direccion,
        u.estado,
        u.foto
      FROM vendedores v
      LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.id_vendedor = $1
      LIMIT 1
    `;

    const productsQuery = `
      SELECT
        p.id_producto,
        p.nombre,
        p.precio,
        p.stock,
        p.imagen,
        p.estado,
        p.fecha_creacion
      FROM productos p
      WHERE p.id_vendedor = $1
      ORDER BY p.fecha_creacion DESC
    `;

    const [sellerResult, productsResult] = await Promise.all([
      pool.query(sellerQuery, [id]),
      pool.query(productsQuery, [id]),
    ]);

    if (!sellerResult.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      seller: sellerResult.rows[0],
      products: productsResult.rows,
    });
  } catch (error) {
    console.error("getAdminSellerById error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener detalle del vendedor",
    });
  }
};

export const updateSellerVerification = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;
    const { verificado } = req.body;

    const sellerResult = await pool.query(
      `
      UPDATE vendedores
      SET
        verificado = $1,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_vendedor = $2
      RETURNING *
      `,
      [Boolean(verificado), id]
    );

    if (!sellerResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Estado de verificación actualizado correctamente",
      seller: sellerResult.rows[0],
    });
  } catch (error) {
    console.error("updateSellerVerification error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar verificación del vendedor",
    });
  }
};

export const updateSellerUserStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ["activo", "inactivo", "pendiente", "bloqueado"];

    if (!estado || !estadosValidos.includes(String(estado).toLowerCase())) {
      return res.status(400).json({
        ok: false,
        message: "Estado inválido",
      });
    }

    const sellerLookup = await pool.query(
      `
      SELECT id_usuario
      FROM vendedores
      WHERE id_vendedor = $1
      LIMIT 1
      `,
      [id]
    );

    if (!sellerLookup.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "Vendedor no encontrado",
      });
    }

    const idUsuario = sellerLookup.rows[0].id_usuario;

    const userResult = await pool.query(
      `
      UPDATE usuarios
      SET estado = $1
      WHERE id_usuario = $2
      RETURNING id_usuario, nombre, apellido, correo, rol, estado
      `,
      [String(estado).toLowerCase(), idUsuario]
    );

    return res.status(200).json({
      ok: true,
      message: "Estado del usuario vendedor actualizado correctamente",
      user: userResult.rows[0],
    });
  } catch (error) {
    console.error("updateSellerUserStatus error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar estado del vendedor",
    });
  }
};
export const getAdminReports = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No autorizado",
      });
    }

    // KPIs generales
    const kpisQuery = `
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM vendedores) AS total_vendedores,
        (SELECT COUNT(*) FROM pedidos) AS total_pedidos,
        (SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado IN ('pagado','empacando','enviado','entregado')) AS total_ingresos
    `;

    // Ventas por mes
    const monthlySalesQuery = `
      SELECT
        DATE_TRUNC('month', fecha_creacion) AS mes,
        SUM(total) AS total
      FROM pedidos
      WHERE estado IN ('pagado','empacando','enviado','entregado')
      GROUP BY mes
      ORDER BY mes ASC
    `;

    // Top productos
    const topProductsQuery = `
      SELECT
        p.id_producto,
        p.nombre,
        SUM(dp.cantidad) AS total_vendidos,
        SUM(dp.subtotal) AS ingresos
      FROM detalle_pedido dp
      JOIN productos p ON p.id_producto = dp.id_producto
      JOIN pedidos o ON o.id_pedido=dp.id_pedido
      WHERE o.estado IN ('pagado','empacando','enviado','entregado')
      GROUP BY p.id_producto, p.nombre
      ORDER BY total_vendidos DESC
      LIMIT 5
    `;

    // Top vendedores
    const topSellersQuery = `
      SELECT
        v.id_vendedor,
        v.nombre_tienda,
        SUM(dp.subtotal) AS ingresos
      FROM detalle_pedido dp
      JOIN productos p ON p.id_producto = dp.id_producto
      JOIN pedidos o ON o.id_pedido=dp.id_pedido
      JOIN vendedores v ON v.id_vendedor = p.id_vendedor
      WHERE o.estado IN ('pagado','empacando','enviado','entregado')
      GROUP BY v.id_vendedor, v.nombre_tienda
      ORDER BY ingresos DESC
      LIMIT 5
    `;

    const [kpis, monthly, products, sellers] = await Promise.all([
      pool.query(kpisQuery),
      pool.query(monthlySalesQuery),
      pool.query(topProductsQuery),
      pool.query(topSellersQuery),
    ]);

    return res.status(200).json({
      ok: true,
      kpis: kpis.rows[0],
      monthlySales: monthly.rows,
      topProducts: products.rows,
      topSellers: sellers.rows,
    });
  } catch (error) {
    console.error("getAdminReports error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener reportes",
    });
  }
};
