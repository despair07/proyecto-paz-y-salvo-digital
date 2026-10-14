const { z } = require('zod');

const loginDto = z.object({
  googleToken: z.string().min(1).max(8192).optional(),
  correo: z.string().email().max(254).optional(),
  email: z.string().email().max(254).optional(),
  password: z.string().min(1).max(256).optional(),
}).refine(
  (data) => Boolean(data.googleToken) || (Boolean(data.correo || data.email) && Boolean(data.password)),
  {
    message: 'Debes enviar googleToken o credenciales (correo/email y contraseña).',
    path: ['credenciales'],
  }
);

module.exports = {
  loginDto,
};
