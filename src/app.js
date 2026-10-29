'use strict';

const path = require('path');
const express = require('express');
const logger = require('./middleware/logger');
const recipesRouter = require('./routes/recipes');

const app = express();

app.use(logger);
app.use(express.json());

// Contenido estático (carpeta public/): la página y la API comparten origen,
// así que fetch('/recipes') funciona sin CORS.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/recipes', recipesRouter);

// 404 en JSON para cualquier ruta que no haya respondido antes.
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejador centralizado de errores: SIEMPRE el último middleware.
// Responde JSON y nunca envía trazas al cliente (se registran solo en el servidor).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ errors: [{ field: 'body', message: 'JSON mal formado' }] });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo demasiado grande' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;