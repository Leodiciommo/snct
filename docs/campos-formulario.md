# Campos: planilha → formulário → API/banco → SUAP

Obrigatório = bloqueia o envio. A coluna "API" usa os nomes JSON de `POST /snct/api/AAAA/atividades`.

| Formulário | Obrig. | Regra / condicional | API (JSON) | Banco (`atividades`) | Campo SUAP |
|---|---|---|---|---|---|
| Área do campus | Sim | Uma de: Informática, Gestão, Construção Civil, Meio Ambiente, Licenciaturas, Núcleo Comum, Outros (lista editável) | `area` | `area` | Área |
| Classificação CNPq | Não | Grande área CNPq; só classifica, independe da área do campus | `cnpq` | `cnpq` | — |
| Título | Sim | 5–120 caracteres; o prefixo `[SNCT CAR AAAA]` é acrescentado automaticamente | `titulo` | `titulo` | Nome |
| Resumo/descrição | Sim | mínimo 10 caracteres (alerta de "texto genérico" abaixo de ~50) | `resumo` | `resumo` | Apresentação |
| Tipo de atividade | Sim | lista; fora da lista do SUAP vira "Outro" no SUAP | `tipo` | `tipo` | Natureza |
| Sala | Sim | sala ativa; verifica conflito | `salaId` | `sala_id` | Sala |
| Data início / fim | Sim | dentro do período da SNCT; fim ≥ início | `dataIni`, `dataFim` | `data_ini`, `data_fim` | Data de Início/Fim; Fim das Inscrições = data de início |e
| Hora início / fim | Sim | múltiplos de 30 min; fim > início | `horaIni`, `horaFim` | `hora_ini`, `hora_fim` | Hora de Início/Fim |
| Uso contínuo da sala | Condicional | só aparece se data fim > data início; marcado = sala reservada em todos os horários entre início e fim; desmarcado = só no horário, todos os dias | `usoContinuo` | `uso_continuo` | — |
| Carga horária | Automático | soma dos blocos; formato H:MM | — | (calculada) | Carga Horária |
| Coordenador | Sim | exatamente 1: "eu mesmo", outro usuário (deve ser servidor) ou manual (aviso: confirmar cadastro no SUAP) | `pessoas.coordenador[]` | `atividade_pessoas` (papel `coordenador`) | Coordenador |
| Organizadores | Não | 0..n pessoas (mesmas 3 formas); se vazio, o SUAP recebe o coordenador | `pessoas.organizadores[]` | `atividade_pessoas` (`organizador`) | Organizadores |
| Palestrante(s) | Não | 0..n; se houver, aparecem "Diária?" e "Veículo oficial?" e o SUAP recebe tipo de participação "Palestrante + Participante" | `pessoas.palestrantes[]` | `atividade_pessoas` (`palestrante`) | Tipo de Participação |
| Diária / Veículo oficial | Condicional | só com palestrante | `diaria`, `veiculoOficial` | `diaria`, `veiculo_oficial` | — (uso interno) |
| Público-alvo | Sim | ≥1 da lista | `publicos[]` | `atividade_publicos` | Público Alvo |
| Vagas | Sim | > 0 | `vagas` | `vagas` | Limite de Inscrições / Participantes |
| Inscrição online | Não | Sim/Não | `inscOnline` | `insc_online` | Inscrição Online |
| Gera certificado | Não | padrão Sim | `certificado` | `certificado` | Gera Certificado? |
| Recursos | Não | lista (computador, som, microfone, projetor, webcam) | `recursos[]` | `atividade_recursos` | Recursos Envolvidos = "Não preencher" |
| Software específico | Não | texto (com link de download) | `software` | `software` | — |
| Comunicação online | Não | Sim/Não | `comunicacaoOnline` | `comunicacao_online` | — |
| Observações | Não | texto | `observacoes` | `observacoes` | — |
| Link do evento no SUAP | Após aprovação | só `https://suap.ifsp.edu.br/eventos/...` | `PUT /atividades/:id/link-suap` | `link_suap` | Link |

Valores fixos no SUAP: Dimensões "Local - campus"; Local "Campus Caraguatatuba"; Campus "CAR"; Setor "Não preencher"; Classificação "Regional"; Tipo "Científico/tecnológico"; Eventos Similares e Modelo de Certificado "Não preencher"; Início das Inscrições = parâmetro da edição (`insc_suap_ini`). Implementação: `src/suap.js` (31 campos).
