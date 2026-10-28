// Dados iniciais: salas (da planilha de controle), listas de opções, edição e abas. Uso: npm run seed [-- --admin CG00001]
import { pool, q } from './db.js';
const SALAS = [['A105', 'Sala de Aula', 50], ['A106', 'Sala Desenho', null], ['A107', 'Sala de Aula', null], ['A108', 'Recursos Naturais', null], ['A113', 'Laboratório Física', null], ['A114', 'Laboratório Informática', 20], ['A115', 'Laboratório Informática', 20], ['A116', 'LabTech', null], ['A117', 'Laboratório Gestão', 16], ['A119', 'Sala Línguas', null], ['A120', 'Auditório', 92], ['A121', 'Laboratório Informática', 28], ['A122', 'Laboratório Matemática', 16], ['A201', 'Biblioteca', null], ['A203', 'Laboratório Informática', 35], ['A204', 'Laboratório Informática', 40], ['A205', 'Laboratório Informática', 40], ['A206', 'Sala de Aula', 50], ['A207', 'Sala de Aula', 50], ['A208', 'Sala de Aula', 50], ['A211', 'Laboratório Informática', 40], ['A212', 'Sala de Aula', 50], ['B102', 'LIEC', null], ['B202', 'Laboratório Geomática', null], ['C101', 'Sala de Aula', 40], ['C102', 'Sala de Aula', 40], ['C103', 'Sala de Aula', 40], ['C104', 'Sala de Aula', 40], ['C105', 'Sala de Aula', 40], ['C106', 'Sala de Aula', 40], ['Pátio Superior', null, null], ['Pátio Inferior', null, null], ['Quadra', null, null]];
const OPC = {
  area: ['Informática', 'Gestão', 'Construção Civil', 'Meio Ambiente', 'Licenciaturas', 'Núcleo Comum', 'Outros'],
  cnpq: ['Ciências Exatas e da Terra', 'Ciências Biológicas', 'Engenharias', 'Ciências da Saúde', 'Ciências Agrárias', 'Ciências Sociais Aplicadas', 'Ciências Humanas', 'Linguística, Letras e Artes', 'Multidisciplinar'],
  tipo: ['Palestra', 'Mesa Temática', 'Workshop / Grupo de Pesquisa', 'Oficina', 'Minicurso', 'Seminário', 'Feira de Ciências / Exposição', 'Cinedebate', 'Concurso Estudantil', 'Portas Abertas', 'SICLN', 'Apresentação Cultural', 'Visita técnica', 'Webinário', 'Gincana', 'Mostra cultural', 'Olimpíada', 'Congresso', 'Encontro', 'Outro'],
  publico: ['Público Externo', 'Aluno', 'Estudante', 'Servidor', 'MEI', 'Pai ou Responsável', 'Empresário', 'Gestor', 'Prestador de Serviço', 'Estagiário', 'Bolsista'],
  recurso: ['Computador Participante', 'Computador Apresentador', 'Som', 'Microfone', 'Projetor', 'WebCam'],
};
for (const [c, f, a] of SALAS) await q('INSERT INTO salas(codigo,funcao,assentos) VALUES($1,$2,$3) ON CONFLICT(codigo) DO NOTHING', [c, f, a]);
for (const [k, v] of Object.entries(OPC)) for (const [i, x] of v.entries()) await q('INSERT INTO opcoes(kind,valor,ordem) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [k, x, i]);
const ano = new Date().getFullYear();
const [ed] = await q(`INSERT INTO edicoes(ano,titulo,prefixo) VALUES($1,$2,$3) ON CONFLICT(ano) DO UPDATE SET ano=EXCLUDED.ano RETURNING id`, [ano, `SNCT IFSP Caraguatatuba ${ano}`, `[SNCT CAR ${ano}]`]);
const PG = [['release', 'Release do evento'], ['sobre', 'Sobre o evento'], ['regulamento', 'Regulamento da SNCT CAR'], ['tema', `Sobre o tema de ${ano}`]];
for (const [i, [s, t]] of PG.entries()) await q('INSERT INTO paginas(edicao_id,slug,titulo,conteudo,ordem) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [ed.id, s, t, '# ' + t + '\nConteúdo a ser preenchido pela comissão.', i]);
const i = process.argv.indexOf('--admin');
if (i > 0) {
  const p = process.argv[i + 1].toUpperCase();
  const [u] = await q(`INSERT INTO usuarios(prontuario,nome,vinculo) VALUES($1,'(aguardando primeiro acesso)','servidor') ON CONFLICT(prontuario) DO UPDATE SET prontuario=EXCLUDED.prontuario RETURNING id`, [p]);
  await q(`INSERT INTO papeis VALUES($1,'admin') ON CONFLICT DO NOTHING`, [u.id]);
  console.log('Administrador concedido a', p);
}
console.log('Dados iniciais carregados.'); await pool.end();
