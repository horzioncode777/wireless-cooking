# Despliegue

La aplicación se puede ejecutar en un servidor Node.js o en la imagen definida por `Dockerfile`. PostgreSQL se configura por separado; no se incorpora una base con datos al contenedor ni al repositorio.

## Preparar la publicación

1. Instala las dependencias con `npm --prefix backend ci` y `npm --prefix frontend ci`.
2. Configura una base PostgreSQL propia y ejecuta `npm --prefix backend run db:migrate` después de revisar el esquema y preparar un respaldo si la base ya contiene datos.
3. Ejecuta `node scripts/build-production.mjs`.
4. Configura `NODE_ENV=production`, `SERVE_FRONTEND=true`, `FRONTEND_URL` y un `JWT_SECRET` aleatorio.
5. Inicia con `npm --prefix backend start`, detrás de un proxy HTTPS.

No se incluyen las credenciales, direcciones privadas ni herramientas específicas del servidor original. Utiliza el gestor de secretos del entorno o variables protegidas del servicio de alojamiento.

## PostgreSQL y recursos persistentes

Configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Para una conexión TLS, activa `DB_SSL=true` y usa `DB_SSL_CA_FILE` con el certificado público de confianza del proveedor. La aplicación verifica el certificado del servidor.

Si `IMAGE_STORAGE=local`, conserva `backend/uploads/` en un volumen persistente y respáldalo junto con la base. Si usas Cloudinary, configura sus variables en el backend. Los datos privados y los respaldos no se publican en GitHub.

## Proxy y comprobaciones

La API usa el puerto 6001 y expone `/api/health`. Limita el acceso directo al puerto si se sirve detrás de un proxy. `TRUST_PROXY=loopback` corresponde únicamente a un proxy local en la misma máquina. Para SSE, permite conexiones largas y desactiva buffering en `/api/catalog/events`.

Comprueba por separado el acceso de cada rol, la recuperación por correo, carga de imágenes, pedidos y la recepción de eventos Sandbox antes de habilitar integraciones de producción. Los scripts de verificación de servicios se ejecutan solo con la configuración correspondiente; las pruebas automáticas no sustituyen la validación del proveedor ni de la operación comercial.

## Docker

```sh
docker build -t wireless-cooking .
docker run --env-file backend/.env -p 6001:6001 wireless-cooking
```

La imagen ejecuta la aplicación como usuario sin privilegios, contiene la web compilada y tiene una comprobación de salud. Define las variables de producción en el entorno y conecta PostgreSQL y los volúmenes persistentes según tu infraestructura. Una dirección `127.0.0.1` dentro del contenedor apunta al propio contenedor, no al host.
