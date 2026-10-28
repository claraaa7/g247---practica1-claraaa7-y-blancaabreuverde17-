'use strict';

/*
 * Almacenamiento en memoria.
 *
 * Es el ÚNICO módulo que sabe cómo se guardan las recetas. El controlador solo
 * usa las funciones exportadas, así que se puede sustituir por una base de datos
 * (mismas funciones, otra implementación) sin tocar rutas ni controlador.
 * Todas las funciones devuelven copias para que nadie modifique el array por fuera.
 */

const recipes = [
  { id: 1, title: 'Croquetas de jamón', prepMinutes: 45, published: true, category: 'tapas' },
  { id: 2, title: 'Patatas bravas', prepMinutes: 30, published: true, category: 'tapas' },
  { id: 3, title: 'Potaje de garbanzos y espinacas', prepMinutes: 70, published: true, category: 'cuchara' },
  { id: 4, title: 'Cocido madrileño', prepMinutes: 170, published: false, category: 'cuchara' },
  { id: 5, title: 'Gazpacho andaluz', prepMinutes: 15, published: true, category: 'frios' },
  { id: 6, title: 'Ensaladilla rusa', prepMinutes: 40, published: false, category: 'frios' },
  { id: 7, title: 'Flan casero', prepMinutes: 40, published: true, category: 'postres' },
  { id: 8, title: 'Arroz con leche', prepMinutes: 45, published: true, category: 'postres' },
];

let nextId = recipes.length + 1;

function findAll() {
  return recipes.map((r) => ({ ...r }));
}

function findById(id) {
  const recipe = recipes.find((r) => r.id === id);
  return recipe ? { ...recipe } : null;
}

function create(data) {
  const recipe = { id: nextId++, ...data };
  recipes.push(recipe);
  return { ...recipe };
}

// Sustitución completa: el id se conserva, el resto de campos se reemplaza.
function replace(id, data) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  recipes[index] = { id, ...data };
  return { ...recipes[index] };
}

// Actualización parcial: solo se pisan los campos recibidos.
function update(id, patch) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  recipes[index] = { ...recipes[index], ...patch, id };
  return { ...recipes[index] };
}

function remove(id) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return false;
  recipes.splice(index, 1);
  return true;
}

module.exports = { findAll, findById, create, replace, update, remove };