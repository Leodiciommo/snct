import fs from 'node:fs';
import { Client } from 'ldapts';
const esc = v => String(v).replace(/[\\*()\0]/g, c => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
export default env => {
  const A = { p: env.LDAP_ATTR_PRONTUARIO || 'uid', n: env.LDAP_ATTR_NOME || 'displayName', e: env.LDAP_ATTR_EMAIL || 'mail', v: env.LDAP_ATTR_VINCULO || 'memberOf' };
  const mk = () => new Client({ url: env.LDAP_URL, timeout: 8000, connectTimeout: 8000, tlsOptions: env.LDAP_CA_CERT ? { ca: fs.readFileSync(env.LDAP_CA_CERT) } : {} });
  const one = v => String((Array.isArray(v) ? v[0] : v) ?? '');
  const vinculo = e => { const g = [].concat(e[A.v] || []).map(String); return g.includes(env.LDAP_GRUPO_SERVIDOR) ? 'servidor' : g.includes(env.LDAP_GRUPO_ALUNO) ? 'aluno' : 'externo'; };
  const map = e => ({ prontuario: one(e[A.p]).toUpperCase(), nome: one(e[A.n]), email: one(e[A.e]), vinculo: vinculo(e) });
  async function find(filter, limit) {
    const c = mk();
    try {
      await c.bind(env.LDAP_BIND_DN, env.LDAP_BIND_PASSWORD);
      const r = await c.search(env.LDAP_BASE_DN, { scope: 'sub', filter, attributes: [A.p, A.n, A.e, A.v], sizeLimit: limit });
      return r.searchEntries;
    } finally { await c.unbind().catch(() => {}); }
  }
  const byPront = p => env.LDAP_USER_FILTER.replace('{prontuario}', esc(p));
  const okP = p => /^[A-Za-z0-9._-]{3,32}$/.test(p || '');
  return {
    async authenticate(p, senha) {
      // senha vazia permitiria "bind anônimo" no LDAP: sempre rejeitar
      if (!okP(p) || !senha || typeof senha !== 'string' || senha.length > 256) return null;
      try {
        const es = await find(byPront(p), 2);
        if (es.length !== 1) return null;
        const c2 = mk();
        try { await c2.bind(es[0].dn, senha); } finally { await c2.unbind().catch(() => {}); }
        return map(es[0]);
      } catch { return null; }
    },
    async lookup(p) { if (!okP(p)) return null; try { const es = await find(byPront(p), 2); return es.length === 1 ? map(es[0]) : null; } catch { return null; } },
    async search(t) {
      t = String(t || '').trim(); if (t.length < 3) return [];
      try { const es = await find(`(|(${A.p}=${esc(t)}*)(${A.n}=*${esc(t)}*))`, 10); return es.map(map).map(u => ({ prontuario: u.prontuario, nome: u.nome })); } catch { return []; }
    },
  };
};
