<<<<<<< HEAD
# Portal SNCT IFSP Caraguatatuba (Node.js + PostgreSQL)

Portal por edição (`/snct/2026`, `/snct/2027`...). `/snct` e as edições antigas continuam no site institucional (Joomla).

## Estado desta entrega (leia primeiro)
| Parte | Situação |
|---|---|
| `public/index.html` | **Protótipo funcional** da interface (todos os fluxos), com dados guardados só no navegador. Serve para validar telas e regras. |
| `src/` (API Node.js) | Servidor completo escrito: autenticação, fases, conflitos, aprovação automática, barrar atividade, dados do SUAP, CSV, configuração, auditoria. **Ainda não executado** contra PostgreSQL/LDAP reais: só sintaxe verificada. |
| `tests/` | 16 testes automáticos da lógica pura (conflitos, cronograma do regulamento, campos do SUAP, HTML do Joomla): **passam**. Testes de integração (API + banco + LDAP) ainda não existem. |
| Ligação interface ⇄ API | **Pendente**: a interface ainda não chama a API. É o próximo passo de desenvolvimento. |

Ou seja: o protótipo mostra o que será entregue; o servidor é a base para a versão de produção, que precisa de instalação de teste na CTI, ajuste ao controlador de acessos e a ligação da interface.

## Requisitos
Linux, Node.js 20.6+, PostgreSQL 14+, proxy HTTPS (Nginx/Apache) e acesso de rede ao controlador de acessos.

## Instalação
```bash
cp .env.example .env          # preencher (banco, segredo de sessão, controlador de acessos)
npm install
npm run migrate               # cria as tabelas
npm run seed -- --admin SEU_PRONTUARIO   # salas, listas, edição do ano e primeiro administrador
npm start                     # porta 3000 (use systemd/pm2 em produção)
npm test                      # testes automáticos
```
Alternativa: `docker compose up -d` (ver `docker-compose.yml`). Proxy: `scripts/nginx-snct.conf`.
Backup diário: `scripts/backup.sh` via cron (14 dias de retenção). HTTPS é obrigatório (cookie `Secure`).

## Arquitetura
Uma instalação guarda todas as edições (tabela `edicoes`). Compartilhado: usuários, salas, listas. Por edição: datas, janelas, banner, cores, abas, parceiros, atividades.
Estados da edição: `-1` aguardando MCTI · `0` preparação · `1` pré-inscrição · `2` análise da comissão · `3` pós-aprovação (aprovação automática e bloqueio de conflitos). Com `fase_auto`, a fase muda pelas janelas (calendário do regulamento, Art. 15, ver `src/phases.js`). Ao entrar na fase 3, atividades em análise **sem conflito** são aprovadas automaticamente.
Atividade: `analise → aprovada | rejeitada | barrada`. **Barrar** (comissão, qualquer fase, com motivo) tira a atividade da vista pública até o coordenador corrigir título/descrição e reenviar. Atividade barrada continua ocupando a sala.
Visibilidade pública de "aprovada sem link SUAP": `edicoes.pendente_visivel_fase` (3 = a partir da fase 3; 99 = nunca).
Pessoas (coordenador, organizadores, palestrantes): usuário do cadastro institucional ("eu" ou "outro usuário") ou nome manual (`atividade_pessoas`). Coordenador usuário precisa ter vínculo servidor.
Conflitos: `src/conflicts.js` (grade de 30 min, uso contínuo ou horário diário) + trava `pg_advisory_xact_lock` por sala ao criar na fase 3.
Documentos: `docs/banco.md` (modelo de dados), `docs/campos-formulario.md` (campo a campo), `docs/permissoes.md`, `docs/testes.md`, `docs/autenticacao.md`.

## API (prefixo `/snct/api`)
| Método e rota | Acesso | Função |
|---|---|---|
| GET `/edicoes` · `/AAAA` · `/AAAA/cronograma` | público | lista, dados da edição (mínimos se não definida), cronograma |
| GET `/AAAA/atividades?area=&cnpq=&sala=&dia=&q=` · `/AAAA/ocupacao` | público | programação e ocupação (só o que a regra de visibilidade permite) |
| POST `/login` · `/logout` · GET `/me` | — | sessão (prontuário + senha no controlador) |
| GET `/usuarios/busca?q=` | coordenador | "outro usuário" nos campos de pessoa |
| POST `/AAAA/atividades` · GET `/AAAA/minhas` · PATCH `/atividades/:id` | coordenador | propor, listar, corrigir retida |
| GET `/atividades/:id/suap` · PUT `/atividades/:id/link-suap` | dono/comissão | campos para colar no SUAP; salvar link |
| POST `/atividades/:id/decisao` (`aprovar`/`rejeitar`/`barrar`/`liberar`) · POST `/AAAA/aprovacao-automatica` · GET `/AAAA/painel` · GET `/AAAA/export/suap.csv` · GET `/AAAA/export/joomla.html` | comissão | análise |
| PUT `/AAAA/config` · POST `/AAAA/definir` · PUT `/AAAA/janelas` · POST `/edicoes` · CRUD `/admin/salas`, `/AAAA/paginas`, `/AAAA/parceiros` · GET `/admin/auditoria` | coordenação geral | configuração |
| PUT `/admin/usuarios/:prontuario/papeis` | coord. geral (comissão) / admin (todos) | papéis |
Requisições que alteram dados exigem o cabeçalho `X-Requested-With: snct`.

## Pontos de decisão da CTI
1. O Joomla deve deixar de atender `/snct/2026` (hoje é um artigo) e repassar `/snct/AAAA` e `/snct/api` ao portal (`scripts/nginx-snct.conf`).
2. Política de backup e retenção de dados (LGPD) no servidor.
3. Servidor de e-mail (SMTP), se quiserem avisos automáticos de mediação (não implementado).
Autenticação: mesmo mecanismo dos demais sistemas da CTI, aplicado em `src/auth/` (ver `docs/autenticacao.md`).

## Pendências conhecidas
- **Ligar a interface à API** (principal): `public/index.html` guarda os dados no navegador; `docs/campos-formulario.md` traz o mapeamento campo a campo para a ligação. Não foi feita porque não havia PostgreSQL disponível para testar o servidor de ponta a ponta.
- Testes de integração (API + banco); aviso por e-mail; upload de logotipos/banner (hoje caminho/URL); extrair o JavaScript da página para retirar `unsafe-inline` da política de segurança; Excel/PDF nativos (hoje CSV e impressão); revisão completa de acessibilidade e carga.
=======
# snct
>>>>>>> 5d64732ee3e35d2e51fd6344f203aa685afc40e0
