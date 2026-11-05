# Informe de coordenadas — Cobija Salud

**Fecha de auditoría:** 2026-11-05  
**Área de control de coordenadas:** latitud -11.15 a -10.90; longitud -68.90 a -68.65 (WGS84).  
**Advertencia:** este rango es solo una validación de plausibilidad para Cobija; estar dentro no verifica un establecimiento.

## Resumen

| Métrica | Resultado |
|---|---:|
| Establecimientos registrados | 34 |
| Coordenadas presentes en el JSON | 2 |
| Ubicaciones verificadas contra un objeto OSM identificado | 2 |
| Ubicaciones pendientes de verificación | 32 |
| Sin dirección ni coordenadas | 0 |
| Coordenadas duplicadas exactas detectadas | 0 |
| Coordenadas fuera del área de control | 0 |
| Coordenadas corregidas durante esta auditoría | 0 |

No se agregaron puntos nuevos: no se pudo contrastar con suficiente confianza la ubicación individual de los otros 32 registros. Los dos puntos existentes coinciden con geometrías de edificios identificadas en OpenStreetMap y se conservaron. En ambos casos, el marcador es el centro de la geometría del edificio, no una entrada verificada.

La búsqueda manual en Nominatim para el nombre y dirección completos del Hospital Dr. Hernán Messuti Rivera no devolvió candidatos en la prueba del módulo; no se asignó ningún punto a partir de esa consulta. Esto no invalida el objeto OSM existente ni se usó como sustituto de la verificación geográfica.

## Puntos contrastados

| Establecimiento | Coordenadas WGS84 (lat, lon) | Fuente | Precisión declarada |
|---|---|---|---|
| Clínica Burgos | `-11.028633, -68.7609617` | [OpenStreetMap way 371800446](https://www.openstreetmap.org/way/371800446); geometría y nombre `Clinica Burgos` consultados en la API OSM el 2026-11-05. Nominatim identifica el lugar sobre Avenida 9 de Febrero, barrio Conavi. | Centro de la geometría del edificio OSM; no identifica la entrada. |
| Hospital Dr. Hernán Messuti Rivera | `-11.0244666, -68.7578774` | [OpenStreetMap way 894293361](https://www.openstreetmap.org/way/894293361); geometría, nombre `Hospital 3er Nivel Hernán Messuti Rivera` y Avenida 9 de Febrero consultados en la API OSM el 2026-11-05. | Centro de la geometría del edificio OSM; no identifica la entrada. |

## Registros que requieren confirmación del punto

- CIES Cobija
- Clínica UNEDI
- Clínica Integramédica
- Clínica Materno Infantil CLIMAIN
- Clínica Materno Infantil Divino Niño
- Clínica Integral de la Mujer
- Medicentro Cobija
- Ultrasonido Móvil
- Laboratorio Clínico Central Médica
- Laboratorio Clínico Frontera S.R.L.
- Farmacia Alimar y Laboratorio Medicus
- CEMO
- Laboratorio Pasteur
- Johann Laboratorio–Farmacia–C. E. Médicos
- Laboratorio de Referencia Departamental SEDES Pando
- Farmacia Carolina
- Clinic Pharma
- Clinic Pharma, sucursal 1
- Farmavida BK
- Farmacia Manantial
- Mi Familia JYM
- Nine Farma
- Pharma Acre
- Punto Farma
- RML Asunción Central
- Salud y Vida
- Señora de Guadalupe
- María Auxiliadora
- Paolita Terrazas
- Farmacia Santa Rosa
- Farma Verde
- Terranorte Pharma

## Validaciones e implementación

- Las coordenadas deben ser números finitos dentro del área de control y no pueden ser el centro de Cobija usado como sustituto.
- Una coordenada solo se marca verificada si tiene fuente, fecha, precisión y confirmación explícita. Los resultados de Nominatim no se aceptan como verificación por sí solos.
- Se excluyen del mapa puntos incompletos, fuera del rango, duplicados o sin metadatos de verificación.
- Los candidatos Nominatim se buscan individualmente, se almacenan en caché local y se limitan a una solicitud por segundo por instancia.
- Las correcciones del administrador se guardan en el navegador; deben exportarse y revisarse antes de reemplazar el JSON fuente.
- OpenStreetMap y Nominatim conservan su atribución. No se hicieron consultas masivas ni se generaron coordenadas estimadas para los registros pendientes.
