import pool from "../config/db.js";

const getOrCreateCart = async (client, id_usuario) => {
  let cartResult = await client.query(
    `
    SELECT id_carrito, id_usuario, estado
    FROM carritos
    WHERE id_usuario = $1 AND estado = 'activo'
    LIMIT 1
    `,
    [id_usuario]
  );

  if (cartResult.rows.length > 0) {
    return cartResult.rows[0];
  }

  const newCart = await client.query(
    `
    INSERT INTO carritos (id_usuario, estado)
    VALUES ($1, 'activo')
    RETURNING id_carrito, id_usuario, estado
    `,
    [id_usuario]
  );

  return newCart.rows[0];
};

export const getCart = async (req, res) => {
  const client = await pool.connect();

  try {
    const id_usuario = req.user?.id_usuario || req.user?.id;

    if (!id_usuario) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const cart = await getOrCreateCart(client, id_usuario);

    const itemsResult = await client.query(
      `
      SELECT
        ci.id_item,
        ci.id_producto,
        ci.cantidad,
        p.nombre,
        p.descripcion,
        p.precio,
        p.imagen,
        p.stock,
        LOWER(p.estado) AS estado,
        (p.id_vendedor IS NULL OR su.estado='activo') AS comercio_activo,
        p.id_categoria
      FROM carrito_items ci
      INNER JOIN productos p ON p.id_producto = ci.id_producto
      LEFT JOIN vendedores v ON v.id_vendedor=p.id_vendedor
      LEFT JOIN usuarios su ON su.id_usuario=v.id_usuario
      WHERE ci.id_carrito = $1
      ORDER BY ci.id_item DESC
      `,
      [cart.id_carrito]
    );

    return res.status(200).json({
      ok: true,
      cart: {
        id_carrito: cart.id_carrito,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("getCart error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al obtener el carrito",
    });
  } finally {
    client.release();
  }
};

export const addToCart = async (req, res) => {
  const client = await pool.connect();

  try {
    const id_usuario = req.user?.id_usuario || req.user?.id;
    const { id_producto, cantidad } = req.body;

    if (!id_usuario) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    if (!id_producto) {
      return res.status(400).json({
        ok: false,
        message: "El producto es obligatorio",
      });
    }

    const qty = cantidad === undefined ? 1 : Number(cantidad);

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        ok: false,
        message: "La cantidad debe ser mayor a 0",
      });
    }

    await client.query("BEGIN");

    const productResult = await client.query(
      `
      SELECT id_producto, nombre, stock, estado
      FROM productos
      WHERE id_producto = $1
      LIMIT 1
      `,
      [id_producto]
    );

    if (productResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    const producto = productResult.rows[0];

    if (producto.estado.toLowerCase() !== 'activo' || Number(producto.stock || 0) < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "No hay suficiente stock disponible",
      });
    }

    const cart = await getOrCreateCart(client, id_usuario);

    const existingItem = await client.query(
      `
      SELECT id_item, cantidad
      FROM carrito_items
      WHERE id_carrito = $1 AND id_producto = $2
      LIMIT 1
      `,
      [cart.id_carrito, id_producto]
    );

    if (existingItem.rows.length > 0) {
      const nuevaCantidad = Number(existingItem.rows[0].cantidad) + qty;

      if (nuevaCantidad > Number(producto.stock || 0)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          message: "La cantidad supera el stock disponible",
        });
      }

      await client.query(
        `
        UPDATE carrito_items
        SET cantidad = $1
        WHERE id_item = $2
        `,
        [nuevaCantidad, existingItem.rows[0].id_item]
      );
    } else {
      await client.query(
        `
        INSERT INTO carrito_items (id_carrito, id_producto, cantidad)
        VALUES ($1, $2, $3)
        `,
        [cart.id_carrito, id_producto, qty]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      ok: true,
      message: "Producto agregado al carrito correctamente",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("addToCart error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al agregar al carrito",
    });
  } finally {
    client.release();
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const id_usuario = req.user?.id_usuario || req.user?.id;
    const { id } = req.params;
    const { cantidad } = req.body;

    if (!id_usuario) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const qty = Number(cantidad);

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        ok: false,
        message: "La cantidad debe ser mayor a 0",
      });
    }

    const product = await pool.query(`SELECT p.stock,p.estado FROM productos p JOIN carrito_items ci USING(id_producto) JOIN carritos c USING(id_carrito) WHERE ci.id_item=$1 AND c.id_usuario=$2`,[id,id_usuario]);
    if(!product.rows.length) return res.status(404).json({ok:false,message:'Producto no encontrado.'});
    if(product.rows[0].stock<qty || product.rows[0].estado.toLowerCase()!=='activo') return res.status(409).json({ok:false,message:'La cantidad supera el stock disponible.'});
    const result = await pool.query(
      `
      UPDATE carrito_items ci
      SET cantidad = $1
      FROM carritos c
      WHERE ci.id_item = $2
        AND ci.id_carrito = c.id_carrito
        AND c.id_usuario = $3
        AND c.estado = 'activo'
      RETURNING ci.id_item
      `,
      [qty, id, id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Item del carrito no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Cantidad actualizada correctamente",
    });
  } catch (error) {
    console.error("updateCartItemQuantity error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al actualizar cantidad",
    });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const id_usuario = req.user?.id_usuario || req.user?.id;
    const { id } = req.params;

    if (!id_usuario) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM carrito_items ci
      USING carritos c
      WHERE ci.id_item = $1
        AND ci.id_carrito = c.id_carrito
        AND c.id_usuario = $2
        AND c.estado = 'activo'
      RETURNING ci.id_item
      `,
      [id, id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Item del carrito no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Producto eliminado del carrito",
    });
  } catch (error) {
    console.error("removeCartItem error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al eliminar item del carrito",
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const id_usuario = req.user?.id_usuario || req.user?.id;

    if (!id_usuario) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const cartResult = await pool.query(
      `
      SELECT id_carrito
      FROM carritos
      WHERE id_usuario = $1 AND estado = 'activo'
      LIMIT 1
      `,
      [id_usuario]
    );

    if (cartResult.rows.length === 0) {
      return res.status(200).json({
        ok: true,
        message: "El carrito ya está vacío",
      });
    }

    await pool.query(
      `
      DELETE FROM carrito_items
      WHERE id_carrito = $1
      `,
      [cartResult.rows[0].id_carrito]
    );

    return res.status(200).json({
      ok: true,
      message: "Carrito vaciado correctamente",
    });
  } catch (error) {
    console.error("clearCart error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al vaciar el carrito",
    });
  }
};
