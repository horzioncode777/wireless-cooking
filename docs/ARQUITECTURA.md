# Arquitectura

El frontend React presenta las vistas de compradores, comerciantes y administradores. Los servicios de `frontend/src/services/` consumen la API Express. Los componentes compartidos están en `frontend/src/components/`; las utilidades comunes a web y API están en `shared/`.

La API organiza las rutas por dominio. Los middlewares comprueban sesión y rol antes de acceder a operaciones protegidas. Los controladores delegan reglas de pedidos, inventario, pagos, imágenes y recomendaciones en `backend/src/services/`.

PostgreSQL conserva usuarios, tiendas, productos, pedidos y operaciones relacionadas. Las reservas y actualizaciones de inventario usan transacciones y bloqueos; los precios finales se obtienen en el servidor. Los identificadores de reintento evitan duplicar pedidos o ajustes de stock.

## Servicios externos

| Servicio | Variables del backend | Uso |
| --- | --- | --- |
| Wompi | `PAYMENT_MODE`, `WOMPI_ENVIRONMENT`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Checkout y confirmación de transacciones |
| Gmail | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Recuperación de contraseña |
| Cloudinary | `IMAGE_STORAGE`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Almacenamiento de imágenes |
| IA opcional | `OPENAI_API_KEY`, `OPENAI_MODEL`, `CHAT_AI_DAILY_LIMIT` | Asistente sobre el catálogo |

En modo `demo` los pagos son simulados. Para Wompi se separan credenciales Sandbox y producción; el webhook es `/api/payments/wompi/events`. La API valida la firma del evento y consulta la transacción antes de acreditar el pago. No recibe números de tarjeta ni CVV.

La recuperación de contraseña usa códigos con caducidad y límite de intentos. La configuración y las claves permanecen en el servidor. Las recomendaciones de contenido usan TF-IDF y señales de actividad; no requieren un modelo de lenguaje.

El canal SSE del catálogo publica una revisión numérica para invalidar vistas y cachés. En una publicación detrás de proxy, `/api/catalog/events` necesita conexiones largas y buffering desactivado.

## Datos de ejemplo

Las tiendas y compradores del catálogo de demostración son ficticios. Las imágenes son recursos sintéticos. Los scripts de carga generan contraseñas nuevas para las cuentas de demostración y escriben sus accesos en archivos locales excluidos de Git.
