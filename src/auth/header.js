// SSO no proxy (Apache/Nginx + SSSD/Kerberos...). Só confia no cabeçalho vindo do proxy configurado.
export default env => ({
  fromRequest(req) {
    if (req.socket.remoteAddress.replace('::ffff:', '') !== (env.AUTH_TRUSTED_PROXY || '127.0.0.1')) return null;
    const p = req.get(env.AUTH_HEADER_USER || 'X-Remote-User');
    return p ? { prontuario: p.toUpperCase(), nome: req.get('X-Remote-Name') || p, email: req.get('X-Remote-Mail') || '', vinculo: 'servidor' } : null;
  },
  async authenticate() { return null; }, async lookup() { return null; }, async search() { return []; },
});
