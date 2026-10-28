// SOMENTE DESENVOLVIMENTO/TESTES (bloqueado em produção por auth/index.js). Senha de todos: "dev".
const U = [['CG00001', 'José Américo Alves Salvador Filho', 'servidor'], ['CG00002', 'Fulano de Tal', 'servidor'], ['CG00003', 'Ciclano de Tal', 'servidor'], ['CG00100', 'Aluno de Tal', 'aluno']]
  .map(([prontuario, nome, vinculo]) => ({ prontuario, nome, vinculo, email: `${prontuario.toLowerCase()}@exemplo.local` }));
export default () => ({
  async authenticate(p, s) { return s === 'dev' ? U.find(u => u.prontuario === String(p).toUpperCase()) || null : null; },
  async lookup(p) { return U.find(u => u.prontuario === String(p).toUpperCase()) || null; },
  async search(t) { t = String(t).toLowerCase(); return U.filter(u => u.nome.toLowerCase().includes(t) || u.prontuario.toLowerCase().startsWith(t)).map(({ prontuario, nome }) => ({ prontuario, nome })); },
});
