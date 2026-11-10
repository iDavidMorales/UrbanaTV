// UrbanaTV — /api/auth-email (retirado)
// El acceso por código de correo ya no existe: UrbanaTV ya no tiene
// cuentas en servidor y no usa base de datos (sin Neon). Cada visitante
// elige su nombre en su propio navegador. Este endpoint solo existe para
// explicar el cambio a clientes viejos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'acceso_en_dispositivo',
    message: 'Ya no se entra con código de correo. Elige tu nombre en la página y se guarda solo en este navegador.',
  });
}
