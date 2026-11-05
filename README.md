# Cobija Salud

Prototipo web del directorio de servicios de salud de Cobija. La primera versión incluye búsqueda, filtros combinables, tarjetas, ficha de detalle y mapa Leaflet/OpenStreetMap.

## Ejecutar localmente

Desde esta carpeta inicia un servidor estático, por ejemplo:

```powershell
python -m http.server 8000
```

Abre `http://localhost:8000`. Se necesita conexión a internet para cargar Leaflet, el plugin de agrupación de marcadores y los mosaicos de OpenStreetMap.

## Publicar en GitHub Pages

El flujo de GitHub Actions de `.github/workflows/pages.yml` publica el sitio automáticamente al subirlo a la rama `main`. Para publicarlo en `https://isacflores.github.io/cobija-saludGPS/`:

1. Crea un repositorio público llamado `cobija-saludGPS` en la cuenta `isacflores`.
2. Sube el contenido completo de esta carpeta a la raíz del repositorio, incluyendo `.github/workflows/pages.yml` y `.nojekyll`.
3. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente si aún no quedó configurada automáticamente.
4. Espera que termine correctamente la acción **Deploy Cobija Salud to GitHub Pages**. Después abre el enlace indicado arriba.

El enlace queda reservado por el nombre del usuario y repositorio, pero solo estará disponible después de crear el repositorio y completar la primera publicación.

## Datos y ubicaciones

Los registros están en `data/establecimientos.json`. Los puntos del mapa solo se agregan cuando hay coordenadas válidas y metadatos de verificación. Los demás registros continúan en la lista como “Pendiente de verificación”; no se geocodifican aproximando una dirección.

Los dos puntos que se muestran en este prototipo se contrastaron con OpenStreetMap:

- Clínica Burgos: https://www.openstreetmap.org/way/371800446
- Hospital Dr. Hernán Messuti Rivera: https://www.openstreetmap.org/way/894293361

El punto representa el centro de la geometría del edificio OSM, no necesariamente la entrada. La atribución de OpenStreetMap aparece en el mapa. Los datos de contacto y horarios no publicados se muestran como “Por confirmar”.

## Revisión de ubicaciones

Abre “Revisar y corregir ubicaciones” para consultar el resumen, buscar candidatos individualmente en Nominatim, revisar el objeto OSM, introducir coordenadas o elegir un punto del mapa. Las respuestas automáticas y puntos elegidos manualmente quedan como pendientes hasta indicar fuente, fecha, precisión y confirmar expresamente su verificación. Se rechazan coordenadas no numéricas, fuera del área de control, el centro de Cobija como sustituto y ubicaciones duplicadas.

Las correcciones se conservan en `localStorage` del navegador. “Exportar JSON actualizado” descarga un archivo para revisión; la aplicación web estática no puede editar el JSON del servidor directamente. Nominatim se consulta solo bajo petición, se limita a una solicitud por segundo por instancia y guarda resultados en caché local.

Los marcadores se agrupan cuando hay puntos cercanos; si el plugin de agrupación no está disponible, se muestran como marcadores Leaflet normales. El informe de auditoría está en `INFORME-COORDENADAS.md`.

## Estructura

- `index.html`, `styles.css`: interfaz adaptable y presentación.
- `js/model.js`: clases `Establecimiento`, `Farmacia` y `DirectorioSalud`.
- `js/view.js`: render de resultados, ficha y mapa.
- `js/controller.js`: carga JSON, eventos y sincronización entre modelo y vista.
- `js/geocoding.js`: consultas individuales a Nominatim y caché local.
- `data/establecimientos.json`: directorio inicial.

Al seleccionar una ficha, el mapa se desplaza al marcador, abre su información y lo resalta. Para registros sin coordenadas verificadas, informa que la ubicación exacta está pendiente y evita mostrar un punto aproximado.

No se incluyeron modelos 3D ni dependencias de renderizado 3D en los archivos disponibles, por lo que no se aplicaron conversiones u optimizaciones de modelos.
