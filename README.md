# g247---practica1-claraaa7-y-blancaabreuverde17-
# Práctica 1 — Foundations API: Blog de recetas

## Integrantes y tema

- **Integrantes:** Clara López y Blanca Abreu.
- **Tema:** blog de recetas.
- **Recurso único:** `recipes` (recetas del blog).

## Instalación y ejecución

Requiere Node.js 18 o superior.

```bash
npm install
npm start          # http://localhost:3000
```

Después de arrancar, abre `http://localhost:3000` en el navegador: el mismo servidor sirve la página y la API. Opcionalmente, `npm run dev` reinicia el servidor al guardar cambios. Se puede cambiar el puerto con `PORT=4000 npm start` (en PowerShell: `$env:PORT=4000; npm start`).

## El recurso

Cada receta tiene siete campos:

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | número entero | Lo genera el servidor (autoincremental). Si el cliente lo envía, se ignora. |
| `title` | texto | Obligatorio. Se recorta (`trim`), no puede quedar vacío y admite 100 caracteres como máximo. |
| `prepMinutes` | número | Obligatorio. Entero entre 1 y 600. |
| `published` | booleano | Obligatorio. `true` = publicada, `false` = borrador. Debe ser un booleano real, no el texto `"true"`. |
| `category` | valores cerrados | Obligatorio. Uno de: `tapas`, `cuchara`, `frios`, `postres`. |
| `description` | texto | **Opcional.** Se recorta (`trim`) y admite 500 caracteres como máximo. Si falta en POST o PUT se guarda como `""`. |
| `ingredients` | lista de textos | **Opcional.** Máximo 30 elementos; cada uno se recorta, no puede estar vacío y admite 100 caracteres como máximo. Si falta en POST o PUT se guarda como `[]`. |

Los campos desconocidos que envíe el cliente se descartan y nunca se guardan.

La validación se implementa con la librería [Zod](https://zod.dev): el esquema de `src/validators/recipeValidator.js` describe los campos de la receta. `z.object()` descarta por defecto las claves no declaradas (por eso `id` y los campos extra no se persisten), `.partial()` genera la versión para PATCH y los errores de Zod se convierten al formato `{ field, message }`.

Ejemplo:

```json
{
  "id": 1,
  "title": "Croquetas de jamón",
  "description": "La tapa reina: bechamel cremosa por dentro y rebozado crujiente por fuera.",
  "ingredients": ["50 g de mantequilla", "50 g de harina", "500 ml de leche"],
  "prepMinutes": 45,
  "published": true,
  "category": "tapas"
}
```

## Arquitectura

```
src/
  server.js                      arranca el servidor (listen)
  app.js                         configura Express (middlewares, rutas, 404, errores)
  middleware/logger.js           registra método, URL, status y duración
  routes/recipes.js              solo asocia método + ruta con una función del controlador
  controllers/recipeController.js  lógica HTTP: filtros, status codes, respuestas
  validators/recipeValidator.js  validateRecipe(body, { partial }), hecho con Zod
  data/store.js                  almacenamiento en memoria (módulo sustituible)
public/                          cliente web (HTML, CSS y JS vanilla)
AI/                              componente de IA agéntica (tester agent)
```

- Las **rutas** son ligeras: no contienen lógica.
- El **controlador** nunca toca el array de datos: solo llama a las funciones de `store.js`.
- El **almacenamiento** está detrás de un módulo con una interfaz pequeña (`findAll`, `findById`, `create`, `replace`, `update`, `remove`). Sustituir la memoria por una base de datos solo exige reescribir ese archivo.
- `app.js` exporta la aplicación sin llamar a `listen`; `server.js` es quien la arranca.

## API: endpoints

Base: `http://localhost:3000`. Todas las respuestas con cuerpo son JSON.

| Método | Ruta | Parámetros de consulta | Respuestas correctas | Respuestas de error |
|---|---|---|---|---|
| GET | `/recipes` | `search`, `published`, `category`, `sort`, `order`, `limit`, `offset` | `200` + array de recetas (cabecera `X-Total-Count`) | — (los parámetros incorrectos se ignoran) |
| POST | `/recipes` | — | `201` + receta creada + cabecera `Location` | `400` validación o JSON mal formado |
| GET | `/recipes/stats` | — | `200` + resumen | — |
| GET | `/recipes/:id` | — | `200` + receta | `404` si no existe o el id no es un entero positivo |
| PUT | `/recipes/:id` | — | `200` + receta sustituida | `404` no existe · `400` validación |
| PATCH | `/recipes/:id` | — | `200` + receta actualizada | `404` no existe · `400` validación |
| DELETE | `/recipes/:id` | — | `204` sin cuerpo | `404` si no existe |
| cualquier otra | cualquier otra | — | — | `404` `{ "error": "..." }` |

Formatos de error:

- Validación (400): `{ "errors": [ { "field": "...", "message": "..." }, ... ] }` con **todas** las incidencias a la vez.
- Resto de errores (404, 413, 500): `{ "error": "mensaje" }`. El 500 nunca incluye trazas; se registran solo en la consola del servidor.

### Consulta de la colección: `GET /recipes`

Todos los parámetros son opcionales y combinables.

| Parámetro | Valores | Efecto |
|---|---|---|
| `search` | texto | Busca de forma parcial, sin distinguir mayúsculas, en `title` (no busca en `description` ni en `ingredients`). |
| `published` | `true` \| `false` | Filtra por el campo booleano. |
| `category` | `tapas` \| `cuchara` \| `frios` \| `postres` | Filtra por categoría. |
| `sort` | `id` (por defecto) \| `title` \| `prepMinutes` | Campo de ordenación. |
| `order` | `asc` (por defecto) \| `desc` | Sentido de la ordenación. |
| `limit` | entero ≥ 1 | Máximo de resultados (por defecto, sin límite). |
| `offset` | entero ≥ 0 | Resultados que se saltan (por defecto, 0). |

La cabecera `X-Total-Count` indica el total de resultados **antes** de aplicar `limit` y `offset`.

**Política de parámetros desconocidos o mal formados: se ignoran.** El servidor nunca se detiene ni responde 400 por ellos: un parámetro desconocido (`?foo=1`) no hace nada y uno con valor inválido (`?limit=abc`, `?sort=hack`, `?published=maybe`, `?category=nope`) se trata como si no estuviera y se aplica el valor por defecto. Esto incluye parámetros repetidos o con forma de objeto (`?limit=1&limit=2`, `?search[a]=1`).

### `GET /recipes/stats`

Se calcula en cada petición a partir de los datos actuales; no se guarda en ningún sitio. La ruta está declarada **antes** de `/:id` para que Express no interprete `stats` como un id.

### Ejemplos de petición y respuesta

```bash
# Listar publicadas que contengan "ta", ordenadas por minutos de mayor a menor
curl -i "http://localhost:3000/recipes?search=ta&published=true&sort=prepMinutes&order=desc"
# 200 + X-Total-Count: 3
# → [ {"id":3,"title":"Potaje de garbanzos y espinacas","prepMinutes":70,...}, {"id":1,"title":"Croquetas de jamón",...}, {"id":2,"title":"Patatas bravas",...} ]

# Crear (el id y los campos extra se ignoran)
curl -i -X POST http://localhost:3000/recipes -H "Content-Type: application/json" \
  -d '{"id":99,"title":"Tortilla de patatas","description":"Clasica","ingredients":["huevos","patatas"],"prepMinutes":45,"published":true,"category":"tapas","extra":"x"}'
# 201 Created
# Location: /recipes/9
# {"id":9,"description":"Clasica","ingredients":["huevos","patatas"],"title":"Tortilla de patatas","prepMinutes":45,"published":true,"category":"tapas"}

# Crear con datos inválidos
curl -i -X POST http://localhost:3000/recipes -H "Content-Type: application/json" \
  -d '{"title":"","prepMinutes":1000,"published":"si","category":"otra","ingredients":"huevos"}'
# 400 Bad Request
# {"errors":[
#   {"field":"title","message":"title no puede estar vacío"},
#   {"field":"prepMinutes","message":"prepMinutes debe estar entre 1 y 600"},
#   {"field":"published","message":"published debe ser true o false"},
#   {"field":"ingredients","message":"ingredients debe ser una lista de textos"},
#   {"field":"category","message":"category debe ser uno de: tapas, cuchara, frios, postres"}]}

# Sustituir (PUT: los cuatro campos obligatorios; description e ingredients se vacían si no se envían)
curl -i -X PUT http://localhost:3000/recipes/9 -H "Content-Type: application/json" \
  -d '{"title":"Tortilla española","prepMinutes":50,"published":false,"category":"tapas"}'
# 200 → {"id":9,"description":"","ingredients":[],"title":"Tortilla española","prepMinutes":50,"published":false,"category":"tapas"}

# Actualizar un campo (PATCH)
curl -i -X PATCH http://localhost:3000/recipes/9 -H "Content-Type: application/json" -d '{"published":true,"description":"Con cebolla"}'
# 200 → {"id":9,"description":"Con cebolla","ingredients":[],"title":"Tortilla española","prepMinutes":50,"published":true,"category":"tapas"}

# Estadísticas
curl -i http://localhost:3000/recipes/stats
# 200 → {"total":8,"published":6,"unpublished":2,"averagePrepMinutes":56.9,
#        "byCategory":{"tapas":2,"cuchara":2,"frios":2,"postres":2}}

# Eliminar
curl -i -X DELETE http://localhost:3000/recipes/9
# 204 No Content (sin cuerpo)

# No encontrado
curl -i http://localhost:3000/recipes/999
# 404 → {"error":"Receta no encontrada"}
```

Los ejemplos están escritos para bash/macOS/Linux. En PowerShell hay que usar `curl.exe` y pasar el cuerpo por la entrada estándar: `'{"published":true}' | curl.exe -i -X PATCH http://localhost:3000/recipes/9 -H "Content-Type: application/json" -d "@-"`.

El PATCH sin ningún campo válido (por ejemplo `{}` o solo campos desconocidos) responde `400` con `{"field":"body","message":"Debe enviar al menos un campo válido para actualizar"}`.

## Contenido estático

La carpeta `public/` se sirve con `express.static` en `src/app.js`, **antes** de montar el router de la API y después de `express.json()` y del logger. Se hace así para que la página y la API compartan origen (`http://localhost:3000`): el cliente llama a `fetch('/recipes')` con una ruta relativa y no hace falta configurar CORS.

## ¿Por qué el filtrado se hace en el servidor?

- **Menos datos por la red:** el navegador recibe solo las recetas que coinciden, no toda la colección.
- **Escala:** con miles de recetas, descargarlas todas para filtrarlas en el cliente sería lento y costoso.
- **Una sola fuente de verdad:** las reglas de búsqueda, filtrado y ordenación viven en un único sitio y funcionan igual para el navegador, `curl` o cualquier otro cliente.
- **Permite paginar** (`limit`/`offset`), algo que no se puede hacer bien si el cliente solo tiene una parte de los datos.

El cliente únicamente construye la consulta (`URLSearchParams`) a partir de los controles de la página.

## PUT vs PATCH

- **PUT** sustituye la receta **completa**: exige los cuatro campos obligatorios (`title`, `prepMinutes`, `published`, `category`) con validación completa. Si falta alguno, responde 400. Los opcionales (`description`, `ingredients`) que no se envíen se **vacían** (`""` y `[]`), porque lo que se envía sustituye a lo anterior. Es idempotente: repetir la misma petición deja el mismo resultado.
- **PATCH** actualiza **solo los campos recibidos**: el resto se conserva y la validación es parcial (solo se validan los campos presentes).

En el cliente:
- **Editar** (botón «Editar» + formulario) usa **PUT**, porque el formulario siempre envía todos los campos.
- **Publicar / Despublicar** (botón de cada fila) usa **PATCH**, porque solo cambia el campo `published`.

## Cliente web

Una única página (`public/index.html`) con HTML semántico, CSS propio y JavaScript vanilla (sin frameworks):

- Listado y formulario de creación; botones de editar, publicar/despublicar y eliminar en cada fila.
- La descripción y los ingredientes se escriben en dos `textarea` (los ingredientes, **uno por línea**: el JS los convierte en la lista que espera la API) y se muestran en la columna «Detalle» con un desplegable.
- La interfaz se actualiza sin recargar la página.
- Indicador «Cargando…» mientras haya peticiones en curso.
- Mensaje de error legible (conexión o error del servidor) y estado explícito de lista vacía.
- Buscador, filtros (estado y categoría) y ordenación que se envían como consulta a la API.
- Validación inicial en el cliente y errores del `400` mostrados junto a cada campo.
- Se comprueba `response.ok` porque `fetch` no rechaza la promesa con un 404 o 500.
- El HTML y el CSS parten de los archivos del curso (`index.html` y `styles.css`): navegación con Flexbox, maquetación con Grid (contenido principal + barra lateral «Antes de cocinar»), foco visible y un breakpoint responsive a 700 px, en el que la barra lateral pasa debajo y la tabla se convierte en tarjetas apiladas.

## Componente de IA agéntica

Ver la carpeta [`AI/`](AI/): `agents.md` (configuración del tester agent, contrato y comprobaciones) y `review-log.md` (revisión crítica de lo que devolvió el agente).