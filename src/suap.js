// Campos para cadastro no SUAP (mesma ordem/rótulos da aba SUAP da planilha de controle).
import { cargaHoras } from './conflicts.js';
export const SUAPNAT = ['Minicurso','Webinário','Visita técnica','Certificação','Formatura','Colação de grau','Posse','Aula inaugural','Aula magna','Congresso','Seminário','Oficina','Encontro','Olimpíada','Feira','Exposição','Semana','Palestra','Inauguração','Musical','Gincana','Mostra cultural','Mesa-redonda','Outro'];
const NATMAP = { 'Mesa Temática': 'Mesa-redonda', 'Feira de Ciências / Exposição': 'Feira' };
export const natureza = t => SUAPNAT.includes(t) ? t : (NATMAP[t] || 'Outro');
const br = d => d.split('-').reverse().join('/');
const hm = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
export function suapRows(a, ed) {
  const sala = a.funcao ? `${a.sala} | ${a.funcao}` : a.sala;
  return [
    ['Área', a.area], ['Nome', `${ed.prefixo} ${a.titulo}`], ['Dimensões', 'Local - campus'], ['Apresentação', a.resumo],
    ['Banner', 'Banner Padrão'], ['Carga Horária', hm(cargaHoras(a))],
    ['Site', `https://www.ifspcaraguatatuba.edu.br/snct/${ed.ano}`], ['Local', 'Campus Caraguatatuba'], ['Sala', sala],
    ['Início das Inscrições', ed.inscSuapIni ? br(ed.inscSuapIni) : ''], ['Fim das Inscrições', br(a.dataIni)],
    ['Data de Início', br(a.dataIni)], ['Hora de Início', a.horaIni], ['Data de Fim', br(a.dataFim)], ['Hora de Fim', a.horaFim],
    ['Coordenador', a.coordenador], ['Campus', 'CAR'], ['Setor', 'Não preencher'],
    ['Organizadores', (a.organizadores?.length ? a.organizadores : [a.coordenador]).join('\n')],
    ['Inscrição Online', a.inscOnline ? 'Sim' : 'Não'], ['Gera Certificado?', a.certificado ? 'Sim' : 'Não'],
    ['Classificação', 'Regional'], ['Tipo', 'Científico/tecnológico'], ['Público Alvo', (a.publicos || []).join('\n')],
    ['Natureza', natureza(a.tipo)], ['Eventos Similares', 'Não preencher'], ['Recursos Envolvidos', 'Não preencher'],
    ['Tipo de Participação', a.palestrantes?.length ? 'Palestrante\nParticipante' : 'Participante'],
    ['Limite de Inscrições', `Participante: ${a.vagas}`], ['Participantes', String(a.vagas)], ['Modelo de Certificado', 'Não preencher'],
  ];
}
export function toCsv(rowsPorAtividade) {
  if (!rowsPorAtividade.length) return '\ufeff';
  const head = [...rowsPorAtividade[0].rows.map(r => r[0]), 'Link'];
  const esc = c => '"' + String(c ?? '').replace(/"/g, '""') + '"';
  const lines = [head, ...rowsPorAtividade.map(x => [...x.rows.map(r => r[1]), x.link || 'Não realizar cadastramento no SUAP. Favor Aguardar.'])];
  return '\ufeff' + lines.map(l => l.map(esc).join(';')).join('\r\n');
}
