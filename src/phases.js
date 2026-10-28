// Cronograma do regulamento (Portaria nº 116/2026, Art. 15) a partir da data de início da SNCT.
const OFF = process.env.TZ_OFFSET || '-03:00';
const shift = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const at = (iso, n, h, m) => `${shift(iso, -n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${OFF}`;
export const calcWindows = iso => ({
  1: { inicio: at(iso, 90, 0, 0), fim: at(iso, 45, 23, 59) },   // pré-inscrição livre (info. à comissão até 45 dias antes)
  2: { inicio: at(iso, 44, 0, 0), fim: at(iso, 40, 23, 59) },   // análise da comissão (SUAP até 40 dias antes)
  3: { inicio: at(iso, 39, 0, 0), fim: at(iso, 3, 23, 59) },    // pós-aprovação (inclusões/correções até 3 dias antes)
});
// -1 aguardando MCTI | 0 preparação | 1..3 fases
export function phaseFor(now, definida, w) {
  if (!definida) return -1;
  let p = 0;
  for (const k of [1, 2, 3]) { const x = w[k]; if (x && new Date(x.inicio) <= now && now <= new Date(x.fim)) p = k; }
  if (w[3] && now > new Date(w[3].fim)) p = 3;
  return p;
}
