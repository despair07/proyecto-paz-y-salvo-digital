const { z } = require('zod');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = z.string().uuid('El identificador de dependencia no es válido');

const requestCreateDto = z.object({
  tipoNovedad: z.enum(['RETIRO', 'CAMBIO_DEPENDENCIA']),
  fechaRetiro: z.string()
    .regex(ISO_DATE, 'fechaRetiro debe usar el formato YYYY-MM-DD')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    }, 'fechaRetiro no es una fecha válida')
    .nullable()
    .optional(),
  cargoDesempenado: z.string().trim().min(1).max(150),
  lugarExpedicionDocumento: z.string().trim().min(1).max(100),
}).strict();

const areaVerdictDto = z.object({
  dependenciaId: UUID,
  estado: z.literal('PAZ_Y_SALVO'),
  motivo: z.string().trim().min(1, 'El motivo es obligatorio').max(2000),
}).strict();

const areaQueueQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(['PENDIENTE', 'PAZ_Y_SALVO', 'BLOQUEADO']).optional(),
  q: z.string().trim().max(128).optional(),
}).strict();

module.exports = {
  requestCreateDto,
  areaVerdictDto,
  areaQueueQueryDto,
};
