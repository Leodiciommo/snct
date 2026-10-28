import test from 'node:test';
import assert from 'node:assert/strict';
import { joomlaHtml, rotuloDia } from '../src/joomla.js';
const A = (o = {}) => ({ titulo: 'Palestra <b>X</b>', resumo: 'Linha 1\n\nLinha 2', dataIni: '2026-10-19', dataFim: '2026-10-19', horaIni: '19:00', horaFim: '20:50', coordenador: 'Fulano de Tal', sala: 'A120', funcao: 'Auditório', vagas: 92, linkSuap: 'https://suap.ifsp.edu.br/eventos/evento/19125/', ...o });
test('rótulo do dia como na planilha', () => assert.equal(rotuloDia('2026-10-19'), 'Segunda: 19/10'));
test('uma aba por dia, ordem por horário, botões e separador', () => {
  const h = joomlaHtml([A({ dataIni: '2026-10-20', dataFim: '2026-10-20' }), A(), A({ titulo: 'Cedo', horaIni: '08:00', linkSuap: null })], { ano: 2026 });
  assert.equal(h.match(/\{tab /g).length, 2);
  assert.ok(h.indexOf('{tab Segunda: 19/10}') < h.indexOf('{tab Terça: 20/10}'));
  assert.ok(h.indexOf('Cedo') < h.indexOf('Palestra'));
  assert.equal(h.match(/Inscreva-se/g).length, 2);          // a atividade sem link não tem botões
  assert.equal(h.match(/<hr \/>/g).length, 3);
  assert.ok(h.includes('Local: A120 | Auditório - Vagas: 92'));
});
test('escapa HTML e converte parágrafos', () => {
  const h = joomlaHtml([A()], { ano: 2026 });
  assert.ok(h.includes('Palestra &lt;b&gt;X&lt;/b&gt;'));
  assert.ok(h.includes('Linha 1</p><p style="text-align: justify;">Linha 2'));
  assert.ok(h.includes('Olha%20o%20que%20tem%20na%20SNCT%202026%21%0D%0A%0D%0A'));
});
