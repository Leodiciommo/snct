# Casos de teste

Automáticos (`npm test`, 16 testes passando): conflitos de sala (sobreposição, horários adjacentes, salas e dias diferentes, vários dias com horário diário e com uso contínuo, rejeitada ignorada, barrada ocupa a sala), cronograma do regulamento e fase por data, 31 campos do SUAP e CSV, HTML do Joomla.

Manuais (executar na instalação de teste; ✔ = coberto também no protótipo):
| # | Caso | Resultado esperado |
|---|---|---|
| F-1 | Antes da definição do MCTI | só informações gerais, cores padrão, sem programação nem formulário ✔ |
| F-2 | Confirmar data/tema | cronograma gerado a partir do regulamento; fase passa a "preparação"/fase por data ✔ |
| F0 | Preparação | público vê tema e cronograma; formulário fechado ✔ |
| F1-1 | Pré-inscrição com conflito de sala | envio aceito; conflito sinalizado a todos os interessados ✔ |
| F1-2 | Texto curto/genérico | alerta para a comissão ✔ |
| F2-1 | Coordenador tenta enviar na fase 2 | recusado com mensagem; comissão ainda pode ✔ |
| F2-2 | Comissão aprova com conflito | exige justificativa; registro na auditoria ✔ |
| F2-3 | Comissão edita sala/horário | nova versão gravada ✔ |
| F2-4 | Comissão barra atividade (qualquer fase) | some do público, motivo ao coordenador, sala continua ocupada ✔ |
| F2-5 | Coordenador corrige e reenvia | volta para análise ✔ |
| F3-1 | Entrar na fase 3 | em análise e sem conflito → aprovadas automaticamente; com conflito continuam em análise ✔ |
| F3-2 | Nova inscrição sem conflito | aprovada na hora; dados do SUAP liberados ✔ |
| F3-3 | Nova inscrição com conflito | bloqueada com explicação; duas inscrições simultâneas na mesma sala: só uma passa (travar por sala) |
| S-1 | Copiar campos do SUAP / salvar link inválido | cópia por campo; link fora de `suap.ifsp.edu.br/eventos/` recusado ✔ |
| S-2 | Visibilidade "pendente de link" (nunca / fase 1 / 2 / 3) | respeita a configuração ✔ |
| P-1 | Papéis | cada nível acessa só o permitido (`permissoes.md`); coordenação geral não vê configurações de desenvolvimento ✔ |
| P-2 | Login | senha vazia recusada; 5 falhas → bloqueio temporário; sessão expira |
| E-1 | Exportações | CSV do SUAP abre no Excel com acentos; HTML do Joomla cola em abas por dia ✔ |
| E-2 | Nova edição | copia abas e parceiros; atividades começam vazias; edição anterior só leitura |
| A-1 | Acessibilidade e celular | navegação por teclado, contraste, leitor de tela (WCAG 2.1 AA), telas de 390 px sem rolagem lateral ✔ (parcial) |
| D-1 | Desempenho e backup | páginas públicas < 3 s; backup diário restaurável |
