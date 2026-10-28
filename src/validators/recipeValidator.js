'use strict';

const { z } = require('zod');

const CATEGORIES = ['tapas', 'cuchara', 'frios', 'postres'];
const TITLE_MAX = 100;
const MINUTES_MIN = 1;
const MINUTES_MAX = 600;

// Mensaje distinto si el campo falta (undefined) o si llega con un tipo incorrecto.
const typeError = (field, expected) => ({
  error: (issue) => (issue.input === undefined ? `${field} es obligatorio` : `${field} debe ser ${expected}`),
});

// Esquema de Zod: describe la forma válida de una receta.
// Por defecto z.object() DESCARTA las claves que no declara (id, hack, ...),
// así que los campos desconocidos y el id del cliente nunca llegan al resultado.
const recipeSchema = z.object({
  title: z
    .string(typeError('title', 'un texto'))
    .trim()
    .min(1, 'title no puede estar vacío')
    .max(TITLE_MAX, `title no puede superar ${TITLE_MAX} caracteres`),

  prepMinutes: z
    .number(typeError('prepMinutes', 'un número'))
    .int('prepMinutes debe ser un número entero')
    .min(MINUTES_MIN, `prepMinutes debe estar entre ${MINUTES_MIN} y ${MINUTES_MAX}`)
    .max(MINUTES_MAX, `prepMinutes debe estar entre ${MINUTES_MIN} y ${MINUTES_MAX}`),

  published: z.boolean(typeError('published', 'true o false')),

  category: z.enum(CATEGORIES, {
    error: (issue) =>
      issue.input === undefined
        ? 'category es obligatorio'
        : `category debe ser uno de: ${CATEGORIES.join(', ')}`,
  }),
});

// Para PATCH: el mismo esquema con todos los campos opcionales.
const recipePartialSchema = recipeSchema.partial();

/**
 * Valida el cuerpo de una petición.
 *  - partial = false (POST, PUT): todos los campos son obligatorios.
 *  - partial = true  (PATCH): solo se validan los campos presentes.
 *
 * Devuelve { errors, data }:
 *  - errors: TODAS las incidencias, como { field, message } (una por campo).
 *  - data: solo los campos conocidos y ya validados/limpios (title sin espacios sobrantes).
 */
function validateRecipe(body, { partial = false } = {}) {
  const result = (partial ? recipePartialSchema : recipeSchema).safeParse(body);

  if (!result.success) {
    const seen = new Set();
    const errors = [];
    for (const issue of result.error.issues) {
      // Si el cuerpo no es un objeto, el path está vacío: se informa como "body".
      const field = issue.path.length > 0 ? String(issue.path[0]) : 'body';
      const message = field === 'body' ? 'El cuerpo debe ser un objeto JSON' : issue.message;
      // Una sola incidencia por campo (la primera), para que el cliente muestre un mensaje claro.
      if (!seen.has(field)) {
        seen.add(field);
        errors.push({ field, message });
      }
    }
    return { errors, data: {} };
  }

  if (partial && Object.keys(result.data).length === 0) {
    return {
      errors: [{ field: 'body', message: 'Debe enviar al menos un campo válido para actualizar' }],
      data: {},
    };
  }

  return { errors: [], data: result.data };
}

module.exports = { validateRecipe, CATEGORIES, TITLE_MAX, MINUTES_MIN, MINUTES_MAX };