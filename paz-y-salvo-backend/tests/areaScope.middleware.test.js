jest.mock('../src/config/database', () => ({
  withUserContext: jest.fn(),
}));

jest.mock('../src/repositories/user.repository', () => ({
  listAssignedDependencyIds: jest.fn(),
}));

const database = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
const areaScopeMiddleware = require('../src/middlewares/areaScope.middleware');

describe('areaScopeMiddleware', () => {
  const user = { id: 'a3dc22d9-e887-4588-bcf7-4691522920d1' };
  const assignedId = '8a257f35-1765-4c3e-bb72-e5a9c53b312e';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches only dependency assignments obtained in user context', async () => {
    database.withUserContext.mockImplementation(async (currentUser, reason, operation) => (
      operation({ transaction: true })
    ));
    userRepository.listAssignedDependencyIds.mockResolvedValue([assignedId]);
    const req = { user };
    const next = jest.fn();

    await areaScopeMiddleware()(req, {}, next);

    expect(database.withUserContext).toHaveBeenCalledWith(
      user,
      'Consulta de asignaciones de dependencia',
      expect.any(Function)
    );
    expect(req.areaDependencias).toEqual([assignedId]);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an explicitly requested dependency outside the assignment', async () => {
    database.withUserContext.mockResolvedValue([assignedId]);
    const req = {
      user,
      body: { dependenciaId: '4d64ffda-a885-461a-885c-dddc42159f2e' },
    };
    const next = jest.fn();

    await areaScopeMiddleware({
      requestedDependencyId: (request) => request.body.dependenciaId,
    })(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      message: 'No tiene asignada la dependencia indicada',
    }));
  });

  it('rejects invalid dependency identifiers before querying assignments', async () => {
    const next = jest.fn();
    await areaScopeMiddleware({
      requestedDependencyId: () => 'not-a-uuid',
    })({ user }, {}, next);

    expect(database.withUserContext).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });
});
