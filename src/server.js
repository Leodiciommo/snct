import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, q, tx } from './db.js';
import { makeProvider } from './auth/index.js';
import { findConflicts } from './conflicts.js';
import { calcWindows, phaseFor } from './phases.js';
import { suapRows, toCsv } from './suap.js';
import { joomlaHtml } from './joomla.js';

const prod = process.env.NODE_ENV === 'production';
if (prod && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET é obrigatório em produção');
const prov = await makeProvider();
const app = express(), api = express.Router();
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public');
const Y = ':ano(\\d{4})';
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], // TODO: extrair o JS inline e remover 'unsafe-inline'
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], frameAncestors: ["'self'"] } } }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  store: new (pgSession(session))({ pool, createTableIfMissing: true }), name: 'snct.sid',
  secret: process.env.SESSION_SECRET || 'dev-somente', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: prod, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 },
}));
// Defesa CSRF simples: requisições que alteram dados exigem este cabeçalho (o navegador não o envia em formulários externos)
api.use((req, res, next) => (req.method === 'GET' || req.get('X-Requested-With') === 'snct') ? next() : res.status(403).json({ erro: 'Requisição inválida' }));

const ah = f => (req, res, next) => f(req, res, next).catch(next);
const RANK = { coordenador: 1, comissao: 2, cg: 3, admin: 4 };
const rank = u => u ? Math.max(u.vinculo === 'servidor' ? 1 : 0, ...u.papeis.map(p => RANK[p])) : 0;
const need = min => (req, res, next) => rank(req.session.user) >= RANK[min] ? next() : res.status(req.session.user ? 403 : 401).json({ erro: 'Acesso negado' });
const isCom = req => rank(req.session.user) >= RANK.comissao;
const audit = (req, acao, ent, id, det = {}) => q('INSERT INTO auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,$3,$4,$5)', [req.session?.user?.id ?? null, acao, ent, String(id ?? ''), det]).catch(console.error);

// ---------- Edição (carrega e atualiza a fase efetiva; aprova automaticamente ao entrar na Fase 3) ----------
async function autoApprove(edId, req) {
  const r = await tx(async c => {
    const { rows } = await c.query(`${ACT} WHERE a.edicao_id=$1 AND a.status<>'rejeitada'`, [edId]);
    const ids = rows.filter(a => a.status === 'analise' && !findConflicts(a, rows.filter(b => b.salaId === a.salaId)).length).map(a => a.id);
    if (ids.length) await c.query(`UPDATE atividades SET status='aprovada',versao=versao+1,atualizado_em=now() WHERE id=ANY($1)`, [ids]);
    return ids;
  });
  if (r.length) await audit(req, 'aprovacao_automatica', 'edicao', edId, { ids: r });
  return r.length;
}
const E = ah(async (req, res, next) => {
  const [ed] = await q('SELECT *, to_char(data_ini,\'YYYY-MM-DD\') AS "dataIni", to_char(data_fim,\'YYYY-MM-DD\') AS "dataFim", to_char(insc_suap_ini,\'YYYY-MM-DD\') AS "inscSuapIni" FROM edicoes WHERE ano=$1', [+req.params.ano]);
  if (!ed) return res.status(404).json({ erro: 'Edição não encontrada' });
  const wins = Object.fromEntries((await q('SELECT fase,inicio,fim FROM janelas WHERE edicao_id=$1', [ed.id])).map(w => [w.fase, w]));
  let fase = ed.fase_auto ? phaseFor(new Date(), ed.definida, wins) : (ed.definida ? ed.fase : -1);
  if (fase !== ed.fase) { await q('UPDATE edicoes SET fase=$1 WHERE id=$2', [fase, ed.id]); ed.fase = fase; if (fase === 3) await autoApprove(ed.id, req); }
  req.ed = ed; req.wins = wins; next();
});

// ---------- Consultas de atividades ----------
const ACT = `SELECT a.id,a.status,a.titulo,a.resumo,a.area,a.cnpq,a.tipo,a.sala_id AS "salaId",s.codigo AS sala,s.funcao,
 to_char(a.data_ini,'YYYY-MM-DD') AS "dataIni",to_char(a.data_fim,'YYYY-MM-DD') AS "dataFim",to_char(a.hora_ini,'HH24:MI') AS "horaIni",to_char(a.hora_fim,'HH24:MI') AS "horaFim",
 a.uso_continuo AS "usoContinuo",a.vagas,a.insc_online AS "inscOnline",a.certificado,a.link_suap AS "linkSuap",a.justificativa,a.versao,a.criado_por AS "criadoPor"
 FROM atividades a JOIN salas s ON s.id=a.sala_id`;
async function withPeople(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const ps = await q(`SELECT p.atividade_id AS id,p.papel,COALESCE(u.nome,p.nome_manual) AS nome,p.usuario_id AS uid FROM atividade_pessoas p LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE p.atividade_id=ANY($1) ORDER BY p.ordem`, [ids]);
  const pb = await q('SELECT atividade_id AS id,publico FROM atividade_publicos WHERE atividade_id=ANY($1)', [ids]);
  const nm = (id, papel) => ps.filter(p => p.id === id && p.papel === papel).map(p => p.nome);
  return rows.map(r => ({ ...r, coordenador: nm(r.id, 'coordenador')[0], coordenadorUid: ps.find(p => p.id === r.id && p.papel === 'coordenador')?.uid,
    organizadores: nm(r.id, 'organizador'), palestrantes: nm(r.id, 'palestrante'), publicos: pb.filter(p => p.id === r.id).map(p => p.publico) }));
}
// Regra pública: nunca rejeitada/barrada; "aprovada sem link SUAP" só a partir da fase configurada; nada antes da Fase 1
const visPublica = ed => ed.fase >= 1 ? `a.status IN ('analise','aprovada') AND (a.status<>'aprovada' OR a.link_suap IS NOT NULL OR ${ed.fase >= ed.pendente_visivel_fase})` : 'false';
const publicFields = a => ({ id: a.id, status: a.status, titulo: a.titulo, resumo: a.resumo, area: a.area, cnpq: a.cnpq, tipo: a.tipo, sala: a.sala, funcao: a.funcao,
  dataIni: a.dataIni, dataFim: a.dataFim, horaIni: a.horaIni, horaFim: a.horaFim, usoContinuo: a.usoContinuo, vagas: a.vagas, linkSuap: a.linkSuap,
  coordenador: a.coordenador, palestrantes: a.palestrantes });

api.get('/edicoes', ah(async (_q, res) => res.json(await q('SELECT ano,titulo,definida FROM edicoes ORDER BY ano DESC'))));
api.get(`/${Y}`, E, ah(async (req, res) => {
  const { ed } = req, base = { ano: ed.ano, titulo: ed.titulo, definida: ed.definida, fase: ed.fase };
  if (!ed.definida) return res.json(base); // etapa prévia: só informações gerais, cores padrão, sem agendamento
  const [paginas, parceiros] = await Promise.all([
    q('SELECT slug,titulo,conteudo,pdf_url AS "pdfUrl" FROM paginas WHERE edicao_id=$1 AND ativa ORDER BY ordem', [ed.id]),
    q('SELECT nome,url,logo,categoria FROM parceiros WHERE edicao_id=$1 AND ativo ORDER BY ordem', [ed.id])]);
  res.json({ ...base, tema: ed.tema, dataIni: ed.dataIni, dataFim: ed.dataFim, cor1: ed.cor1, cor2: ed.cor2, banner: ed.banner, comissao: ed.comissao_txt || null,
    exibirCategorias: ed.exibir_categorias, horaIni: ed.hora_ini, horaFim: ed.hora_fim, janelas: req.wins, paginas, parceiros });
}));
api.get(`/${Y}/cronograma`, E, (req, res) => res.json({ definida: req.ed.definida, fase: req.ed.fase, dataIni: req.ed.dataIni, dataFim: req.ed.dataFim, janelas: req.wins }));
api.get(`/${Y}/atividades`, E, ah(async (req, res) => {
  const p = [req.ed.id], w = [visPublica(req.ed)], f = { area: 'a.area', cnpq: 'a.cnpq', sala: 's.codigo' };
  for (const k in f) if (req.query[k]) { p.push(req.query[k]); w.push(`${f[k]}=$${p.length}`); }
  if (req.query.dia) { p.push(req.query.dia); w.push(`a.data_ini<=$${p.length}::date AND a.data_fim>=$${p.length}::date`); }
  if (req.query.q) { p.push('%' + req.query.q + '%'); w.push(`(a.titulo ILIKE $${p.length} OR a.resumo ILIKE $${p.length})`); }
  const rows = await withPeople(await q(`${ACT} WHERE a.edicao_id=$1 AND ${w.join(' AND ')} ORDER BY a.data_ini,a.hora_ini`, p));
  res.json(rows.map(publicFields));
}));
api.get(`/${Y}/ocupacao`, E, ah(async (req, res) => { // a grade (meia em meia hora) é montada no cliente a partir dos blocos
  const rows = await q(`${ACT} WHERE a.edicao_id=$1 AND ${visPublica(req.ed)}`, [req.ed.id]);
  res.json(rows.map(a => ({ id: a.id, titulo: a.titulo, salaId: a.salaId, sala: a.sala, dataIni: a.dataIni, dataFim: a.dataFim, horaIni: a.horaIni, horaFim: a.horaFim, usoContinuo: a.usoContinuo })));
}));

// ---------- Autenticação ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: +process.env.LOGIN_MAX_ATTEMPTS || 5, skipSuccessfulRequests: true, standardHeaders: true,
  keyGenerator: req => `${req.ip}:${String(req.body?.prontuario || '').toUpperCase()}` });
async function abrirSessao(req, info) {
  const [u] = await q(`INSERT INTO usuarios(prontuario,nome,email,vinculo,ultimo_login) VALUES($1,$2,$3,$4,now())
    ON CONFLICT(prontuario) DO UPDATE SET nome=EXCLUDED.nome,email=EXCLUDED.email,vinculo=EXCLUDED.vinculo,ultimo_login=now() RETURNING id,prontuario,nome,vinculo,ativo`,
    [info.prontuario, info.nome, info.email, info.vinculo]);
  if (!u.ativo) return null;
  const papeis = (await q('SELECT papel FROM papeis WHERE usuario_id=$1', [u.id])).map(r => r.papel);
  await new Promise((ok, no) => req.session.regenerate(e => e ? no(e) : ok()));
  req.session.user = { id: u.id, prontuario: u.prontuario, nome: u.nome, vinculo: u.vinculo, papeis };
  return req.session.user;
}
api.post('/login', loginLimiter, ah(async (req, res) => {
  const { prontuario, senha } = req.body || {};
  const info = await prov.authenticate(prontuario, senha); // a senha nunca é armazenada nem registrada em log
  if (!info) { await audit(req, 'login_falha', 'usuario', String(prontuario || '').slice(0, 32)); return res.status(401).json({ erro: 'Prontuário ou senha inválidos' }); }
  const u = await abrirSessao(req, info);
  if (!u) return res.status(403).json({ erro: 'Usuário desativado' });
  await audit(req, 'login', 'usuario', u.id); res.json(u);
}));
api.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
api.get('/me', ah(async (req, res) => {
  if (!req.session.user && prov.fromRequest) { const i = prov.fromRequest(req); if (i) await abrirSessao(req, i); }
  res.json(req.session.user || null);
}));
api.get('/usuarios/busca', need('coordenador'), ah(async (req, res) => res.json(await prov.search(req.query.q))));

// ---------- Criação e gestão de atividades ----------
async function validar(b, ed) {
  const t = v => typeof v === 'string' ? v.trim() : '';
  if (t(b.titulo).length < 5 || t(b.titulo).length > 120) return 'Título deve ter de 5 a 120 caracteres.';
  if (t(b.resumo).length < 10) return 'Descrição muito curta.';
  const ok = async (k, v) => (await q('SELECT 1 FROM opcoes WHERE kind=$1 AND valor=$2 AND ativo', [k, v])).length > 0;
  if (!await ok('area', b.area)) return 'Área do campus é obrigatória e deve ser uma das opções.';
  if (b.cnpq && !await ok('cnpq', b.cnpq)) return 'Classificação CNPq inválida.';
  if (!await ok('tipo', b.tipo)) return 'Tipo de atividade inválido.';
  if (!Array.isArray(b.publicos) || !b.publicos.length) return 'Informe o público-alvo.';
  if (!(await q('SELECT 1 FROM salas WHERE id=$1 AND ativa', [b.salaId])).length) return 'Sala inválida.';
  if (!/^\d{4}-\d\d-\d\d$/.test(b.dataIni) || !/^\d{4}-\d\d-\d\d$/.test(b.dataFim) || b.dataFim < b.dataIni) return 'Datas inválidas.';
  if (b.dataIni < ed.dataIni || b.dataFim > ed.dataFim) return 'Datas fora do período da SNCT.';
  if (!/^\d\d:(00|30)$/.test(b.horaIni) || !/^\d\d:(00|30)$/.test(b.horaFim) || b.horaFim <= b.horaIni) return 'Horários devem ser em múltiplos de 30 minutos, com fim posterior ao início.';
  if (!(b.vagas > 0)) return 'Informe o número de vagas.';
  if (b.pessoas?.coordenador?.length !== 1) return 'Indique exatamente um coordenador.';
}
// Pessoa: {tipo:'eu'|'user'|'manual', prontuario?, nome?}
async function resolverPessoas(c, u, pessoas) {
  const out = [], avisos = [];
  const papeis = [['coordenador', 'coordenador'], ['organizadores', 'organizador'], ['palestrantes', 'palestrante']];
  for (const [campo, papel] of papeis) for (const [i, x] of (pessoas[campo] || []).entries()) {
    if (x.tipo === 'eu') out.push({ papel, uid: u.id, ordem: i });
    else if (x.tipo === 'user') {
      const info = await prov.lookup(x.prontuario); if (!info) throw Object.assign(new Error(`Usuário não encontrado: ${x.prontuario}`), { http: 422 });
      const { rows: [r] } = await c.query(`INSERT INTO usuarios(prontuario,nome,email,vinculo) VALUES($1,$2,$3,$4) ON CONFLICT(prontuario) DO UPDATE SET nome=EXCLUDED.nome RETURNING id,vinculo`, [info.prontuario, info.nome, info.email, info.vinculo]);
      if (papel === 'coordenador' && r.vinculo !== 'servidor') throw Object.assign(new Error('O coordenador deve ser servidor.'), { http: 422 });
      out.push({ papel, uid: r.id, ordem: i });
    } else if (x.tipo === 'manual' && String(x.nome || '').trim().length >= 3) {
      out.push({ papel, nome: x.nome.trim(), ordem: i }); if (papel === 'coordenador') avisos.push('Coordenador informado manualmente: confirme se é servidor cadastrado no SUAP.');
    } else throw Object.assign(new Error('Pessoa inválida.'), { http: 422 });
  }
  return { out, avisos };
}
const snapshot = async (c, id, por) => { const { rows: [a] } = await c.query('SELECT * FROM atividades WHERE id=$1', [id]); await c.query('INSERT INTO atividade_versoes(atividade_id,versao,dados,alterado_por) VALUES($1,$2,$3,$4)', [id, a.versao, a, por]); };
const SEL = `SELECT a.id,a.status,a.sala_id AS "salaId",a.titulo,to_char(a.data_ini,'YYYY-MM-DD') AS "dataIni",to_char(a.data_fim,'YYYY-MM-DD') AS "dataFim",to_char(a.hora_ini,'HH24:MI') AS "horaIni",to_char(a.hora_fim,'HH24:MI') AS "horaFim",a.uso_continuo AS "usoContinuo" FROM atividades a`;

api.post(`/${Y}/atividades`, need('coordenador'), E, ah(async (req, res) => {
  const { ed } = req, u = req.session.user, b = req.body || {};
  if (ed.fase < 1) return res.status(409).json({ erro: 'A proposição de atividades ainda não foi aberta.' });
  if (ed.fase === 2 && !isCom(req)) return res.status(409).json({ erro: 'Fase 2: inscrições encerradas para coordenadores.' });
  const erro = await validar(b, ed); if (erro) return res.status(422).json({ erro });
  const out = await tx(async c => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [b.salaId]); // serializa reservas da mesma sala
    const { rows } = await c.query(`${SEL} WHERE a.edicao_id=$1 AND a.sala_id=$2 AND a.status<>'rejeitada' AND a.data_ini<=$4 AND a.data_fim>=$3`, [ed.id, b.salaId, b.dataIni, b.dataFim]);
    const cf = findConflicts({ ...b, usoContinuo: !!b.usoContinuo && b.dataIni !== b.dataFim }, rows);
    if (ed.fase === 3 && cf.length) return { bloqueado: cf };
    const { out: pes, avisos } = await resolverPessoas(c, u, b.pessoas);
    const { rows: [a] } = await c.query(`INSERT INTO atividades(edicao_id,status,titulo,resumo,area,cnpq,tipo,sala_id,data_ini,data_fim,hora_ini,hora_fim,uso_continuo,vagas,insc_online,certificado,software,comunicacao_online,diaria,veiculo_oficial,observacoes,criado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id,status`,
      [ed.id, ed.fase === 3 ? 'aprovada' : 'analise', b.titulo.trim(), b.resumo.trim(), b.area, b.cnpq || null, b.tipo, b.salaId, b.dataIni, b.dataFim, b.horaIni, b.horaFim,
       !!b.usoContinuo && b.dataIni !== b.dataFim, b.vagas, !!b.inscOnline, b.certificado !== false, b.software || null, !!b.comunicacaoOnline, !!b.diaria, !!b.veiculoOficial, b.observacoes || null, u.id]);
    for (const p of pes) await c.query('INSERT INTO atividade_pessoas(atividade_id,papel,usuario_id,nome_manual,ordem) VALUES($1,$2,$3,$4,$5)', [a.id, p.papel, p.uid ?? null, p.nome ?? null, p.ordem]);
    for (const x of b.publicos) await c.query('INSERT INTO atividade_publicos VALUES($1,$2) ON CONFLICT DO NOTHING', [a.id, x]);
    for (const x of b.recursos || []) await c.query('INSERT INTO atividade_recursos VALUES($1,$2) ON CONFLICT DO NOTHING', [a.id, x]);
    await snapshot(c, a.id, u.id);
    return { id: a.id, status: a.status, conflitos: cf.map(x => ({ id: x.id, titulo: x.titulo })), avisos };
  });
  if (out.bloqueado) return res.status(409).json({ erro: 'Sala já ocupada neste horário. Escolha outra sala ou horário.', conflitos: out.bloqueado.map(x => ({ id: x.id, titulo: x.titulo })) });
  await audit(req, 'criar', 'atividade', out.id, { status: out.status }); res.status(201).json(out);
}));
api.get(`/${Y}/minhas`, need('coordenador'), E, ah(async (req, res) => {
  const rows = await withPeople(await q(`${ACT} WHERE a.edicao_id=$1 AND (a.criado_por=$2 OR EXISTS(SELECT 1 FROM atividade_pessoas p WHERE p.atividade_id=a.id AND p.papel='coordenador' AND p.usuario_id=$2))`, [req.ed.id, req.session.user.id]));
  res.json(rows);
}));
async function dono(req, id) { // criador, coordenador indicado ou comissão+
  const [a] = await withPeople(await q(`${ACT} WHERE a.id=$1`, [id])); if (!a) return null;
  const uid = req.session.user.id;
  return isCom(req) || a.criadoPor === uid || a.coordenadorUid === uid ? a : null;
}
api.patch('/atividades/:id', need('coordenador'), ah(async (req, res) => {
  const a = await dono(req, +req.params.id); if (!a) return res.status(403).json({ erro: 'Acesso negado' });
  const b = req.body || {}, com = isCom(req);
  // Coordenador só corrige título/descrição de atividade retida; ao salvar, volta para análise
  if (!com && a.status !== 'barrada') return res.status(409).json({ erro: 'Somente atividades retidas pela comissão podem ser corrigidas.' });
  const campos = com ? { titulo: 'titulo', resumo: 'resumo', salaId: 'sala_id', dataIni: 'data_ini', dataFim: 'data_fim', horaIni: 'hora_ini', horaFim: 'hora_fim' } : { titulo: 'titulo', resumo: 'resumo' };
  const k = Object.keys(campos).filter(c => b[c] !== undefined); if (!k.length) return res.status(422).json({ erro: 'Nada a atualizar' });
  await tx(async c => {
    await c.query(`UPDATE atividades SET ${k.map((x, i) => `${campos[x]}=$${i + 1}`).join(',')}${!com ? ",status='analise',justificativa=NULL" : ''},versao=versao+1,atualizado_em=now() WHERE id=$${k.length + 1}`, [...k.map(x => b[x]), a.id]);
    await snapshot(c, a.id, req.session.user.id);
  });
  await audit(req, 'editar', 'atividade', a.id, b); res.json({ ok: true });
}));
api.post('/atividades/:id/decisao', need('comissao'), ah(async (req, res) => { // aprovar | rejeitar | barrar | liberar (em qualquer fase)
  const { acao } = req.body || {}, j = String(req.body?.justificativa || '').trim();
  const [a] = await q(`${SEL.replace('a.titulo,', 'a.titulo,a.status_anterior AS ant,')} WHERE a.id=$1`, [+req.params.id]); if (!a) return res.status(404).json({ erro: 'Não encontrada' });
  if (['rejeitar', 'barrar'].includes(acao) && j.length < 5) return res.status(422).json({ erro: 'Informe a justificativa.' });
  let st = a.status, ant = a.ant;
  if (acao === 'aprovar') {
    const cf = findConflicts(a, await q(`${SEL} WHERE a.edicao_id=(SELECT edicao_id FROM atividades WHERE id=$1) AND a.sala_id=$2 AND a.status<>'rejeitada'`, [a.id, a.salaId]));
    if (cf.length && j.length < 5) return res.status(422).json({ erro: 'Há conflito: informe a justificativa da aprovação.', conflitos: cf.map(x => x.id) });
    st = 'aprovada';
  } else if (acao === 'rejeitar') st = 'rejeitada';
  else if (acao === 'barrar') { ant = a.status; st = 'barrada'; }
  else if (acao === 'liberar' && a.status === 'barrada') st = ant && ant !== 'barrada' ? ant : 'analise';
  else return res.status(422).json({ erro: 'Ação inválida' });
  await tx(async c => { await c.query('UPDATE atividades SET status=$1,status_anterior=$2,justificativa=$3,versao=versao+1,atualizado_em=now() WHERE id=$4', [st, ant ?? null, j || null, a.id]); await snapshot(c, a.id, req.session.user.id); });
  await audit(req, acao, 'atividade', a.id, { justificativa: j }); res.json({ status: st });
}));
api.post(`/${Y}/aprovacao-automatica`, need('comissao'), E, ah(async (req, res) => res.json({ aprovadas: await autoApprove(req.ed.id, req) })));
api.get(`/${Y}/painel`, need('comissao'), E, ah(async (req, res) => {
  const rows = await withPeople(await q(`${ACT} WHERE a.edicao_id=$1 ORDER BY a.data_ini,a.hora_ini`, [req.ed.id]));
  res.json(rows.map(a => ({ ...a, conflitos: findConflicts(a, rows.filter(b => b.salaId === a.salaId)).map(x => ({ id: x.id, titulo: x.titulo })) })));
}));
api.put('/atividades/:id/link-suap', need('coordenador'), ah(async (req, res) => {
  const a = await dono(req, +req.params.id); if (!a) return res.status(403).json({ erro: 'Acesso negado' });
  const l = String(req.body?.link || '').trim();
  if (l && !/^https:\/\/suap\.ifsp\.edu\.br\/eventos\//.test(l)) return res.status(422).json({ erro: 'Informe o link do evento no SUAP (https://suap.ifsp.edu.br/eventos/...)' });
  await q('UPDATE atividades SET link_suap=$1,versao=versao+1,atualizado_em=now() WHERE id=$2', [l || null, a.id]); await audit(req, 'link_suap', 'atividade', a.id, { l }); res.json({ ok: true });
}));
async function dadosSuap(id, req) {
  const a = await dono(req, id); if (!a || a.status !== 'aprovada') return null;
  const [ed] = await q('SELECT prefixo,ano,to_char(insc_suap_ini,\'YYYY-MM-DD\') AS "inscSuapIni" FROM edicoes WHERE id=(SELECT edicao_id FROM atividades WHERE id=$1)', [id]);
  return { a, rows: suapRows(a, ed) };
}
api.get('/atividades/:id/suap', need('coordenador'), ah(async (req, res) => { const d = await dadosSuap(+req.params.id, req); d ? res.json({ campos: d.rows, link: d.a.linkSuap }) : res.status(404).json({ erro: 'Disponível apenas para atividades aprovadas.' }); }));
api.get(`/${Y}/export/suap.csv`, need('comissao'), E, ah(async (req, res) => {
  const rows = await withPeople(await q(`${ACT} WHERE a.edicao_id=$1 AND a.status='aprovada' ORDER BY a.data_ini,a.hora_ini`, [req.ed.id]));
  res.type('text/csv; charset=utf-8').attachment(`suap-snct-${req.ed.ano}.csv`).send(toCsv(rows.map(a => ({ rows: suapRows(a, req.ed), link: a.linkSuap }))));
}));

api.get(`/${Y}/export/joomla.html`, need('comissao'), E, ah(async (req, res) => { // HTML para o site institucional (Joomla)
  const rows = await withPeople(await q(`${ACT} WHERE a.edicao_id=$1 AND a.status='aprovada' AND (a.link_suap IS NOT NULL OR ${req.ed.fase >= req.ed.pendente_visivel_fase}) ORDER BY a.data_ini,a.hora_ini`, [req.ed.id]));
  res.type('text/html; charset=utf-8').send(joomlaHtml(rows, req.ed));
}));

// ---------- Configuração (coordenação geral da SNCT ou administrador) ----------
const CFG = ['titulo', 'tema', 'prefixo', 'cor1', 'cor2', 'banner', 'hora_ini', 'hora_fim', 'insc_suap_ini', 'comissao_txt', 'exibir_categorias', 'pendente_visivel_fase', 'fase', 'fase_auto'];
api.put(`/${Y}/config`, need('cg'), E, ah(async (req, res) => {
  const b = req.body || {}, k = CFG.filter(c => b[c] !== undefined); if (!k.length) return res.status(422).json({ erro: 'Nada a atualizar' });
  await q(`UPDATE edicoes SET ${k.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${k.length + 1}`, [...k.map(c => b[c]), req.ed.id]);
  await audit(req, 'config', 'edicao', req.ed.id, b); res.json({ ok: true });
}));
api.post(`/${Y}/definir`, need('cg'), E, ah(async (req, res) => { // confirma data e tema do MCTI e gera o cronograma do regulamento
  const { tema, dataIni, dataFim } = req.body || {};
  if (!tema?.trim() || !/^\d{4}-\d\d-\d\d$/.test(dataIni) || !/^\d{4}-\d\d-\d\d$/.test(dataFim) || dataFim < dataIni) return res.status(422).json({ erro: 'Informe tema e datas válidas.' });
  const w = calcWindows(dataIni);
  await tx(async c => {
    await c.query('UPDATE edicoes SET tema=$1,data_ini=$2,data_fim=$3,definida=true,fase_auto=true WHERE id=$4', [tema.trim(), dataIni, dataFim, req.ed.id]);
    for (const f of [1, 2, 3]) await c.query('INSERT INTO janelas VALUES($1,$2,$3,$4) ON CONFLICT(edicao_id,fase) DO UPDATE SET inicio=EXCLUDED.inicio,fim=EXCLUDED.fim', [req.ed.id, f, w[f].inicio, w[f].fim]);
  });
  await audit(req, 'definir_mcti', 'edicao', req.ed.id, { tema, dataIni, dataFim }); res.json({ janelas: w });
}));
api.put(`/${Y}/janelas`, need('cg'), E, ah(async (req, res) => { // datas redefinidas manualmente
  for (const f of [1, 2, 3]) { const x = req.body?.[f]; if (x) await q('INSERT INTO janelas VALUES($1,$2,$3,$4) ON CONFLICT(edicao_id,fase) DO UPDATE SET inicio=EXCLUDED.inicio,fim=EXCLUDED.fim', [req.ed.id, f, x.inicio, x.fim]); }
  await audit(req, 'janelas', 'edicao', req.ed.id, req.body); res.json({ ok: true });
}));
api.post('/edicoes', need('cg'), ah(async (req, res) => { // nova edição: copia páginas e parceiros da mais recente
  const ano = +req.body?.ano; if (!(ano > 2000 && ano < 2100)) return res.status(422).json({ erro: 'Ano inválido' });
  const [n] = await q(`INSERT INTO edicoes(ano,titulo,prefixo) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`, [ano, `SNCT IFSP Caraguatatuba ${ano}`, `[SNCT CAR ${ano}]`]);
  if (!n) return res.status(409).json({ erro: 'Edição já existe' });
  const [ult] = await q('SELECT id FROM edicoes WHERE ano<$1 ORDER BY ano DESC LIMIT 1', [ano]);
  if (ult) {
    await q('INSERT INTO paginas(edicao_id,slug,titulo,conteudo,pdf_url,ativa,ordem) SELECT $1,slug,titulo,conteudo,pdf_url,ativa,ordem FROM paginas WHERE edicao_id=$2', [n.id, ult.id]);
    await q('INSERT INTO parceiros(edicao_id,nome,url,logo,categoria,ordem,ativo) SELECT $1,nome,url,logo,categoria,ordem,ativo FROM parceiros WHERE edicao_id=$2', [n.id, ult.id]);
  }
  await audit(req, 'criar_edicao', 'edicao', n.id, { ano }); res.status(201).json({ id: n.id });
}));
function crud(route, table, cols, byEd) { // cols é lista fixa no código: não vem do usuário
  const pick = b => cols.filter(c => b[c] !== undefined), mid = byEd ? [E] : [];
  api.get(route, need('cg'), ...mid, ah(async (req, res) => res.json(await q(`SELECT * FROM ${table}${byEd ? ' WHERE edicao_id=$1' : ''} ORDER BY id`, byEd ? [req.ed.id] : []))));
  api.post(route, need('cg'), ...mid, ah(async (req, res) => {
    const b = req.body || {}, k = pick(b), v = k.map(c => b[c]); if (byEd) { k.push('edicao_id'); v.push(req.ed.id); }
    const [r] = await q(`INSERT INTO ${table}(${k.join(',')}) VALUES(${k.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, v); await audit(req, 'criar', table, r.id, b); res.status(201).json(r);
  }));
  api.put(route + '/:id', need('cg'), ah(async (req, res) => {
    const b = req.body || {}, k = pick(b); if (!k.length) return res.status(422).json({ erro: 'Nada a atualizar' });
    const [r] = await q(`UPDATE ${table} SET ${k.map((c, i) => c + '=$' + (i + 1)).join(',')} WHERE id=$${k.length + 1} RETURNING *`, [...k.map(c => b[c]), +req.params.id]);
    r ? (await audit(req, 'editar', table, r.id, b), res.json(r)) : res.status(404).json({ erro: 'Não encontrado' });
  }));
  api.delete(route + '/:id', need('cg'), ah(async (req, res) => { await q(`DELETE FROM ${table} WHERE id=$1`, [+req.params.id]); await audit(req, 'excluir', table, req.params.id); res.json({ ok: true }); }));
}
crud('/admin/salas', 'salas', ['codigo', 'funcao', 'assentos', 'ativa'], false);
crud(`/${Y}/paginas`, 'paginas', ['slug', 'titulo', 'conteudo', 'pdf_url', 'ativa', 'ordem'], true);
crud(`/${Y}/parceiros`, 'parceiros', ['nome', 'url', 'logo', 'categoria', 'ordem', 'ativo'], true);

// ---------- Usuários e papéis ----------
// A coordenação geral concede 'comissao'; apenas o administrador concede 'cg' e 'admin'.
api.put('/admin/usuarios/:prontuario/papeis', need('cg'), ah(async (req, res) => {
  const papeis = req.body?.papeis; if (!Array.isArray(papeis) || papeis.some(p => !['comissao', 'cg', 'admin'].includes(p))) return res.status(422).json({ erro: 'Papéis inválidos' });
  if (rank(req.session.user) < RANK.admin && papeis.some(p => p !== 'comissao')) return res.status(403).json({ erro: 'Somente o administrador concede este papel' });
  const [u] = await q('SELECT id FROM usuarios WHERE prontuario=$1', [req.params.prontuario.toUpperCase()]); if (!u) return res.status(404).json({ erro: 'Usuário nunca acessou o portal' });
  await tx(async c => { await c.query('DELETE FROM papeis WHERE usuario_id=$1', [u.id]); for (const p of papeis) await c.query('INSERT INTO papeis VALUES($1,$2)', [u.id, p]); });
  await audit(req, 'papeis', 'usuario', u.id, { papeis }); res.json({ ok: true });
}));
api.get('/admin/auditoria', need('cg'), ah(async (req, res) => res.json(await q('SELECT * FROM auditoria ORDER BY id DESC LIMIT $1', [Math.min(+req.query.limite || 100, 500)]))));

app.use('/snct/api', api);
app.use('/snct', express.static(pub, { index: false }));
app.get(`/snct/${Y}`, (_r, res) => res.sendFile(path.join(pub, 'index.html')));
app.use((e, _req, res, _next) => { console.error(e); res.status(e.http || (e.code === '23503' ? 409 : 500)).json({ erro: e.http ? e.message : e.code === '23503' ? 'Registro em uso' : 'Erro interno' }); });
app.listen(process.env.PORT || 3000, () => console.log('SNCT CAR em execução'));
