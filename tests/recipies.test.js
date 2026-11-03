'use strict';

const request = require('supertest');

// El almacén está en memoria y es un módulo único: sin esto, los datos de un test
// "se filtrarían" al siguiente. Con resetModules, cada test carga una app nueva con las 8 recetas iniciales.
let app;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {}); // silencia el logger de peticiones
  jest.resetModules();
  app = require('../src/app');
});

afterEach(() => {
  jest.restoreAllMocks();
});

const validRecipe = {
  title: 'Tortilla de patatas',
  prepMinutes: 45,
  published: true,
  category: 'tapas',
};

describe('GET /recipes', () => {
  test('lista las 8 recetas iniciales con X-Total-Count', async () => {
    const res = await request(app).get('/recipes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
    expect(res.headers['x-total-count']).toBe('8');
  });

  test('combina búsqueda, filtro y orden', async () => {
    const res = await request(app).get('/recipes?search=ta&published=true&sort=prepMinutes&order=desc');
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.title)).toEqual([
      'Potaje de garbanzos y espinacas',
      'Croquetas de jamón',
      'Patatas bravas',
    ]);
  });

  test('limit y offset paginan, y X-Total-Count cuenta antes de paginar', async () => {
    const res = await request(app).get('/recipes?limit=2&offset=1&sort=title');
    expect(res.body.map((r) => r.title)).toEqual(['Cocido madrileño', 'Croquetas de jamón']);
    expect(res.headers['x-total-count']).toBe('8');
  });

  test('ignora parámetros desconocidos o mal formados', async () => {
    const res = await request(app).get('/recipes?limit=abc&foo=bar&sort=hack&published=maybe');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
  });
});

describe('GET /recipes/:id y /recipes/stats', () => {
  test('devuelve una receta existente', async () => {
    const res = await request(app).get('/recipes/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Croquetas de jamón');
  });

  test.each(['999', 'abc', '0', '-1'])('GET /recipes/%s responde 404 JSON', async (id) => {
    const res = await request(app).get(`/recipes/${id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Receta no encontrada' });
  });

  test('stats se calcula y no se confunde con un id', async () => {
    const res = await request(app).get('/recipes/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 8,
      published: 6,
      unpublished: 2,
      averagePrepMinutes: 56.9,
      byCategory: { tapas: 2, cuchara: 2, frios: 2, postres: 2 },
    });
  });
});

describe('POST /recipes', () => {
  test('crea la receta: 201, Location, id del servidor y campos extra descartados', async () => {
    const res = await request(app)
      .post('/recipes')
      .send({ ...validRecipe, id: 99, extra: 'x' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/recipes/9');
    expect(res.body).toMatchObject({ id: 9, title: 'Tortilla de patatas', description: '', ingredients: [] });
    expect(res.body.extra).toBeUndefined();

    const check = await request(app).get('/recipes/9');
    expect(check.status).toBe(200);
  });

  test('guarda description e ingredients recortados', async () => {
    const res = await request(app)
      .post('/recipes')
      .send({ ...validRecipe, description: '  Clásica  ', ingredients: ['  huevos ', 'patatas'] });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Clásica');
    expect(res.body.ingredients).toEqual(['huevos', 'patatas']);
  });

  test('devuelve todas las incidencias de validación a la vez', async () => {
    const res = await request(app)
      .post('/recipes')
      .send({ title: '', prepMinutes: 1000, published: 'si', category: 'otra', ingredients: 'huevos' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual([
      'title',
      'prepMinutes',
      'published',
      'ingredients',
      'category',
    ]);
  });

  test('un cuerpo vacío indica los campos obligatorios', async () => {
    const res = await request(app).post('/recipes').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(['title', 'prepMinutes', 'published', 'category']);
  });

  test('JSON mal formado responde 400 y no 500', async () => {
    const res = await request(app).post('/recipes').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ errors: [{ field: 'body', message: 'JSON mal formado' }] });
  });
});

describe('PUT y PATCH', () => {
  test('PUT sustituye todo: los opcionales que faltan se vacían', async () => {
    await request(app).patch('/recipes/1').send({ description: 'algo', ingredients: ['a'] });
    const res = await request(app).put('/recipes/1').send(validRecipe);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, description: '', ingredients: [] });
  });

  test('PUT incompleto responde 400', async () => {
    const res = await request(app).put('/recipes/1').send({ title: 'Solo título' });
    expect(res.status).toBe(400);
  });

  test('PATCH cambia solo los campos recibidos', async () => {
    const before = (await request(app).get('/recipes/1')).body;
    const res = await request(app).patch('/recipes/1').send({ published: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...before, published: false });
  });

  test('PATCH sin ningún campo válido responde 400', async () => {
    const res = await request(app).patch('/recipes/1').send({ foo: 1 });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('body');
  });

  test('PUT y PATCH sobre un id inexistente responden 404', async () => {
    expect((await request(app).put('/recipes/999').send(validRecipe)).status).toBe(404);
    expect((await request(app).patch('/recipes/999').send({ published: true })).status).toBe(404);
  });
});

describe('DELETE y rutas inexistentes', () => {
  test('DELETE responde 204 sin cuerpo y la segunda vez 404', async () => {
    const first = await request(app).delete('/recipes/1');
    expect(first.status).toBe(204);
    expect(first.text).toBe('');
    expect((await request(app).delete('/recipes/1')).status).toBe(404);
    expect((await request(app).get('/recipes/1')).status).toBe(404);
  });

  test('una ruta inexistente responde 404 en JSON', async () => {
    const res = await request(app).get('/nada');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ruta no encontrada: GET /nada' });
  });
});