import test from 'node:test';
import assert from 'node:assert/strict';
import { calcWindows, phaseFor } from '../src/phases.js';
const w = calcWindows('2026-10-19');
test('calendário do regulamento a partir de 19/10/2026', () => {
  assert.equal(w[1].inicio, '2026-07-21T00:00:00-03:00');
  assert.equal(w[1].fim, '2026-09-04T23:59:00-03:00');   // 45 dias antes
  assert.equal(w[2].fim, '2026-09-09T23:59:00-03:00');   // 40 dias antes
  assert.equal(w[3].fim, '2026-10-16T23:59:00-03:00');   // 3 dias antes
});
test('fase conforme a data', () => {
  assert.equal(phaseFor(new Date(), false, w), -1);
  assert.equal(phaseFor(new Date('2026-06-01T12:00:00-03:00'), true, w), 0);
  assert.equal(phaseFor(new Date('2026-08-01T12:00:00-03:00'), true, w), 1);
  assert.equal(phaseFor(new Date('2026-09-07T12:00:00-03:00'), true, w), 2);
  assert.equal(phaseFor(new Date('2026-10-01T12:00:00-03:00'), true, w), 3);
});
