-- SNCT CAR: esquema PostgreSQL (idempotente). Execute: npm run migrate
CREATE TABLE IF NOT EXISTS usuarios(
  id serial PRIMARY KEY, prontuario text UNIQUE NOT NULL, nome text NOT NULL, email text,
  vinculo text NOT NULL CHECK (vinculo IN ('servidor','aluno','externo')),
  ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now(), ultimo_login timestamptz);
-- 'coordenador de atividade' é implícito para vínculo 'servidor'
CREATE TABLE IF NOT EXISTS papeis(
  usuario_id int REFERENCES usuarios ON DELETE CASCADE,
  papel text CHECK (papel IN ('comissao','cg','admin')), PRIMARY KEY(usuario_id, papel));
CREATE TABLE IF NOT EXISTS edicoes(
  id serial PRIMARY KEY, ano int UNIQUE NOT NULL, titulo text NOT NULL, tema text DEFAULT '', prefixo text NOT NULL,
  data_ini date, data_fim date, definida boolean NOT NULL DEFAULT false,
  fase smallint NOT NULL DEFAULT -1 CHECK (fase BETWEEN -1 AND 3), fase_auto boolean NOT NULL DEFAULT false,
  pendente_visivel_fase smallint NOT NULL DEFAULT 3,   -- a partir de qual fase 'pendente de link SUAP' aparece ao público (99 = nunca)
  cor1 text DEFAULT '#4f2a7d', cor2 text DEFAULT '#2e9a46', banner text,
  hora_ini smallint DEFAULT 7, hora_fim smallint DEFAULT 23, insc_suap_ini date,
  comissao_txt text DEFAULT '', exibir_categorias boolean DEFAULT true, criado_em timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS janelas(
  edicao_id int REFERENCES edicoes ON DELETE CASCADE, fase smallint CHECK (fase BETWEEN 1 AND 3),
  inicio timestamptz NOT NULL, fim timestamptz NOT NULL, PRIMARY KEY(edicao_id, fase));
CREATE TABLE IF NOT EXISTS salas(
  id serial PRIMARY KEY, codigo text UNIQUE NOT NULL, funcao text, assentos int, ativa boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS opcoes(
  kind text CHECK (kind IN ('area','cnpq','tipo','publico','recurso')), valor text, ordem int DEFAULT 0,
  ativo boolean DEFAULT true, PRIMARY KEY(kind, valor));
CREATE TABLE IF NOT EXISTS atividades(
  id serial PRIMARY KEY, edicao_id int NOT NULL REFERENCES edicoes,
  status text NOT NULL DEFAULT 'analise' CHECK (status IN ('analise','aprovada','rejeitada','barrada')),
  status_anterior text, titulo text NOT NULL, resumo text NOT NULL,
  area text NOT NULL,            -- área do campus (obrigatória)
  cnpq text,                     -- classificação CNPq (opcional)
  tipo text NOT NULL, sala_id int NOT NULL REFERENCES salas,
  data_ini date NOT NULL, data_fim date NOT NULL, hora_ini time NOT NULL, hora_fim time NOT NULL,
  uso_continuo boolean NOT NULL DEFAULT false, vagas int NOT NULL CHECK (vagas > 0),
  insc_online boolean DEFAULT false, certificado boolean DEFAULT true, software text,
  comunicacao_online boolean DEFAULT false, diaria boolean DEFAULT false, veiculo_oficial boolean DEFAULT false,
  observacoes text,
  link_suap text CHECK (link_suap IS NULL OR link_suap ~ '^https://suap\.ifsp\.edu\.br/eventos/'),
  justificativa text, versao int NOT NULL DEFAULT 1, criado_por int REFERENCES usuarios,
  criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now(),
  CHECK (data_fim >= data_ini AND hora_fim > hora_ini));
CREATE INDEX IF NOT EXISTS ix_ativ_sala ON atividades(edicao_id, sala_id, data_ini, data_fim);
-- coordenador / organizadores / palestrantes: usuário do cadastro institucional OU nome manual
CREATE TABLE IF NOT EXISTS atividade_pessoas(
  id serial PRIMARY KEY, atividade_id int NOT NULL REFERENCES atividades ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('coordenador','organizador','palestrante')),
  usuario_id int REFERENCES usuarios, nome_manual text, ordem smallint DEFAULT 0,
  CHECK (usuario_id IS NOT NULL OR nome_manual IS NOT NULL));
CREATE TABLE IF NOT EXISTS atividade_publicos(atividade_id int REFERENCES atividades ON DELETE CASCADE, publico text, PRIMARY KEY(atividade_id, publico));
CREATE TABLE IF NOT EXISTS atividade_recursos(atividade_id int REFERENCES atividades ON DELETE CASCADE, recurso text, PRIMARY KEY(atividade_id, recurso));
CREATE TABLE IF NOT EXISTS atividade_versoes(
  id serial PRIMARY KEY, atividade_id int REFERENCES atividades ON DELETE CASCADE, versao int, dados jsonb,
  alterado_por int REFERENCES usuarios, em timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS paginas(
  id serial PRIMARY KEY, edicao_id int REFERENCES edicoes ON DELETE CASCADE, slug text NOT NULL, titulo text NOT NULL,
  conteudo text DEFAULT '', pdf_url text, ativa boolean DEFAULT true, ordem int DEFAULT 0, UNIQUE(edicao_id, slug));
CREATE TABLE IF NOT EXISTS parceiros(
  id serial PRIMARY KEY, edicao_id int REFERENCES edicoes ON DELETE CASCADE, nome text NOT NULL, url text, logo text,
  categoria text CHECK (categoria IN ('platinum','gold','silver')), ordem int DEFAULT 0, ativo boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS auditoria(
  id bigserial PRIMARY KEY, em timestamptz DEFAULT now(), usuario_id int, acao text NOT NULL,
  entidade text, entidade_id text, detalhes jsonb);
