# Níveis de acesso

| Nível | Quem | Pode |
|---|---|---|
| Público | qualquer pessoa, sem login | ver programação, cronograma, abas informativas, ocupação, detalhes e compartilhar |
| Coordenador de atividade | servidor (vínculo no controlador de acessos) | propor atividades, corrigir as retidas, copiar dados para o SUAP, informar o link do SUAP, ver as próprias atividades |
| Comissão avaliadora | concedido por prontuário | tudo do anterior + painel de análise: aprovar, rejeitar, **barrar/liberar** (qualquer fase, com motivo), editar sala/horário, mediar, aprovação automática, exportar CSV do SUAP |
| Coordenação geral da SNCT | concedido pelo administrador | tudo do anterior + **todas as configurações da edição**: definição MCTI e cronograma, janelas, fases, salas, listas, banner, cores, abas, parceiros, comissão, visibilidade do "pendente de link SUAP", criar próxima edição, conceder o papel de comissão |
| Administrador (CTI) | concedido na instalação (`npm run seed -- --admin PRONTUARIO`) | tudo + configurações de desenvolvimento: conceder papéis `cg`/`admin`, restaurar/importar/exportar dados, `.env` (autenticação, banco), backups, logs técnicos |

Regras: o papel de coordenador de atividade vem do vínculo "servidor"; papéis acima são guardados no portal (tabela `papeis`), nunca no controlador de acessos. Toda ação relevante gera registro em `auditoria`.
