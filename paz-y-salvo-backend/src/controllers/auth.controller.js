const authService = require('../services/auth.service');
const { loginDto } = require('../dtos/auth.dto');
const HttpError = require('../utils/httpError');

class AuthController {
  async login(req, res, next) {
    try {
      const parsedBody = loginDto.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({
          error: true,
          codigo: 400,
          mensaje: parsedBody.error.issues.map((issue) => issue.message).join(', '),
          detalles: parsedBody.error.issues,
        });
      }

      const { googleToken, correo, email, password } = parsedBody.data;
      const targetEmail = email || correo;

      const result = await authService.login({
        googleToken,
        email: targetEmail,
        password,
      });

      return res.status(200).json({
        ok: true,
        token: result.token,
        usuario: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user);
      return res.status(200).json({
        ok: true,
        usuario: profile,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
