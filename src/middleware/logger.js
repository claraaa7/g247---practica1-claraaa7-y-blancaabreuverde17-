'use strict';

// Registra método, URL, status y duración cuando la respuesta termina.
function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}

module.exports = logger;