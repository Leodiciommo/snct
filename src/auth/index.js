// Adaptador de autenticação: o método é escolhido por AUTH_PROVIDER (ldap | header | dev).
// Interface: authenticate(prontuario, senha) -> {prontuario,nome,email,vinculo} | null
//            lookup(prontuario) -> idem | null          search(texto) -> [{prontuario,nome}]
const PERMITIDOS = ['ldap', 'header', 'dev'];
export async function makeProvider(env = process.env) {
  const k = env.AUTH_PROVIDER || 'ldap';
  if (!PERMITIDOS.includes(k)) throw new Error(`AUTH_PROVIDER inválido: ${k}`);
  if (k === 'dev' && env.NODE_ENV === 'production') throw new Error('AUTH_PROVIDER=dev é proibido em produção');
  return (await import(`./${k}.js`)).default(env);
}
