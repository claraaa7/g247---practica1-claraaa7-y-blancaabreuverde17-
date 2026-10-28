'use strict';

const store = require('../data/store');
const { validateRecipe, CATEGORIES } = require('../validators/recipeValidator');

const SORT_FIELDS = ['id', 'title', 'prepMinutes'];

// Convierte el parámetro de ruta en un id numérico, o null si no es un entero positivo.
function parseId(raw) {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

function notFound(res) {
  return res.status(404).json({ error: 'Receta no encontrada' });
}

// Los query params pueden llegar como array u objeto (?a=1&a=2, ?a[b]=1): solo aceptamos strings.
function asString(value) {
  return typeof value === 'string' ? value : undefined;
}

function asInt(value, min) {
  const text = asString(value);
  if (text === undefined || !/^\d+$/.test(text)) return undefined;
  const n = Number(text);
  return n >= min ? n : undefined;
}

// GET /recipes — política para parámetros desconocidos o mal formados: se IGNORAN (se usa el valor por defecto).
function list(req, res) {
  const { query } = req;
  let items = store.findAll();

  const search = asString(query.search);
  if (search && search.trim()) {
    const needle = search.trim().toLowerCase();
    items = items.filter((r) => r.title.toLowerCase().includes(needle));
  }

  if (query.published === 'true' || query.published === 'false') {
    const wanted = query.published === 'true';
    items = items.filter((r) => r.published === wanted);
  }

  const category = asString(query.category);
  if (category && CATEGORIES.includes(category)) {
    items = items.filter((r) => r.category === category);
  }

  const sortField = SORT_FIELDS.includes(asString(query.sort)) ? query.sort : 'id';
  const direction = query.order === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    const x = a[sortField];
    const y = b[sortField];
    const result = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
    return (result || a.id - b.id) * direction;
  });

  // Total antes de aplicar la ventana, útil para paginar en el cliente.
  res.set('X-Total-Count', String(items.length));

  const offset = asInt(query.offset, 0) ?? 0;
  const limit = asInt(query.limit, 1);
  items = items.slice(offset, limit === undefined ? undefined : offset + limit);

  res.json(items);
}

// GET /recipes/stats — se calcula en cada petición, nunca se guarda.
function stats(req, res) {
  const items = store.findAll();
  const total = items.length;
  const published = items.filter((r) => r.published).length;
  const totalMinutes = items.reduce((sum, r) => sum + r.prepMinutes, 0);

  const byCategory = {};
  for (const category of CATEGORIES) byCategory[category] = 0;
  for (const r of items) byCategory[r.category] += 1;

  res.json({
    total,
    published,
    unpublished: total - published,
    averagePrepMinutes: total === 0 ? null : Math.round((totalMinutes / total) * 10) / 10,
    byCategory,
  });
}

function getOne(req, res) {
  const id = parseId(req.params.id);
  const recipe = id === null ? null : store.findById(id);
  if (!recipe) return notFound(res);
  return res.json(recipe);
}

function create(req, res) {
  const { errors, data } = validateRecipe(req.body, { partial: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  const created = store.create(data);
  return res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
}

function replace(req, res) {
  const id = parseId(req.params.id);
  if (id === null || !store.findById(id)) return notFound(res);

  const { errors, data } = validateRecipe(req.body, { partial: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  return res.json(store.replace(id, data));
}

function patch(req, res) {
  const id = parseId(req.params.id);
  if (id === null || !store.findById(id)) return notFound(res);

  const { errors, data } = validateRecipe(req.body, { partial: true });
  if (errors.length > 0) return res.status(400).json({ errors });

  return res.json(store.update(id, data));
}

function remove(req, res) {
  const id = parseId(req.params.id);
  if (id === null || !store.remove(id)) return notFound(res);
  return res.status(204).end();
}

module.exports = { list, stats, getOne, create, replace, patch, remove };