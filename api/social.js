// UrbanaTV — /api/social (retirado)
// Las cuentas, el muro, los comentarios y las notificaciones ya no usan
// servidor: cada visitante guarda su nombre, sus estados y sus comentarios
// en su propio navegador (localStorage). Este endpoint solo existe para
// explicar el cambio a clientes viejos. Sin base de datos, sin Neon.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'cuentas_en_dispositivo',
    message: 'UrbanaTV ya no tiene cuentas en servidor. Tu nombre, tus estados y tus comentarios se guardan solo en este navegador.',
  });
}
