# Autenticação

O portal usa o **mesmo mecanismo de acesso dos demais sistemas da CTI** (Moodle/ECAD, OCS, Indico): o login é o prontuário e a senha continua sendo a do controlador de acessos. O portal não guarda nem copia senhas.

## Ponto único de adaptação
Todo o acesso ao controlador está em `src/auth/` e a CTI aplica ali o mesmo método já usado nos outros sistemas. O restante do portal só depende deste contrato:

```
authenticate(prontuario, senha) -> { prontuario, nome, email, vinculo: 'servidor'|'aluno'|'externo' } | null
lookup(prontuario)              -> idem | null          (usado em "indicar outro usuário")
search(texto)                   -> [{ prontuario, nome }] (busca de pessoas nos campos coordenador/organizador/palestrante)
```
Escolha pelo `.env` (`AUTH_PROVIDER`): `ldap` e `header` (SSO no proxy) já têm implementação de referência; `dev` serve só para testes e é bloqueado em produção. Se o método usado pela CTI for outro, basta criar `src/auth/<nome>.js` com esse contrato.

## O que o portal faz com o resultado
Cria/atualiza o usuário na tabela `usuarios` (prontuário, nome, e-mail, vínculo), abre sessão (cookie `HttpOnly`, `Secure`, `SameSite=Lax`, 2 h), limita tentativas de login e registra login/falhas na auditoria (sem senha). Papéis (comissão, coordenação geral, administrador) ficam no portal; coordenador de atividade é qualquer **servidor**. Ver `permissoes.md`.
