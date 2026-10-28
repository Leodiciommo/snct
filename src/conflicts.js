// Detecção de conflito de sala (lógica pura, usada no servidor e testada).
// Atividade: { id, salaId, dataIni, dataFim, horaIni, horaFim, usoContinuo, status }
const tm = s => { const [h, m] = s.split(':'); return +h * 60 + +m; };
export function days(a) {
  const out = [];
  for (let d = new Date(a.dataIni + 'T12:00:00Z'); d <= new Date(a.dataFim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
}
// Retorna blocos [dia, minutoInicio, minutoFim]. Uso contínuo: primeiro dia a partir do início,
// dias do meio inteiros, último dia até o fim. Caso contrário: mesmo horário todos os dias.

export function blocks(a) {
  const ds = days(a), n = ds.length;
  return ds.map((d, i) => {
    let s = tm(a.horaIni), e = tm(a.horaFim);
    if (a.usoContinuo && n > 1) { if (i > 0) s = 0; if (i < n - 1) e = 1440; }
    return [d, s, e];
  });
}
export const hit = (a, b) => a.salaId === b.salaId &&
  blocks(a).some(x => blocks(b).some(y => x[0] === y[0] && x[1] < y[2] && y[1] < x[2]));

export const findConflicts = (a, others) =>
  others.filter(b => b.id !== a.id && b.status !== 'rejeitada' && hit(a, b));

export const cargaHoras = a => blocks(a).reduce((t, b) => t + (b[2] - b[1]), 0) / 60;
