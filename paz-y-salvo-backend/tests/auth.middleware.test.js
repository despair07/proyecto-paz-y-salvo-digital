process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';

const jwt = require('jsonwebtoken');
const authMiddleware = require('../src/middlewares/auth.middleware');

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    issuer: 'paz-y-salvo-digital',
    audience: 'paz-y-salvo-web',
    expiresIn: '5m',
  });
}

describe('authMiddleware', () => {
  it('rejects requests with missing Authorization header', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with malformed or invalid JWT', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.value' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('allows institutional users and decorates req.user with decoded identity', () => {
    const token = makeToken({
      id: '00000000-0000-4000-8000-000000000001',
      correo_institucional: 'laura.ortiz@uniautonoma.edu.co',
      roles: ['Docente'],
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.correo_institucional).toBe('laura.ortiz@uniautonoma.edu.co');
    expect(req.user.roles).toContain('Docente');
  });
});
