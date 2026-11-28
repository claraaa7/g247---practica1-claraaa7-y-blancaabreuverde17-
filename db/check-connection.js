'use strict';
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el archivo .env');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    console.log('Conexión correcta a la base de datos:', rows[0].db);
    console.log(rows[0].version);
  } catch (err) {
    console.error('No se pudo conectar:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();