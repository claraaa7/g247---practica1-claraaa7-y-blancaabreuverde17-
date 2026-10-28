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
  {
    id: 1,
    title: 'Croquetas de jamón',
    description: 'La tapa reina: bechamel cremosa por dentro y rebozado crujiente por fuera.',
    ingredients: [
      '50 g de mantequilla',
      '50 g de harina',
      '500 ml de leche',
      '150 g de jamón serrano picado',
      '1 huevo y pan rallado, para el rebozado',
      'Sal, pimienta y nuez moscada',
    ],
    prepMinutes: 45,
    published: true,
    category: 'tapas',
  },
  {
    id: 2,
    title: 'Patatas bravas',
    description: 'Patatas fritas en dados con una salsa brava por encima.',
    ingredients: [
      '4 patatas medianas',
      'Aceite para freír',
      '1 lata de tomate triturado',
      '1 diente de ajo',
      '1 cucharadita de pimentón picante',
      'Sal y una pizca de azúcar',
    ],
    prepMinutes: 30,
    published: true,
    category: 'tapas',
  },
  {
    id: 3,
    title: 'Potaje de garbanzos y espinacas',
    description: 'Un plato de cuchara ligero y completo, listo en poco más de una hora si partes de garbanzos ya cocidos.',
    ingredients: [
      '400 g de garbanzos cocidos',
      '200 g de espinacas frescas',
      '1 patata',
      '1 cebolla',
      '2 dientes de ajo',
      '1 cucharadita de pimentón',
      'Aceite de oliva y sal',
      '1 huevo cocido, para decorar (opcional)',
    ],
    prepMinutes: 70,
    published: true,
    category: 'cuchara',
  },
  {
    id: 4,
    title: 'Cocido madrileño',
    description: 'El plato de cuchara más completo de la cocina española: se sirve en tres tiempos (sopa, garbanzos con verdura y carne).',
    ingredients: [
      '300 g de garbanzos, en remojo desde la noche anterior',
      'Morcillo de ternera, tocino, chorizo y morcilla para cocer',
      '1 repollo',
      '2 patatas',
      '2 zanahorias',
      '1 puerro',
      'Fideos finos, para la sopa',
    ],
    prepMinutes: 170,
    published: false,
    category: 'cuchara',
  },
  {
    id: 5,
    title: 'Gazpacho andaluz',
    description: 'Una crema fría de verduras muy refrescante, lista en 15 minutos más el reposo en la nevera.',
    ingredients: [
      '1 kg de tomates maduros',
      '1 pimiento verde',
      '1 pepino',
      '1 diente de ajo',
      '50 ml de aceite de oliva',
      'Vinagre de vino y sal',
      'Pan duro, opcional, para espesar',
    ],
    prepMinutes: 15,
    published: true,
    category: 'frios',
  },
  {
    id: 6,
    title: 'Ensaladilla rusa',
    description: 'Un clásico de las tapas frías, con patata, atún y mayonesa.',
    ingredients: [
      '3 patatas',
      '2 zanahorias',
      '1 lata de atún',
      '100 g de guisantes',
      '2 huevos cocidos',
      'Aceitunas y mayonesa, al gusto',
    ],
    prepMinutes: 40,
    published: false,
    category: 'frios',
  },
  {
    id: 7,
    title: 'Flan casero',
    description: 'Un postre clásico, con solo cuatro ingredientes.',
    ingredients: [
      '4 huevos',
      '500 ml de leche',
      '100 g de azúcar',
      '1 cucharadita de esencia de vainilla',
      'Caramelo líquido, para el molde',
    ],
    prepMinutes: 40,
    published: true,
    category: 'postres',
  },
  {
    id: 8,
    title: 'Arroz con leche',
    description: 'Un postre de cuchara muy cremoso, con un toque de canela.',
    ingredients: [
      '200 g de arroz redondo',
      '1 litro de leche',
      '100 g de azúcar',
      '1 rama de canela',
      'Piel de 1 limón',
      'Canela molida, para decorar',
    ],
    prepMinutes: 45,
    published: true,
    category: 'postres',
  },
];

let nextId = recipes.length + 1;

// Copia una receta, incluida la lista de ingredientes (un spread solo copia el primer nivel).
function copy(recipe) {
  return { ...recipe, ingredients: [...recipe.ingredients] };
}

function findAll() {
  return recipes.map(copy);
}

function findById(id) {
  const recipe = recipes.find((r) => r.id === id);
  return recipe ? copy(recipe) : null;
}

function create(data) {
  const recipe = { id: nextId++, ...data };
  recipes.push(recipe);
  return copy(recipe);
}

// Sustitución completa: el id se conserva, el resto de campos se reemplaza.
function replace(id, data) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  recipes[index] = { id, ...data };
  return copy(recipes[index]);
}

// Actualización parcial: solo se pisan los campos recibidos.
function update(id, patch) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  recipes[index] = { ...recipes[index], ...patch, id };
  return copy(recipes[index]);
}

function remove(id) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return false;
  recipes.splice(index, 1);
  return true;
}

module.exports = { findAll, findById, create, replace, update, remove };