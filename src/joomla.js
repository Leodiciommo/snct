// HTML para colar no site institucional (Joomla), no mesmo formato da aba "Site" da planilha:
// uma aba {tab Segunda: 19/10} por dia, título, horário/responsável/local/vagas, descrição e botões Inscreva-se / Compartilhe.
const SEM = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const br = d => d.split('-').reverse().join('/');

export const rotuloDia = d => `${SEM[new Date(d + 'T12:00:00Z').getUTCDay()]}: ${br(d).slice(0, 5)}`;

export function joomlaHtml(acts, ed) {
  const L = [...acts].sort((a, b) => (a.dataIni + a.horaIni).localeCompare(b.dataIni + b.horaIni));
  let prev = '', out = '';

  for (const a of L) {
    if (a.dataIni !== prev) { out += `{tab ${rotuloDia(a.dataIni)}}`; prev = a.dataIni; }
    const local = a.funcao ? `${a.sala} | ${a.funcao}` : a.sala;
    const per = a.dataFim !== a.dataIni ? `De ${br(a.dataIni)} a ${br(a.dataFim)}, das` : 'Das';
    const desc = esc(a.resumo).split(/\n{2,}/).map(p => p.replace(/\n/g, '<br />')).join('</p><p style="text-align: justify;">');
    out += `<p style="text-align: left;"><strong><span style="font-size: 12pt;">${esc(a.titulo)}</span></strong></p><p>${per} ${a.horaIni} às ${a.horaFim} - Responsável: ${esc(a.coordenador)} - Local: ${esc(local)} - Vagas: ${a.vagas}</p><p style="text-align: justify;">${desc}</p>`;

    if (a.linkSuap) {
      const wa = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(`Olha o que tem na SNCT ${ed.ano}!\r\n\r\n`).replace(/!/g, '%21') + encodeURIComponent(a.linkSuap);
      out += `<p><span style="background-color: #455a64; padding: 4px;"><a href="${esc(a.linkSuap)}" target="_blank" rel="noopener noreferrer" style="color: #fff;">Inscreva-se</a></span> | <span style="background-color: #25d366; padding: 4px;"><a href="${wa}" target="_blank" rel="noopener noreferrer" style="color: #fff;">Compartilhe</a></span></p>`;
    }
    out += '<hr />';
  }

  return out;
}
