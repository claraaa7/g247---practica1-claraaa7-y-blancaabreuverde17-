'use strict';
 
const API = '/recipes';
 
const CATEGORY_LABELS = {
  tapas: 'Tapas',
  cuchara: 'Platos de cuchara',
  frios: 'Platos fríos',
  postres: 'Postres',
};
 
const FIELDS = ['title', 'prepMinutes', 'category', 'description', 'ingredients', 'published'];
 
const els = {
  status: document.getElementById('status'),
  banner: document.getElementById('error-banner'),
  form: document.getElementById('recipe-form'),
  formTitle: document.getElementById('form-title'),
  submitBtn: document.getElementById('submit-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  title: document.getElementById('title'),
  prepMinutes: document.getElementById('prepMinutes'),
  category: document.getElementById('category'),
  description: document.getElementById('description'),
  ingredients: document.getElementById('ingredients'),
  published: document.getElementById('published'),
  filters: document.getElementById('filters'),
  fSearch: document.getElementById('f-search'),
  fPublished: document.getElementById('f-published'),
  fCategory: document.getElementById('f-category'),
  fSort: document.getElementById('f-sort'),
  fOrder: document.getElementById('f-order'),
  empty: document.getElementById('empty'),
  tableWrap: document.getElementById('table-wrap'),
  body: document.getElementById('recipes-body'),
};
 
let pending = 0; // peticiones en curso
let editingId = null; // id de la receta que se está editando (null = creando)
let currentRecipes = []; // última lista recibida del servidor
let searchTimer = null;
let loadSeq = 0; // número de la última consulta de listado lanzada (para descartar respuestas antiguas)
let locked = false; // true mientras se envía una acción (crear, editar, publicar, eliminar)
 
/* ---------- Comunicación con la API ---------- */
 
class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors; // lista { field, message } cuando el servidor responde 400
  }
}
 
function setBusy(delta) {
  pending += delta;
  els.status.hidden = pending === 0;
}
 
// fetch NO rechaza la promesa con un 404 o un 500: por eso se comprueba response.ok.
async function request(url, options = {}) {
  setBusy(1);
  try {
    const init = { ...options };
    if (options.body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, init);
 
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (e) {
        // la respuesta de error no era JSON; se usa el mensaje genérico
      }
      const message = payload && payload.error ? payload.error : `Error ${response.status} del servidor`;
      throw new ApiError(message, response.status, payload && payload.errors ? payload.errors : null);
    }
 
    return response.status === 204 ? null : await response.json();
  } finally {
    setBusy(-1);
  }
}
 
/* ---------- Bloqueo de acciones mientras se envían ---------- */
 
function setRowButtonsDisabled(disabled) {
  for (const btn of els.body.querySelectorAll('button')) btn.disabled = disabled;
}
 
function setLocked(value) {
  locked = value;
  els.submitBtn.disabled = value;
  els.cancelBtn.disabled = value;
  els.form.setAttribute('aria-busy', String(value));
  setRowButtonsDisabled(value);
}
 
// Ejecuta una acción de escritura evitando que se lance otra a la vez (doble clic, doble envío).
async function runLocked(action) {
  if (locked) return;
  setLocked(true);
  try {
    await action();
  } finally {
    setLocked(false);
  }
}
 
/* ---------- Mensajes de error ---------- */
 
function showError(err) {
  els.banner.textContent =
    err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  els.banner.hidden = false;
}
 
function clearError() {
  els.banner.hidden = true;
  els.banner.textContent = '';
}
 
function clearFieldErrors() {
  for (const field of [...FIELDS, 'body']) {
    document.getElementById(`${field}-error`).textContent = '';
    if (els[field]) els[field].removeAttribute('aria-invalid');
  }
}
 
function showFieldErrors(errors) {
  for (const { field, message } of errors) {
    const target = document.getElementById(`${field}-error`) || document.getElementById('body-error');
    target.textContent = target.textContent ? `${target.textContent} ${message}` : message;
    if (els[field]) els[field].setAttribute('aria-invalid', 'true');
  }
}
 
/* ---------- Validación inicial en cliente ---------- */
 
// Mismo patrón que validateLoginForm del laboratorio: devuelve { valid, errors }.
// Es solo una primera barrera para ahorrar peticiones: la validación que cuenta es la del servidor.
function validateRecipeForm(values) {
  const errors = [];
  if (values.title.length === 0) errors.push({ field: 'title', message: 'El título es obligatorio.' });
  else if (values.title.length > 100) errors.push({ field: 'title', message: 'Máximo 100 caracteres.' });
 
  if (!Number.isInteger(values.prepMinutes) || values.prepMinutes < 1 || values.prepMinutes > 600) {
    errors.push({ field: 'prepMinutes', message: 'Introduce un número entero entre 1 y 600.' });
  }
  if (!values.category) errors.push({ field: 'category', message: 'Elige una categoría.' });
 
  if (values.description.length > 500) errors.push({ field: 'description', message: 'Máximo 500 caracteres.' });
 
  if (values.ingredients.length > 30) {
    errors.push({ field: 'ingredients', message: 'Máximo 30 ingredientes.' });
  } else if (values.ingredients.some((line) => line.length > 100)) {
    errors.push({ field: 'ingredients', message: 'Cada ingrediente admite como máximo 100 caracteres.' });
  }
  return { valid: errors.length === 0, errors };
}
 
function readForm() {
  const rawMinutes = els.prepMinutes.value.trim();
  return {
    title: els.title.value.trim(),
    prepMinutes: rawMinutes === '' ? NaN : Number(rawMinutes),
    category: els.category.value,
    description: els.description.value.trim(),
    // El textarea es texto plano: una línea = un ingrediente. Se descartan las líneas vacías.
    ingredients: els.ingredients.value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
    published: els.published.checked,
  };
}
 
/* ---------- Listado ---------- */
 
// El filtrado y la ordenación los hace el servidor: aquí solo se construye la consulta.
function buildQuery() {
  const params = new URLSearchParams();
  const search = els.fSearch.value.trim();
  if (search) params.set('search', search);
  if (els.fPublished.value) params.set('published', els.fPublished.value);
  if (els.fCategory.value) params.set('category', els.fCategory.value);
  params.set('sort', els.fSort.value);
  params.set('order', els.fOrder.value);
  return params.toString();
}
 
function makeCell(label, content) {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (content instanceof Node) td.appendChild(content);
  else td.textContent = content;
  return td;
}
 
function makeButton(text, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  if (className) btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}
 
// Celda "Detalle": descripción y, si hay ingredientes, un desplegable con la lista.
// Todo se crea con textContent (nunca innerHTML), así el texto del usuario no se interpreta como HTML.
function makeDetail(recipe) {
  const box = document.createElement('div');
 
  if (recipe.description) {
    const p = document.createElement('p');
    p.className = 'recipe-description';
    p.textContent = recipe.description;
    box.appendChild(p);
  }
 
  if (recipe.ingredients.length > 0) {
    const details = document.createElement('details');
    details.className = 'recipe-ingredients';
    const summary = document.createElement('summary');
    summary.textContent = `Ingredientes (${recipe.ingredients.length})`;
    const ul = document.createElement('ul');
    for (const item of recipe.ingredients) {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    }
    details.append(summary, ul);
    box.appendChild(details);
  }
 
  if (!box.hasChildNodes()) {
    const none = document.createElement('span');
    none.className = 'muted';
    none.textContent = 'Sin detalle';
    box.appendChild(none);
  }
  return box;
}
 
// Imagen propia de cada receta del recetario inicial (clave: título en minúsculas y sin acentos).
const RECIPE_IMAGES = {
  'croquetas de jamon': 'croquetas',
  'patatas bravas': 'bravas',
  'potaje de garbanzos y espinacas': 'potaje',
  'cocido madrileno': 'cocido',
  'gazpacho andaluz': 'gazpacho',
  'ensaladilla rusa': 'ensaladilla',
  'flan casero': 'flan',
  'arroz con leche': 'arroz',
};

// Para las recetas nuevas se dibuja un plato visto desde arriba. El fondo depende de la categoría y
// la comida (posiciones, tamaños y colores) sale del título: el mismo título siempre da el mismo plato.
const CATEGORY_BG = {
  tapas: ['#f6c453', '#d9822b'],
  cuchara: ['#e0793c', '#a63d1c'],
  frios: ['#8cc16a', '#3f7a3a'],
  postres: ['#f2a0b8', '#b5446e'],
};
const FOOD_COLORS = ['#c1272d', '#e8b830', '#6aa04a', '#d9822b', '#8a4f17', '#f2c25a', '#a3365a', '#5f8f3e'];

// Convierte un texto en un número (hash FNV-1a): es la "semilla" del dibujo.
function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generador de números pseudoaleatorios con semilla (mulberry32): misma semilla, misma secuencia.
function makeRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Solo se escriben números y colores de las listas de arriba en el SVG; el texto del usuario nunca se inserta.
function generatedImage(recipe) {
  const rand = makeRandom(hashString(recipe.title));
  const [c1, c2] = CATEGORY_BG[recipe.category] || CATEGORY_BG.tapas;
  let food = '';
  const pieces = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < pieces; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * 20;
    const x = (48 + Math.cos(angle) * dist).toFixed(1);
    const y = (48 + Math.sin(angle) * dist).toFixed(1);
    const r = (4 + rand() * 5).toFixed(1);
    const color = FOOD_COLORS[Math.floor(rand() * FOOD_COLORS.length)];
    food += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    '<rect width="96" height="96" rx="18" fill="url(#g)"/>' +
    '<ellipse cx="48" cy="52" rx="38" ry="38" fill="#000" opacity=".15"/>' +
    '<circle cx="48" cy="48" r="37" fill="#fff8ec"/>' +
    '<circle cx="48" cy="48" r="29" fill="#f4e7d3"/>' +
    food +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function imageFor(recipe) {
  const key = recipe.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita los acentos
  if (RECIPE_IMAGES[key]) return `img/${RECIPE_IMAGES[key]}.svg`;
  return generatedImage(recipe);
}

 
// Celda "Título": imagen de la receta + título. La imagen es decorativa (alt vacío).
function makeTitle(recipe) {
  const box = document.createElement('div');
  box.className = 'recipe-title';
  const img = document.createElement('img');
  img.src = imageFor(recipe);
  img.alt = '';
  img.width = 64;
  img.height = 64;
  const name = document.createElement('span');
  name.textContent = recipe.title;
  box.append(img, name);
  return box;
}
 
// Categoría como etiqueta de color (la clase sale de una lista cerrada, nunca del texto del usuario).
function makeChip(category) {
  const chip = document.createElement('span');
  chip.className = `chip chip-${category}`;
  chip.textContent = CATEGORY_LABELS[category] || category;
  return chip;
}
 
function renderRecipes(recipes) {
  currentRecipes = recipes;
  els.body.replaceChildren();
 
  const isEmpty = recipes.length === 0;
  els.empty.hidden = !isEmpty;
  els.tableWrap.hidden = isEmpty;
 
  for (const recipe of recipes) {
    const tr = document.createElement('tr');
 
    const badge = document.createElement('span');
    badge.className = recipe.published ? 'badge badge-published' : 'badge';
    badge.textContent = recipe.published ? 'Publicada' : 'Borrador';
 
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      makeButton('Editar', '', () => startEdit(recipe.id)),
      makeButton(recipe.published ? 'Despublicar' : 'Publicar', '', () => togglePublished(recipe)),
      makeButton('Eliminar', 'btn-danger', () => deleteRecipe(recipe)),
    );
 
    tr.append(
      makeCell('Título', makeTitle(recipe)),
      makeCell('Categoría', makeChip(recipe.category)),
      makeCell('Detalle', makeDetail(recipe)),
      makeCell('Minutos', String(recipe.prepMinutes)),
      makeCell('Estado', badge),
      makeCell('Acciones', actions),
    );
    els.body.appendChild(tr);
  }
  setRowButtonsDisabled(locked);
}
 
// Si el usuario cambia un filtro mientras otra consulta sigue en curso, la respuesta antigua
// podría llegar DESPUÉS y pisar a la nueva. Cada consulta lleva un número y solo se pinta la última.
async function loadRecipes() {
  const seq = ++loadSeq;
  clearError();
  try {
    const recipes = await request(`${API}?${buildQuery()}`);
    if (seq !== loadSeq) return; // ya se lanzó otra consulta más reciente: se descarta esta
    renderRecipes(recipes);
  } catch (err) {
    if (seq !== loadSeq) return;
    showError(err);
  }
}
 
/* ---------- Crear / editar ---------- */
 
function resetForm() {
  editingId = null;
  els.form.reset();
  clearFieldErrors();
  els.formTitle.textContent = 'Nueva receta';
  els.submitBtn.textContent = 'Crear receta';
  els.cancelBtn.hidden = true;
}
 
function startEdit(id) {
  const recipe = currentRecipes.find((r) => r.id === id);
  if (!recipe) return;
 
  clearFieldErrors();
  clearError();
  editingId = id;
  els.title.value = recipe.title;
  els.prepMinutes.value = recipe.prepMinutes;
  els.category.value = recipe.category;
  els.description.value = recipe.description;
  els.ingredients.value = recipe.ingredients.join('\n');
  els.published.checked = recipe.published;
  els.formTitle.textContent = `Editar receta #${id}`;
  els.submitBtn.textContent = 'Guardar cambios';
  els.cancelBtn.hidden = false;
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.title.focus();
}
 
async function handleSubmit(event) {
  event.preventDefault();
  if (locked) return;
  clearFieldErrors();
  clearError();
 
  const values = readForm();
  const check = validateRecipeForm(values);
  if (!check.valid) {
    showFieldErrors(check.errors);
    return;
  }
 
  await runLocked(async () => {
    try {
      // Al editar se envía el formulario completo, por eso se usa PUT (sustitución completa).
      if (editingId === null) {
        await request(API, { method: 'POST', body: values });
      } else {
        await request(`${API}/${editingId}`, { method: 'PUT', body: values });
      }
      resetForm();
      await loadRecipes();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.errors) showFieldErrors(err.errors);
      else showError(err);
    }
  });
}
 
/* ---------- Acciones por fila ---------- */
 
async function togglePublished(recipe) {
  clearError();
  await runLocked(async () => {
    try {
      // Solo cambia un campo, por eso se usa PATCH (actualización parcial).
      await request(`${API}/${recipe.id}`, { method: 'PATCH', body: { published: !recipe.published } });
      await loadRecipes();
    } catch (err) {
      showError(err);
    }
  });
}
 
async function deleteRecipe(recipe) {
  if (!window.confirm(`¿Eliminar la receta "${recipe.title}"?`)) return;
  clearError();
  await runLocked(async () => {
    try {
      await request(`${API}/${recipe.id}`, { method: 'DELETE' });
      if (editingId === recipe.id) resetForm();
      await loadRecipes();
    } catch (err) {
      showError(err);
    }
  });
}
 
/* ---------- Eventos ---------- */
 
els.form.addEventListener('submit', handleSubmit);
els.cancelBtn.addEventListener('click', resetForm);
 
els.filters.addEventListener('submit', (event) => event.preventDefault());
els.fSearch.addEventListener('input', () => {
  clearTimeout(searchTimer); // espera a que se deje de teclear para no saturar al servidor
  searchTimer = setTimeout(loadRecipes, 300);
});
for (const select of [els.fPublished, els.fCategory, els.fSort, els.fOrder]) {
  select.addEventListener('change', loadRecipes);
}
 
loadRecipes();
 