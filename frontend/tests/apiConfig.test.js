import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from '../src/services/apiConfig.js';

test('La publicación usa el dominio de la web sin depender del computador del desarrollador', () => {
  assert.equal(resolveApiUrl({ production: true, origin: 'https://tienda.example' }), 'https://tienda.example');
  assert.equal(resolveApiUrl({ configuredUrl: ' ', production: true, origin: 'https://tienda.example' }), 'https://tienda.example');
});

test('Una API independiente sigue siendo configurable y el desarrollo conserva su puerto', () => {
  assert.equal(resolveApiUrl({ configuredUrl: ' https://api.example/// ', production: true, origin: 'https://tienda.example' }), 'https://api.example');
  assert.equal(resolveApiUrl(), 'http://localhost:6001');
});
