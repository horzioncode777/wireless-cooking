CREATE TABLE IF NOT EXISTS usuarios (
 id_usuario SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL, apellido VARCHAR(100), correo VARCHAR(150) UNIQUE NOT NULL,
 contrasena_hash TEXT NOT NULL, telefono VARCHAR(30), direccion TEXT, foto TEXT, rol TEXT NOT NULL DEFAULT 'comprador' CHECK(rol IN ('comprador','vendedor','admin')),
 estado TEXT NOT NULL DEFAULT 'activo', fecha_registro TIMESTAMPTZ DEFAULT now(), fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now(), token_version INT NOT NULL DEFAULT 0
);
-- Retiro de la verificación adicional por cambio de alcance (24 de octubre de 2026).
-- Solo se retiran estructuras vacías; se conserva cualquier dato histórico existente.
DO $$
DECLARE tabla TEXT; total BIGINT;
BEGIN
 FOREACH tabla IN ARRAY ARRAY['mfa_backup_codes','mfa_challenges','mfa_accounts'] LOOP
  IF to_regclass(tabla) IS NOT NULL THEN
   EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE',tabla);
   EXECUTE format('SELECT count(*) FROM %I',tabla) INTO total;
   IF total > 0 THEN RAISE EXCEPTION 'La tabla retirada % contiene datos históricos; no se ha eliminado.',tabla; END IF;
  END IF;
 END LOOP;
END $$;
-- Sin CASCADE: no se eliminan relaciones ajenas a estas tres tablas.
DROP TABLE IF EXISTS mfa_backup_codes;
DROP TABLE IF EXISTS mfa_challenges;
DROP TABLE IF EXISTS mfa_accounts;
CREATE TABLE IF NOT EXISTS preferencias_usuario (
 id_usuario INT PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 pedidos BOOLEAN NOT NULL DEFAULT true,
 resenas BOOLEAN NOT NULL DEFAULT true,
 novedades BOOLEAN NOT NULL DEFAULT true,
 fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vendedores (
 id_vendedor SERIAL PRIMARY KEY, id_usuario INT UNIQUE NOT NULL REFERENCES usuarios(id_usuario), nombre_tienda VARCHAR(150) NOT NULL,
 descripcion TEXT, logo TEXT, banner_url TEXT, ciudad TEXT DEFAULT 'Cajicá', verificado BOOLEAN DEFAULT false,
 calificacion NUMERIC DEFAULT 0, total_resenas INT DEFAULT 0, fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categorias (id_categoria SERIAL PRIMARY KEY, nombre VARCHAR(100) UNIQUE NOT NULL, descripcion TEXT);
CREATE TABLE IF NOT EXISTS productos (
 id_producto SERIAL PRIMARY KEY, id_vendedor INT REFERENCES vendedores(id_vendedor), id_categoria INT NOT NULL REFERENCES categorias(id_categoria),
 nombre VARCHAR(150) NOT NULL, descripcion TEXT NOT NULL, precio NUMERIC(12,2) NOT NULL CHECK(precio>=0), stock INT NOT NULL CHECK(stock>=0),
 material TEXT, imagen TEXT, estado TEXT DEFAULT 'activo', vistas INT DEFAULT 0, ventas INT DEFAULT 0,
 fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS carritos (id_carrito SERIAL PRIMARY KEY, id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), estado TEXT DEFAULT 'activo');
CREATE UNIQUE INDEX IF NOT EXISTS carrito_activo_usuario ON carritos(id_usuario) WHERE estado='activo';
CREATE TABLE IF NOT EXISTS carrito_items (id_item SERIAL PRIMARY KEY, id_carrito INT REFERENCES carritos(id_carrito) ON DELETE CASCADE, id_producto INT REFERENCES productos(id_producto), cantidad INT NOT NULL CHECK(cantidad>0), UNIQUE(id_carrito,id_producto));
CREATE TABLE IF NOT EXISTS favoritos (id SERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE, fecha_agregado TIMESTAMPTZ DEFAULT now(), UNIQUE(id_usuario,id_producto));
CREATE TABLE IF NOT EXISTS resenas_producto (id_resena SERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE, puntuacion INT CHECK(puntuacion BETWEEN 1 AND 5), comentario TEXT, fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now(), UNIQUE(id_producto,id_usuario));
CREATE TABLE IF NOT EXISTS pedidos (
 id_pedido SERIAL PRIMARY KEY, id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), total NUMERIC(12,2) NOT NULL, estado TEXT DEFAULT 'pendiente',
 direccion_entrega TEXT NOT NULL, metodo_pago TEXT NOT NULL, envio NUMERIC(12,2) DEFAULT 0, referencia TEXT UNIQUE,
 clave_idempotencia TEXT, fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now(), UNIQUE(id_usuario,clave_idempotencia)
);
CREATE TABLE IF NOT EXISTS detalle_pedido (id_detalle SERIAL PRIMARY KEY, id_pedido INT REFERENCES pedidos(id_pedido), id_producto INT REFERENCES productos(id_producto), nombre_producto TEXT, cantidad INT CHECK(cantidad>0), precio_unitario NUMERIC(12,2), subtotal NUMERIC(12,2));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS transportadora VARCHAR(100);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS guia VARCHAR(100);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fecha_estimada DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nota_entrega VARCHAR(1000);
UPDATE pedidos SET tipo_entrega=CASE WHEN direccion_entrega LIKE 'Recogida en tienda,%' THEN 'recogida' WHEN envio>0 THEN 'envio' ELSE NULL END WHERE tipo_entrega IS NULL;
CREATE INDEX IF NOT EXISTS detalle_por_pedido ON detalle_pedido(id_pedido);
CREATE TABLE IF NOT EXISTS pedido_historial (
 id BIGSERIAL PRIMARY KEY,
 id_pedido INT NOT NULL REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
 estado TEXT NOT NULL,
 tipo TEXT NOT NULL DEFAULT 'estado',
 mensaje TEXT NOT NULL,
 fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historial_por_pedido ON pedido_historial(id_pedido,fecha,id);
INSERT INTO pedido_historial(id_pedido,estado,tipo,mensaje,fecha)
SELECT p.id_pedido,p.estado,'registro','Estado existente al activar el seguimiento.',COALESCE(p.fecha_actualizacion,p.fecha_creacion,now()) FROM pedidos p WHERE NOT EXISTS(SELECT 1 FROM pedido_historial h WHERE h.id_pedido=p.id_pedido);
CREATE TABLE IF NOT EXISTS pagos (id_pago SERIAL PRIMARY KEY, id_pedido INT UNIQUE REFERENCES pedidos(id_pedido), monto NUMERIC(12,2), metodo_pago TEXT, estado_pago TEXT DEFAULT 'pendiente', referencia TEXT UNIQUE, transaccion TEXT UNIQUE, fecha_pago TIMESTAMPTZ DEFAULT now());
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS ambiente TEXT;
CREATE TABLE IF NOT EXISTS metodos_pago (id SERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), tipo TEXT, numero TEXT);
CREATE TABLE IF NOT EXISTS pqr (id_pqr SERIAL PRIMARY KEY, id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), tipo TEXT NOT NULL CHECK(tipo IN ('peticion','queja','reclamo')), asunto VARCHAR(150) NOT NULL, descripcion TEXT NOT NULL, estado TEXT DEFAULT 'abierta', respuesta TEXT, fecha_creacion TIMESTAMPTZ DEFAULT now(), fecha_actualizacion TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS historial_navegacion (id BIGSERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE, fecha TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS chatbot_logs (id BIGSERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), pregunta TEXT, respuesta TEXT, modo TEXT, fecha TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS password_resets (id SERIAL PRIMARY KEY, id_usuario INT REFERENCES usuarios(id_usuario), token_hash TEXT UNIQUE NOT NULL, expira TIMESTAMPTZ NOT NULL);
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS version_cuenta INT NOT NULL DEFAULT 0;
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS correo_cuenta TEXT;
CREATE INDEX IF NOT EXISTS password_reset_user ON password_resets(id_usuario);
CREATE TABLE IF NOT EXISTS chat_ai_daily_usage (
 dia DATE PRIMARY KEY,
 solicitudes INT NOT NULL CHECK (solicitudes > 0)
);

CREATE TABLE IF NOT EXISTS password_recovery_codes (
 id UUID PRIMARY KEY,
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 codigo_hash TEXT NOT NULL,
 correo_cuenta TEXT NOT NULL,
 version_cuenta INT NOT NULL,
 intentos INT NOT NULL DEFAULT 0 CHECK(intentos BETWEEN 0 AND 5),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 expira TIMESTAMPTZ NOT NULL,
 UNIQUE(id_usuario)
);
CREATE INDEX IF NOT EXISTS producto_vendedor ON productos(id_vendedor);
CREATE INDEX IF NOT EXISTS pedido_usuario ON pedidos(id_usuario,fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS detalle_producto ON detalle_pedido(id_producto);
CREATE INDEX IF NOT EXISTS historial_usuario ON historial_navegacion(id_usuario,fecha DESC);
CREATE INDEX IF NOT EXISTS pqr_usuario ON pqr(id_usuario);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS galeria JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS ficha JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS perfil_publico JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio NUMERIC(12,2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS referencia TEXT UNIQUE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS clave_idempotencia TEXT;
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS nombre_producto TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pedido_idempotencia ON pedidos(id_usuario,clave_idempotencia);
INSERT INTO categorias(nombre) VALUES ('Cerámica'),('Acero inoxidable'),('Utensilios'),('Artesanías'),('Vajillas'),('Accesorios'),('Decoración') ON CONFLICT DO NOTHING;

-- A transactional revision detects API writes, checkout reservations and direct SQL updates.
CREATE TABLE IF NOT EXISTS catalog_revision (id INT PRIMARY KEY CHECK(id=1), revision BIGINT NOT NULL DEFAULT 0);
INSERT INTO catalog_revision(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION bump_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE catalog_revision SET revision=revision+1 WHERE id=1;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS catalog_product_write ON productos;
CREATE TRIGGER catalog_product_write AFTER INSERT OR DELETE OR UPDATE OF nombre,descripcion,material,precio,stock,imagen,galeria,ficha,estado,id_categoria,id_vendedor,ventas ON productos FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_revision();
DROP TRIGGER IF EXISTS catalog_review_write ON resenas_producto;
CREATE TRIGGER catalog_review_write AFTER INSERT OR UPDATE OR DELETE ON resenas_producto FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_revision();
DROP TRIGGER IF EXISTS catalog_seller_write ON vendedores;
CREATE TRIGGER catalog_seller_write AFTER INSERT OR DELETE OR UPDATE OF nombre_tienda,descripcion,logo,banner_url,ciudad,perfil_publico,verificado ON vendedores FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_revision();
DROP TRIGGER IF EXISTS catalog_user_status ON usuarios;
CREATE TRIGGER catalog_user_status AFTER UPDATE OF estado ON usuarios FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_revision();
DROP TRIGGER IF EXISTS catalog_category_write ON categorias;
CREATE TRIGGER catalog_category_write AFTER INSERT OR UPDATE OR DELETE ON categorias FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_revision();
CREATE INDEX IF NOT EXISTS reviews_product_rating ON resenas_producto(id_producto,puntuacion);
CREATE INDEX IF NOT EXISTS history_user_product_date ON historial_navegacion(id_usuario,id_producto,fecha DESC);
CREATE INDEX IF NOT EXISTS active_product_category ON productos(id_categoria,id_producto) WHERE lower(estado)='activo';
CREATE INDEX IF NOT EXISTS detail_order ON detalle_pedido(id_pedido);

-- In-app inbox. Domain events are recorded in the same transaction as the change.
CREATE TABLE IF NOT EXISTS notificaciones (
 id BIGSERIAL PRIMARY KEY,
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
 tipo TEXT NOT NULL,
 titulo TEXT NOT NULL,
 mensaje TEXT NOT NULL,
 destino TEXT NOT NULL,
 nivel TEXT NOT NULL DEFAULT 'info' CHECK(nivel IN ('info','success','warning','error')),
 clave_evento TEXT,
 leida_en TIMESTAMPTZ,
 fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id_usuario,clave_evento)
);
CREATE INDEX IF NOT EXISTS notificacion_usuario_id ON notificaciones(id_usuario,id DESC);
CREATE INDEX IF NOT EXISTS notificacion_sin_leer ON notificaciones(id_usuario) WHERE leida_en IS NULL;

CREATE OR REPLACE FUNCTION avisar_usuario(uid INT, tipo TEXT, titulo TEXT, mensaje TEXT, destino TEXT, nivel TEXT DEFAULT 'info', clave TEXT DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
 INSERT INTO notificaciones(id_usuario,tipo,titulo,mensaje,destino,nivel,clave_evento)
 SELECT uid,tipo,titulo,mensaje,destino,nivel,clave WHERE uid IS NOT NULL
 AND COALESCE((SELECT CASE
  WHEN $2 IN ('pedido','venta','pago') THEN p.pedidos
  WHEN $2='resena' THEN p.resenas
  WHEN $2 IN ('producto','inventario','favoritos','tienda','carrito') THEN p.novedades
  ELSE true END FROM preferencias_usuario p WHERE p.id_usuario=$1),true)
 ON CONFLICT(id_usuario,clave_evento) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION notificar_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE titulo_evento TEXT; mensaje_evento TEXT; nivel_evento TEXT; destinatario RECORD;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
 END IF;
 titulo_evento := CASE NEW.estado WHEN 'pendiente' THEN 'Pedido recibido' WHEN 'pagado' THEN 'Pedido pagado' WHEN 'empacando' THEN 'Estamos empacando tu pedido' WHEN 'enviado' THEN CASE WHEN NEW.tipo_entrega='recogida' THEN 'Tu pedido está listo para recoger' ELSE 'Tu pedido está en camino' END WHEN 'entregado' THEN 'Pedido entregado' WHEN 'cancelado' THEN 'Pedido cancelado' ELSE 'Pedido actualizado' END;
 mensaje_evento := 'Pedido #' || NEW.id_pedido || ': ' || CASE NEW.estado WHEN 'pendiente' THEN 'creado y pendiente de completar el pago.' WHEN 'pagado' THEN 'el pago fue confirmado. Prepararemos tu compra.' WHEN 'empacando' THEN 'estamos empacando tus productos para la entrega.' WHEN 'enviado' THEN CASE WHEN NEW.tipo_entrega='recogida' THEN 'está listo para recoger. Consulta el punto y horario en el detalle.' ELSE 'ya fue despachado. Consulta el detalle de tu compra.' END WHEN 'entregado' THEN 'marcado como entregado. ¡Gracias por tu compra!' WHEN 'cancelado' THEN 'fue cancelado. Revisa el detalle del pago antes de volver a comprar.' ELSE NEW.estado END;
 nivel_evento := CASE WHEN NEW.estado='cancelado' THEN 'warning' WHEN NEW.estado IN ('pagado','entregado') THEN 'success' ELSE 'info' END;
 PERFORM avisar_usuario(NEW.id_usuario,'pedido',titulo_evento,mensaje_evento,'/pedido/' || NEW.id_pedido,nivel_evento,'pedido:' || NEW.id_pedido || ':' || NEW.estado);
 FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' LOOP
  PERFORM avisar_usuario(destinatario.id_usuario,'pedido',CASE WHEN TG_OP='INSERT' THEN 'Nuevo pedido' ELSE 'Estado de pedido actualizado' END,mensaje_evento,'/admin/pedidos',nivel_evento,'pedido:' || NEW.id_pedido || ':' || NEW.estado);
 END LOOP;
 IF TG_OP='UPDATE' THEN
  FOR destinatario IN SELECT DISTINCT v.id_usuario FROM detalle_pedido d JOIN productos p USING(id_producto) JOIN vendedores v USING(id_vendedor) WHERE d.id_pedido=NEW.id_pedido LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'venta',titulo_evento,mensaje_evento,'/vendedor/pedido/' || NEW.id_pedido,nivel_evento,'pedido:' || NEW.id_pedido || ':' || NEW.estado);
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_pedido ON pedidos;
CREATE TRIGGER avisos_pedido AFTER INSERT OR UPDATE OF estado ON pedidos FOR EACH ROW EXECUTE FUNCTION notificar_pedido();

CREATE OR REPLACE FUNCTION notificar_detalle_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE vendedor_usuario INT;
BEGIN
 SELECT v.id_usuario INTO vendedor_usuario FROM productos p JOIN vendedores v USING(id_vendedor) WHERE p.id_producto=NEW.id_producto;
 PERFORM avisar_usuario(vendedor_usuario,'venta','Tienes un nuevo pedido','El pedido #' || NEW.id_pedido || ' incluye productos de tu tienda. El pago aún debe confirmarse.','/vendedor/pedido/' || NEW.id_pedido,'info','pedido:' || NEW.id_pedido || ':pendiente');
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_venta ON detalle_pedido;
CREATE TRIGGER avisos_venta AFTER INSERT ON detalle_pedido FOR EACH ROW EXECUTE FUNCTION notificar_detalle_pedido();

CREATE OR REPLACE FUNCTION notificar_pago() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE comprador INT;
BEGIN
 IF NEW.estado_pago IS NOT DISTINCT FROM OLD.estado_pago OR NEW.estado_pago='pendiente' THEN RETURN NEW; END IF;
 SELECT id_usuario INTO comprador FROM pedidos WHERE id_pedido=NEW.id_pedido;
 PERFORM avisar_usuario(comprador,'pago',CASE WHEN NEW.estado_pago='aprobado' THEN 'Pago confirmado' WHEN NEW.estado_pago='rechazado' THEN 'Pago no aprobado' ELSE 'Pago cancelado' END,
  CASE WHEN NEW.estado_pago='aprobado' THEN 'Se confirmó el pago del pedido #' WHEN NEW.estado_pago='rechazado' THEN 'El proveedor no aprobó el pago del pedido #' ELSE 'Se canceló el pago del pedido #' END || NEW.id_pedido || '. Consulta el detalle de la transacción.',
  '/pedido/' || NEW.id_pedido,CASE WHEN NEW.estado_pago='aprobado' THEN 'success' ELSE 'warning' END,'pago:' || NEW.id_pago || ':' || NEW.estado_pago);
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_pago ON pagos;
CREATE TRIGGER avisos_pago AFTER UPDATE OF estado_pago ON pagos FOR EACH ROW EXECUTE FUNCTION notificar_pago();

CREATE OR REPLACE FUNCTION notificar_pqr() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destinatario RECORD;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM avisar_usuario(NEW.id_usuario,'pqr','Recibimos tu solicitud','Tu PQR #' || NEW.id_pqr || ' fue registrada. Te avisaremos cuando tenga una respuesta.','/pqr','success');
  FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'pqr','Nueva PQR por atender','Se registró la solicitud #' || NEW.id_pqr || ': ' || NEW.asunto,'/admin/pqr');
  END LOOP;
 ELSIF NEW.estado IS DISTINCT FROM OLD.estado OR NEW.respuesta IS DISTINCT FROM OLD.respuesta THEN
  PERFORM avisar_usuario(NEW.id_usuario,'pqr',CASE WHEN NEW.respuesta IS DISTINCT FROM OLD.respuesta AND COALESCE(NEW.respuesta,'')<>'' THEN 'Tienes una respuesta a tu PQR' ELSE 'Estado de tu PQR actualizado' END,'La solicitud #' || NEW.id_pqr || ' está ' || replace(NEW.estado,'_',' ') || '. Abre tus PQR para consultar el detalle.','/pqr',CASE WHEN NEW.estado='resuelta' THEN 'success' ELSE 'info' END);
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_pqr ON pqr;
CREATE TRIGGER avisos_pqr AFTER INSERT OR UPDATE OF estado,respuesta ON pqr FOR EACH ROW EXECUTE FUNCTION notificar_pqr();

CREATE OR REPLACE FUNCTION notificar_cuenta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destinatario RECORD; perfil TEXT;
BEGIN
 perfil := CASE NEW.rol WHEN 'admin' THEN '/admin/configuracion' WHEN 'vendedor' THEN '/perfil-vendedor' ELSE '/perfil' END;
 IF TG_OP='INSERT' THEN
  PERFORM avisar_usuario(NEW.id_usuario,'cuenta','¡Bienvenido a Wireless Cooking!','Tu cuenta está lista. Aquí encontrarás las novedades de tus compras, solicitudes y cuenta.',perfil,'success','bienvenida');
  FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' AND id_usuario<>NEW.id_usuario LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'cuenta','Nueva cuenta registrada','Se registró una cuenta de ' || NEW.rol || ': ' || NEW.nombre || '.', '/admin/usuarios');
  END LOOP;
 ELSE
  IF NEW.contrasena_hash IS DISTINCT FROM OLD.contrasena_hash THEN
   PERFORM avisar_usuario(NEW.id_usuario,'seguridad','Contraseña actualizada','La contraseña de tu cuenta cambió. Si no reconoces este cambio, contacta con soporte.','/pqr','warning');
  END IF;
  IF NEW.correo IS DISTINCT FROM OLD.correo OR NEW.telefono IS DISTINCT FROM OLD.telefono OR NEW.direccion IS DISTINCT FROM OLD.direccion OR NEW.nombre IS DISTINCT FROM OLD.nombre OR NEW.apellido IS DISTINCT FROM OLD.apellido OR NEW.foto IS DISTINCT FROM OLD.foto THEN
   PERFORM avisar_usuario(NEW.id_usuario,'cuenta','Perfil actualizado','Se guardaron cambios en los datos de tu perfil.',perfil,'success');
  END IF;
  IF NEW.rol IS DISTINCT FROM OLD.rol OR NEW.estado IS DISTINCT FROM OLD.estado THEN
   PERFORM avisar_usuario(NEW.id_usuario,'seguridad','Cambio en tu cuenta','Tu cuenta tiene el rol ' || NEW.rol || ' y el estado ' || NEW.estado || '.','/pqr','warning');
   FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' AND id_usuario<>NEW.id_usuario LOOP
    PERFORM avisar_usuario(destinatario.id_usuario,'cuenta','Permisos o estado de cuenta actualizados','Se modificó la cuenta de ' || NEW.nombre || '.','/admin/usuarios','warning');
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_cuenta ON usuarios;
CREATE TRIGGER avisos_cuenta AFTER INSERT OR UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION notificar_cuenta();

CREATE OR REPLACE FUNCTION notificar_tienda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destinatario RECORD;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM avisar_usuario(NEW.id_usuario,'tienda','Tu tienda está lista','Ya puedes publicar productos y administrar ' || NEW.nombre_tienda || '.','/vendedor','success');
  FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'tienda','Nueva tienda registrada','La tienda ' || NEW.nombre_tienda || ' se unió al marketplace.','/admin/vendedores');
  END LOOP;
 ELSIF NEW.verificado IS DISTINCT FROM OLD.verificado THEN
  PERFORM avisar_usuario(NEW.id_usuario,'tienda',CASE WHEN NEW.verificado THEN 'Tu tienda fue verificada' ELSE 'Verificación de tienda actualizada' END,'Consulta el estado de ' || NEW.nombre_tienda || ' en tu perfil de vendedor.','/perfil-vendedor','info');
 ELSIF NEW.nombre_tienda IS DISTINCT FROM OLD.nombre_tienda OR NEW.descripcion IS DISTINCT FROM OLD.descripcion OR NEW.logo IS DISTINCT FROM OLD.logo OR NEW.banner_url IS DISTINCT FROM OLD.banner_url OR NEW.ciudad IS DISTINCT FROM OLD.ciudad THEN
  PERFORM avisar_usuario(NEW.id_usuario,'tienda','Tienda actualizada','Se guardaron los cambios de tu tienda.','/perfil-vendedor','success');
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_tienda ON vendedores;
CREATE TRIGGER avisos_tienda AFTER INSERT OR UPDATE ON vendedores FOR EACH ROW EXECUTE FUNCTION notificar_tienda();

CREATE OR REPLACE FUNCTION notificar_producto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE propietario INT; destinatario RECORD; nombre_producto TEXT;
BEGIN
 nombre_producto := CASE WHEN TG_OP='DELETE' THEN OLD.nombre ELSE NEW.nombre END;
 SELECT id_usuario INTO propietario FROM vendedores WHERE id_vendedor=CASE WHEN TG_OP='DELETE' THEN OLD.id_vendedor ELSE NEW.id_vendedor END;
 IF TG_OP='DELETE' THEN
  PERFORM avisar_usuario(propietario,'producto','Producto eliminado',nombre_producto || ' fue eliminado del catálogo.','/perfil-vendedor','warning');
  RETURN OLD;
 ELSIF TG_OP='INSERT' THEN
  PERFORM avisar_usuario(propietario,'producto','Producto creado',nombre_producto || ' ya está en tu inventario.','/perfil-vendedor','success');
  IF NEW.stock<=5 THEN
   PERFORM avisar_usuario(propietario,'inventario',CASE WHEN NEW.stock=0 THEN 'Producto sin existencias' ELSE 'Inventario inicial bajo' END,nombre_producto || ': ' || NEW.stock || ' unidades disponibles.','/perfil-vendedor','warning');
   FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' AND id_usuario IS DISTINCT FROM propietario LOOP
    PERFORM avisar_usuario(destinatario.id_usuario,'inventario','Revisa el inventario inicial',nombre_producto || ': ' || NEW.stock || ' unidades disponibles.','/admin/productos','warning');
   END LOOP;
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.estado IS DISTINCT FROM OLD.estado THEN
  PERFORM avisar_usuario(propietario,'producto','Disponibilidad del producto actualizada',nombre_producto || ': estado ' || NEW.estado || '.','/perfil-vendedor','info');
 END IF;
 IF NEW.stock=0 AND OLD.stock>0 OR NEW.stock BETWEEN 1 AND 5 AND OLD.stock>5 THEN
  PERFORM avisar_usuario(propietario,'inventario',CASE WHEN NEW.stock=0 THEN 'Producto agotado' ELSE 'Quedan pocas unidades' END,nombre_producto || ': ' || NEW.stock || ' unidades disponibles.','/perfil-vendedor','warning');
  FOR destinatario IN SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo' AND id_usuario IS DISTINCT FROM propietario LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'inventario',CASE WHEN NEW.stock=0 THEN 'Producto agotado' ELSE 'Inventario bajo' END,nombre_producto || ': ' || NEW.stock || ' unidades disponibles.','/admin/productos','warning');
  END LOOP;
 END IF;
 IF (NEW.stock=0 AND OLD.stock>0) OR (NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado<>'activo') THEN
  FOR destinatario IN SELECT DISTINCT c.id_usuario FROM carritos c JOIN carrito_items ci USING(id_carrito) WHERE ci.id_producto=NEW.id_producto AND c.estado='activo' AND c.id_usuario IS DISTINCT FROM NULLIF(current_setting('app.checkout_user',true),'')::int LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'carrito','Revisa un producto de tu carrito',nombre_producto || ' ya no está disponible. Revisa tu carrito antes de pagar.','/carrito','warning');
  END LOOP;
 END IF;
 IF (NEW.stock>0 AND OLD.stock=0 AND NEW.estado='activo') OR (NEW.estado='activo' AND OLD.estado<>'activo' AND NEW.stock>0) OR (NEW.precio<OLD.precio AND NEW.estado='activo') THEN
  FOR destinatario IN SELECT id_usuario FROM favoritos WHERE id_producto=NEW.id_producto LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'favoritos',CASE WHEN NEW.stock>0 AND (OLD.stock=0 OR OLD.estado<>'activo') THEN 'Un favorito volvió al catálogo' ELSE 'Bajó el precio de un favorito' END,nombre_producto || ': consulta su precio y disponibilidad actuales.','/producto/' || NEW.id_producto,'info');
  END LOOP;
 END IF;
 IF NEW.precio IS DISTINCT FROM OLD.precio THEN
  FOR destinatario IN SELECT DISTINCT c.id_usuario FROM carritos c JOIN carrito_items ci USING(id_carrito) WHERE ci.id_producto=NEW.id_producto AND c.estado='activo' LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'carrito','Cambió el precio de un producto',nombre_producto || ' tiene un nuevo precio. Revisa el total antes de continuar.','/carrito','info');
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_producto ON productos;
CREATE TRIGGER avisos_producto AFTER INSERT OR DELETE OR UPDATE OF stock,precio,estado ON productos FOR EACH ROW EXECUTE FUNCTION notificar_producto();

CREATE OR REPLACE FUNCTION notificar_resena() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE propietario INT; nombre_producto TEXT;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.puntuacion IS NOT DISTINCT FROM OLD.puntuacion AND NEW.comentario IS NOT DISTINCT FROM OLD.comentario THEN RETURN NEW; END IF;
 END IF;
 SELECT v.id_usuario,p.nombre INTO propietario,nombre_producto FROM productos p JOIN vendedores v USING(id_vendedor) WHERE p.id_producto=NEW.id_producto;
 IF propietario IS DISTINCT FROM NEW.id_usuario THEN
  PERFORM avisar_usuario(propietario,'resena',CASE WHEN TG_OP='INSERT' THEN 'Nueva reseña en tu producto' ELSE 'Una reseña fue actualizada' END,nombre_producto || ' recibió una calificación de ' || NEW.puntuacion || '/5.','/producto/' || NEW.id_producto,'info');
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS avisos_resena ON resenas_producto;
CREATE TRIGGER avisos_resena AFTER INSERT OR UPDATE ON resenas_producto FOR EACH ROW EXECUTE FUNCTION notificar_resena();

CREATE OR REPLACE FUNCTION registrar_historial_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destinatario RECORD;
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO pedido_historial(id_pedido,estado,mensaje) VALUES(NEW.id_pedido,NEW.estado,'Pedido creado.');
  RETURN NEW;
 END IF;
 IF NEW.estado IS DISTINCT FROM OLD.estado THEN
  INSERT INTO pedido_historial(id_pedido,estado,mensaje) VALUES(NEW.id_pedido,NEW.estado,'Estado del pedido actualizado.');
 END IF;
 IF ROW(NEW.transportadora,NEW.guia,NEW.fecha_estimada,NEW.nota_entrega) IS DISTINCT FROM ROW(OLD.transportadora,OLD.guia,OLD.fecha_estimada,OLD.nota_entrega) THEN
  INSERT INTO pedido_historial(id_pedido,estado,tipo,mensaje) VALUES(NEW.id_pedido,NEW.estado,'entrega','Datos de entrega actualizados por el equipo.');
  PERFORM avisar_usuario(NEW.id_usuario,'pedido','Actualizamos la entrega de tu pedido','Pedido #' || NEW.id_pedido || ': consulta los datos de entrega actualizados.','/pedido/' || NEW.id_pedido,'info');
  FOR destinatario IN SELECT DISTINCT v.id_usuario FROM detalle_pedido d JOIN productos p USING(id_producto) JOIN vendedores v USING(id_vendedor) WHERE d.id_pedido=NEW.id_pedido LOOP
   PERFORM avisar_usuario(destinatario.id_usuario,'venta','Entrega del pedido actualizada','Pedido #' || NEW.id_pedido || ': revisa las indicaciones de despacho en tu planilla.','/vendedor/pedido/' || NEW.id_pedido,'info');
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS historial_pedido ON pedidos;
CREATE TRIGGER historial_pedido AFTER INSERT OR UPDATE OF estado,transportadora,guia,fecha_estimada,nota_entrega ON pedidos FOR EACH ROW EXECUTE FUNCTION registrar_historial_pedido();
-- Route existing seller order notices to the corresponding private dispatch sheet.
UPDATE notificaciones SET destino='/vendedor/pedido/' || split_part(clave_evento,':',2) WHERE tipo='venta' AND destino='/vendedor' AND clave_evento ~ '^pedido:[0-9]+:';

CREATE TABLE IF NOT EXISTS postventa (
 id SERIAL PRIMARY KEY, id_pedido INT NOT NULL REFERENCES pedidos(id_pedido),
 id_detalle INT NOT NULL REFERENCES detalle_pedido(id_detalle),
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor),
 cantidad INT NOT NULL CHECK(cantidad>0), motivo TEXT NOT NULL, descripcion TEXT NOT NULL,
 estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta','en_revision','aprobada','en_devolucion','recibida','reembolso_pendiente','resuelta','rechazada')),
 solucion TEXT CHECK(solucion IN ('reembolso','cambio','garantia','orientacion')),
 requiere_devolucion BOOLEAN NOT NULL DEFAULT false, transportadora TEXT, guia TEXT,
 monto_reembolso NUMERIC(12,2), referencia_reembolso TEXT, fecha_reembolso TIMESTAMPTZ,
 ambiente TEXT, version INT NOT NULL DEFAULT 0, fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(), fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One case per purchased line: reopening after rejection is handled in the same history.
CREATE UNIQUE INDEX IF NOT EXISTS postventa_por_producto_pedido ON postventa(id_detalle);
CREATE INDEX IF NOT EXISTS postventa_por_usuario ON postventa(id_usuario,fecha_actualizacion DESC);
CREATE INDEX IF NOT EXISTS postventa_por_tienda ON postventa(id_vendedor,fecha_actualizacion DESC);
CREATE UNIQUE INDEX IF NOT EXISTS postventa_reembolso_unico ON postventa(referencia_reembolso) WHERE referencia_reembolso IS NOT NULL;
CREATE TABLE IF NOT EXISTS postventa_historial (
 id BIGSERIAL PRIMARY KEY, id_postventa INT NOT NULL REFERENCES postventa(id) ON DELETE CASCADE,
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), rol TEXT NOT NULL, estado TEXT NOT NULL,
 mensaje TEXT NOT NULL, fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS postventa_evidencias (
 id SERIAL PRIMARY KEY, id_postventa INT NOT NULL REFERENCES postventa(id) ON DELETE CASCADE,
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 datos BYTEA NOT NULL CHECK(octet_length(datos)<=5242880), fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postventa_historial_caso ON postventa_historial(id_postventa,id);
CREATE INDEX IF NOT EXISTS postventa_evidencias_caso ON postventa_evidencias(id_postventa,id);
CREATE TABLE IF NOT EXISTS pedido_empaque (
 id_pedido INT NOT NULL REFERENCES pedidos(id_pedido), id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor),
 bultos INT NOT NULL DEFAULT 1 CHECK(bultos BETWEEN 1 AND 100), peso NUMERIC(8,2), alto NUMERIC(8,2), ancho NUMERIC(8,2), largo NUMERIC(8,2),
 preparado_por VARCHAR(100) NOT NULL DEFAULT '', notas VARCHAR(1000) NOT NULL DEFAULT '', fragil BOOLEAN NOT NULL DEFAULT true,
 revisados JSONB NOT NULL DEFAULT '[]', version INT NOT NULL DEFAULT 0, fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(id_pedido,id_vendedor)
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nombre_destinatario TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefono_entrega TEXT;
CREATE TABLE IF NOT EXISTS pedido_entregas (
 id_pedido INT NOT NULL REFERENCES pedidos(id_pedido), id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor),
 estado TEXT NOT NULL CHECK(estado IN ('pagado','empacando','enviado','entregado')),
 transportadora VARCHAR(100), guia VARCHAR(100), fecha_estimada DATE, nota_entrega VARCHAR(1000),
 version INT NOT NULL DEFAULT 1, fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(id_pedido,id_vendedor)
);

CREATE TABLE IF NOT EXISTS monedero_recepciones (
 id_pedido INT NOT NULL REFERENCES pedidos(id_pedido), id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor),
 id_usuario INT NOT NULL REFERENCES usuarios(id_usuario), fecha TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(id_pedido,id_vendedor)
);
CREATE TABLE IF NOT EXISTS monedero_destinos (
 id SERIAL PRIMARY KEY, id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor),
 tipo TEXT NOT NULL CHECK(tipo IN ('nequi','banco')), alias VARCHAR(60) NOT NULL,
 ultimos VARCHAR(4) NOT NULL, activo BOOLEAN NOT NULL DEFAULT true, fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS monedero_retiros (
 id SERIAL PRIMARY KEY, id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor), id_destino INT NOT NULL REFERENCES monedero_destinos(id),
 monto_centavos BIGINT NOT NULL CHECK(monto_centavos>0), estado TEXT NOT NULL DEFAULT 'solicitado' CHECK(estado IN ('solicitado','simulado','cancelado','rechazado')),
 clave VARCHAR(100) NOT NULL, tipo_destino TEXT NOT NULL, alias_destino VARCHAR(60) NOT NULL, ultimos VARCHAR(4) NOT NULL,
 nota VARCHAR(1000), ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK(ambiente='sandbox'), fecha TIMESTAMPTZ NOT NULL DEFAULT now(), fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id_vendedor,clave)
);
CREATE TABLE IF NOT EXISTS monedero_movimientos (
 id BIGSERIAL PRIMARY KEY, id_vendedor INT NOT NULL REFERENCES vendedores(id_vendedor), clave TEXT NOT NULL,
 tipo TEXT NOT NULL, monto_centavos BIGINT NOT NULL, descripcion TEXT NOT NULL, id_pedido INT REFERENCES pedidos(id_pedido),
 fecha TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(id_vendedor,clave)
);
CREATE INDEX IF NOT EXISTS monedero_retiros_tienda ON monedero_retiros(id_vendedor,estado);
CREATE INDEX IF NOT EXISTS monedero_historial_tienda ON monedero_movimientos(id_vendedor,id DESC);

ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS id_vendedor_compra INT REFERENCES vendedores(id_vendedor);
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS vendedor_compra_registrado BOOLEAN NOT NULL DEFAULT false;
UPDATE detalle_pedido d SET id_vendedor_compra=p.id_vendedor,vendedor_compra_registrado=true FROM productos p WHERE p.id_producto=d.id_producto AND NOT d.vendedor_compra_registrado;
CREATE OR REPLACE FUNCTION fijar_vendedor_compra() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT id_vendedor INTO NEW.id_vendedor_compra FROM productos WHERE id_producto=NEW.id_producto;
  NEW.vendedor_compra_registrado:=true;
 ELSIF OLD.vendedor_compra_registrado AND (NEW.id_vendedor_compra IS DISTINCT FROM OLD.id_vendedor_compra OR NOT NEW.vendedor_compra_registrado OR NEW.id_producto IS DISTINCT FROM OLD.id_producto) THEN
  RAISE EXCEPTION 'El vendedor de una compra registrada no se puede cambiar';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vendedor_original_compra ON detalle_pedido;
CREATE TRIGGER vendedor_original_compra BEFORE INSERT OR UPDATE ON detalle_pedido FOR EACH ROW EXECUTE FUNCTION fijar_vendedor_compra();
