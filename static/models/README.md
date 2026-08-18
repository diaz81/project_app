# Modelo 3D del vehículo

Coloca aquí el archivo del modelo con el nombre exacto:

```
static/models/car.glb
```

La aplicación (`static/js/vehicle.js`) intenta cargar `/static/models/car.glb`
con `GLTFLoader` en cuanto arrancan las vistas Inspector y Cliente. Si el
archivo no existe o falla al cargar, la app usa automáticamente un vehículo
procedural simple como respaldo (no se rompe nada, solo se ve menos realista).

## Requisitos del modelo

- Formato **GLB** (binario, todo-en-uno) o **GLTF** con sus recursos.
- Cualquier escala/orientación sirve: la app centra el modelo, lo escala
  automáticamente y ajusta la cámara para que quede completo en pantalla.
- Preferible que sea **Y-up** (estándar en glTF) y quede orientado con el
  frente del vehículo hacia +X; si no es así, la sugerencia automática de
  "ubicación" (frente/atrás/lateral) puede quedar invertida, pero el campo
  sigue siendo editable a mano sin problema.
- Nombres de malla descriptivos (ej. `door_left`, `hood`, `roof`) mejoran la
  sugerencia automática de ubicación al hacer clic; si no los tiene, se usa
  una etiqueta genérica ("Carrocería del vehículo").

## Dónde conseguir uno

Modelos GLB de autos gratuitos y con licencia libre (CC0 / dominio público):

- Modelos de ejemplo de Three.js: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf
- Sketchfab, filtrando por licencia "CC0" o "CC Attribution": https://sketchfab.com/search?features=downloadable&q=car&type=models
- Kenney (assets low-poly gratuitos): https://kenney.nl/assets/car-kit

## Nota sobre puntos ya guardados

Las coordenadas XYZ de los puntos de inspección se guardan relativas a la
geometría del modelo que estaba activo al crearlos. Si cambias de modelo
(por ejemplo, de procedural a un `car.glb` real), los puntos ya guardados
pueden no coincidir exactamente con la superficie del nuevo modelo.
