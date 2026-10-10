# Florería · PHP y MySQL

Tienda construida con PHP 8.1+, MySQL 8, HTML, CSS y JavaScript. No requiere Node, Composer ni un framework. Incluye 437 productos y sus imágenes extraídas de la copia local suministrada de `magia.pe`.

El frontend reproduce la referencia con fondo blanco, azul marino `#273654`, turquesa `#7fc9ca`, fuentes locales **Oswald y DM Sans**, logotipo, fotografías y videos originales. Incluye los banners «Girasoles para ella» y «Gesto a Gesto», carruseles de productos y ocasiones, videos de regalos, la sección de cuatro pasos y fotografías de temporada. Las imágenes son del material suministrado; no se generaron con IA.

## Abrir en este equipo

Ejecuta **INICIAR.bat**. Abre la tienda en http://127.0.0.1:8080 y el panel en http://127.0.0.1:8080/admin.php.

La configuración local usa PHP de Laragon y una instancia independiente de MySQL en el puerto **3307**, con datos en `var/mysql`. Las credenciales iniciales del administrador se generan al instalar y se guardan en `var/admin-credentials.txt`. Cámbialas desde **Mi cuenta**.

## Instalar en otro equipo o hosting

1. Habilita PHP 8.1 o superior con `pdo_mysql`, `mbstring`, `fileinfo` y `session`. Utiliza MySQL 8.0+.
2. Copia `.env.example` como `.env` y configura la conexión a tu servidor MySQL. La base de datos predeterminada es `floreria_magia`.
3. Ejecuta `php scripts/install.php`. Crea las tablas, importa los productos y genera el administrador. Repetirlo conserva las modificaciones existentes.
4. Configura el **directorio público del sitio en `public/`**. Los archivos de configuración, sesiones y base de datos quedan fuera del directorio público.
5. Para desarrollo: `php -S 127.0.0.1:8080 -t public public/router.php`.

El archivo `database/floreria.sql` contiene el esquema y catálogo para importar desde phpMyAdmin. Después ejecuta el instalador para crear el administrador. `database/schema.sql` contiene solo la estructura. El usuario MySQL necesita permiso para crear la base de datos durante la instalación; si ya existe, puedes retirar esa instrucción del instalador o usar una cuenta de instalación y luego una cuenta con permisos de lectura/escritura sobre esa base.

Para hosting, configura HTTPS y una contraseña del usuario MySQL. El servidor integrado de PHP y la instancia local con root sin contraseña están destinados al desarrollo en este equipo. Apache puede usar el `.htaccess` incluido.

Para las fotos del administrador, configura `upload_max_filesize=5M` y `post_max_size=6M` en PHP. El iniciador local ya incluye estos valores.

## Funciones

- Portada fiel a la referencia, videos locales, carruseles y diseño adaptable a computadora y móvil.
- Catálogo conectado a MySQL, categorías, búsqueda, orden por precio, fichas de producto y favoritos.
- Carrito persistente en el navegador y pedidos con destinatario, dirección, fecha y dedicatoria.
- Cálculo de precios y envío en PHP, transacciones e identificación de solicitudes para evitar pedidos duplicados al reintentar.
- Panel con acceso por contraseña: productos, imágenes, precios, disponibilidad, destacados, estado de pedidos, identidad de marca y tarifas por distrito.
- Contraseñas con hash, consultas preparadas, sesiones, protección CSRF y límite de intentos de acceso.

Los pedidos quedan **pendientes de confirmación**. El sistema no cobra tarjetas, envía correos ni procesa pagos automáticamente. El negocio coordina la confirmación y el pago; una pasarela puede integrarse después.

Los precios y descripciones corresponden a la copia descargada proporcionada, no a una consulta actual del sitio original. Las categorías se asignaron automáticamente y pueden editarse. Los distritos, tarifas de envío y umbral de envío gratis son **valores iniciales configurables**, por lo que deben ajustarse al negocio. El nombre de marca, correo y WhatsApp se configuran en **Mi tienda**.

## Archivos

- `public/`: frontend, páginas PHP y endpoints de la API.
- `src/bootstrap.php`: configuración, PDO, sesiones, validaciones y helpers.
- `database/`: esquema MySQL y exportación del catálogo.
- `data/products.json`: información extraída de los archivos originales.
- `scripts/import-catalog.py`: importación reproducible desde la copia descargada; requiere Python y Pillow.
- `scripts/import-reference.py`: extracción reproducible de las secciones visuales, fuentes, logotipos y videos; requiere Python, BeautifulSoup4 y Pillow. Las secciones se guardan en `src/views/` y los archivos en `public/reference/`.
- `scripts/install.php`: instalación y carga inicial.
- `scripts/export-catalog.php`: exporta esquema y catálogo, sin usuarios ni pedidos.
- `var/`: archivos locales de MySQL, sesiones, registros y acceso inicial; no se incluye en Git.

## Verificación

Con la tienda local encendida: `python tests/flow.py`. Comprueba el registro en MySQL, precios del servidor, envío, validaciones, permisos, login e idempotencia. Usa datos ficticios y elimina los pedidos de prueba de sus dos correos reservados al finalizar. Ejecutar esta prueba requiere las credenciales iniciales del administrador antes de cambiar la contraseña.

## Administrar la portada y los botones

Entra en **http://127.0.0.1:8080/admin.php#slider**.

1. **Slider principal**: abre una diapositiva, edita título y descripción y usa **Elegir o subir imagen/video**. Sin video se muestra la imagen. Puedes agregar, ocultar y ordenar diapositivas, configurar la rotación y sus segundos.
2. **Destino del botón**: selecciona categoría, producto, búsqueda, sección o enlace. Edita también el texto del botón.
3. Pulsa **Guardar y publicar** y actualiza la pestaña de la tienda.
4. **Menú y botones** administra enlaces y grupos desplegables del menú.
5. **Contenido web** ofrece 16 apartados: logotipos, beneficios, productos destacados, ocasiones, videos, pasos, temporada, catálogo, preguntas frecuentes, corporativos, pie de página y título/descripción.
6. **Productos** administra precios, imágenes, disponibilidad y categorías (puedes escribir una nueva). Los productos seleccionados en portada toman sus precios del catálogo.
7. **Mi tienda** configura contacto, WhatsApp y entregas. Las compras se registran en **Pedidos**. Buscar, carrito, favoritos, filtros y controles de video conservan su función propia.

El contenido se guarda en `site_content` de MySQL. La publicación es inmediata; las revisiones evitan sobrescribir cambios de otra ventana. El instalador crea los módulos que falten sin reemplazar los existentes. Las plantillas están en `src/views/cms/`; `data/cms-defaults.json` contiene únicamente los valores iniciales y la definición del editor. No vuelvas a ejecutar la migración visual sobre una tienda editada.

Archivos: JPG, PNG o WebP hasta 8 MB; MP4 hasta 50 MB. En hosting configura PHP con `upload_max_filesize=50M` y `post_max_size=64M`. El iniciador local ya aplica estos límites. Conserva `public/uploads/` junto con las copias de la base de datos.

Prueba del administrador de contenido: `python tests/content.py`. Verifica todos los módulos, publicación, validación, protección CSRF y conflictos de revisión; restaura el slider original al finalizar. Como la prueba de pedidos, requiere la contraseña inicial y debe ejecutarse en el entorno local de desarrollo.

## Diseño morado y acceso superior

El portal incorpora **Acceso administrador** en la franja superior, visible también en móviles, que abre `/admin.php`. Tienda y panel comparten una paleta morada; los ajustes compartidos están en `public/assets/color-theme.css`.
