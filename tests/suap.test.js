import test from 'node:test';
import assert from 'node:assert/strict';
import { suapRows, natureza, toCsv } from '../src/suap.js';
const a = { area: 'Informática', titulo: 'Oficina de Jogos', resumo: 'Resumo', dataIni: '2026-10-21', dataFim: '2026-10-21', horaIni: '14:00', horaFim: '17:00',
  salaId: 1, sala: 'A204', funcao: 'Laboratório Informática', coordenador: 'Fulano de Tal', organizadores: [], palestrantes: [], publicos: ['Aluno', 'Servidor'],
  tipo: 'Concurso Estudantil', vagas: 40, inscOnline: false, certificado: true };
const ed = { prefixo: '[SNCT CAR 2026]', ano: 2026, inscSuapIni: '2026-10-06' };
test('31 campos do SUAP, com prefixo e organizador padrão', () => {
  const r = suapRows(a, ed);
  assert.equal(r.length, 31);
  assert.equal(r.find(x => x[0] === 'Nome')[1], '[SNCT CAR 2026] Oficina de Jogos');
  assert.equal(r.find(x => x[0] === 'Carga Horária')[1], '3:00');
  assert.equal(r.find(x => x[0] === 'Organizadores')[1], 'Fulano de Tal');
  assert.equal(r.find(x => x[0] === 'Sala')[1], 'A204 | Laboratório Informática');
});
test('natureza fora da lista do SUAP vira Outro; mapeamentos conhecidos', () => {
  assert.equal(natureza('Concurso Estudantil'), 'Outro');
  assert.equal(natureza('Mesa Temática'), 'Mesa-redonda');
  assert.equal(natureza('Palestra'), 'Palestra');
});
test('CSV usa ; e aviso quando não há link', () => {
  const c = toCsv([{ rows: suapRows(a, ed), link: null }]);
  assert.ok(c.startsWith('\ufeff"Área";"Nome"'));
  assert.ok(c.includes('Favor Aguardar'));
});
