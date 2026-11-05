import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRegistrationDate } from '../src/services/profile.js';

test('La antigüedad procede de la fecha guardada y se muestra en horario de Colombia',()=>{
 assert.equal(formatRegistrationDate('2021-07-15T16:00:00Z'),'julio de 2021');
 assert.equal(formatRegistrationDate('2026-11-01T01:00:00Z'),'octubre de 2026');
});

test('Una fecha ausente o inválida no se sustituye por una antigüedad ficticia',()=>{
 for(const value of [null,undefined,'','fecha incorrecta'])assert.equal(formatRegistrationDate(value),null);
});
