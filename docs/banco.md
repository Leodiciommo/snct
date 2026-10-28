# Modelo de dados (PostgreSQL) — esquema completo em `db/schema.sql`

```mermaid
erDiagram
  EDICOES ||--o{ JANELAS : tem
  EDICOES ||--o{ ATIVIDADES : recebe
  EDICOES ||--o{ PAGINAS : tem
  EDICOES ||--o{ PARCEIROS : tem
  SALAS ||--o{ ATIVIDADES : "é usada em"
  USUARIOS ||--o{ PAPEIS : possui
  USUARIOS ||--o{ ATIVIDADES : cria
  ATIVIDADES ||--o{ ATIVIDADE_PESSOAS : "coordenador/organizador/palestrante"
  USUARIOS |o--o{ ATIVIDADE_PESSOAS : "usuário institucional (ou nome manual)"
  ATIVIDADES ||--o{ ATIVIDADE_PUBLICOS : tem
  ATIVIDADES ||--o{ ATIVIDADE_RECURSOS : tem
  ATIVIDADES ||--o{ ATIVIDADE_VERSOES : "histórico"
  USUARIOS ||--o{ AUDITORIA : gera
```
Compartilhado entre edições: `usuarios`, `papeis`, `salas`, `opcoes`. Por edição: `edicoes`, `janelas`, `atividades` (e filhas), `paginas`, `parceiros`. Toda alteração de atividade grava um snapshot em `atividade_versoes`; ações relevantes vão para `auditoria`.
