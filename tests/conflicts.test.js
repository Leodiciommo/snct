import test from 'node:test';
import assert from 'node:assert/strict';
import { hit, findConflicts, cargaHoras } from '../src/conflicts.js';
const A = (o = {}) => ({ id: 1, salaId: 1, dataIni: '2026-10-21', dataFim: '2026-10-21', horaIni: '14:30', horaFim: '19:00', usoContinuo: false, status: 'aprovada', ...o });
test('mesma sala, horários sobrepostos: conflito', () => assert.ok(hit(A(), A({ id: 2, horaIni: '16:30', horaFim: '18:00' }))));
test('horários adjacentes (10:00-10:30 e 10:30-11:00) não conflitam', () =>
  assert.ok(!hit(A({ horaIni: '10:00', horaFim: '10:30' }), A({ id: 2, horaIni: '10:30', horaFim: '11:00' }))));
test('salas diferentes não conflitam', () => assert.ok(!hit(A(), A({ id: 2, salaId: 2 }))));
test('dias diferentes não conflitam', () => assert.ok(!hit(A(), A({ id: 2, dataIni: '2026-10-22', dataFim: '2026-10-22' }))));
test('vários dias, horário diário restrito: só conflita no horário', () => {
  const m = A({ dataIni: '2026-10-19', dataFim: '2026-10-21', horaIni: '16:30', horaFim: '18:30' });
  assert.ok(hit(m, A({ id: 2, dataIni: '2026-10-20', dataFim: '2026-10-20', horaIni: '17:00', horaFim: '18:00' })));
  assert.ok(!hit(m, A({ id: 2, dataIni: '2026-10-20', dataFim: '2026-10-20', horaIni: '19:00', horaFim: '20:00' })));
});
test('vários dias, uso contínuo: bloqueia a sala entre início e fim', () => {
  const m = A({ dataIni: '2026-10-19', dataFim: '2026-10-21', horaIni: '09:00', horaFim: '17:00', usoContinuo: true });
  assert.ok(hit(m, A({ id: 2, dataIni: '2026-10-20', dataFim: '2026-10-20', horaIni: '03:00', horaFim: '04:00' })));
  assert.ok(hit(m, A({ id: 2, dataIni: '2026-10-19', dataFim: '2026-10-19', horaIni: '23:00', horaFim: '23:30' })));
  assert.ok(!hit(m, A({ id: 2, dataIni: '2026-10-21', dataFim: '2026-10-21', horaIni: '18:00', horaFim: '19:00' })));
});
test('atividades rejeitadas e a própria atividade são ignoradas', () => {
  const a = A();
  assert.equal(findConflicts(a, [A({ id: 2, status: 'rejeitada' }), a]).length, 0);
  assert.equal(findConflicts(a, [A({ id: 3, status: 'barrada' })]).length, 1); // barrada ainda ocupa a sala
});
test('carga horária', () => {
  assert.equal(cargaHoras(A({ horaIni: '14:00', horaFim: '17:30' })), 3.5);
  assert.equal(cargaHoras(A({ dataIni: '2026-10-19', dataFim: '2026-10-20', horaIni: '16:30', horaFim: '18:30' })), 4);
});
