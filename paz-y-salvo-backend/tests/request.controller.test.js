jest.mock('../src/services/request.service', () => ({
  getMyStatus: jest.fn(),
  habilitarTramite: jest.fn(),
  getInforme: jest.fn(),
  saveInforme: jest.fn(),
  listPendingApproval: jest.fn(),
  approveOrReject: jest.fn(),
}));

const requestService = require('../src/services/request.service');
const requestController = require('../src/controllers/request.controller');

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('requestController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getMyStatus invoca requestService.getMyStatus y retorna 200', async () => {
    const req = { user: { id: 'user-1' } };
    const res = mockResponse();
    const next = jest.fn();

    requestService.getMyStatus.mockResolvedValue({ estadoGlobal: 'AL_DIA' });

    await requestController.getMyStatus(req, res, next);

    expect(requestService.getMyStatus).toHaveBeenCalledWith(req.user);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: { estadoGlobal: 'AL_DIA' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('habilitarTramite responde 201 con la solicitud creada', async () => {
    const req = {
      user: { id: 'user-1' },
      body: { cargo: 'Docente', novedad: 'Retiro' },
    };
    const res = mockResponse();
    const next = jest.fn();

    requestService.habilitarTramite.mockResolvedValue({
      ok: true,
      solicitud: { id: 'sol-1' },
    });

    await requestController.habilitarTramite(req, res, next);

    expect(requestService.habilitarTramite).toHaveBeenCalledWith(req.user, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      solicitud: { id: 'sol-1' },
    });
  });

  it('approveOrReject invoca el servicio de aprobación', async () => {
    const req = {
      user: { id: 'aprobador-1', roles: ['Aprobador Comunidad Universitaria'] },
      params: { id: 'sol-1' },
      body: { decision: 'APROBADO', observacion: 'Conforme' },
    };
    const res = mockResponse();
    const next = jest.fn();

    requestService.approveOrReject.mockResolvedValue({
      ok: true,
      estado: 'APROBADO_FINAL',
    });

    await requestController.approveOrReject(req, res, next);

    expect(requestService.approveOrReject).toHaveBeenCalledWith(
      req.user,
      'sol-1',
      req.body
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      estado: 'APROBADO_FINAL',
    });
  });
});
