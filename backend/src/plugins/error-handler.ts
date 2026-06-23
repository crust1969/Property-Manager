import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface AppError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, string>[];
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const logger = request.log;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const response: AppError = {
      statusCode: 400,
      error: 'Validation Error',
      message: 'Validierungsfehler bei der Eingabe',
      details,
    };

    return reply.status(400).send(response);
  }

  // Handle Fastify errors (includes validation errors from schema)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const response: AppError = {
      statusCode: error.statusCode,
      error: error.name ?? 'Error',
      message: error.message,
    };

    if (error.statusCode >= 500) {
      logger.error(error);
    }

    return reply.status(error.statusCode).send(response);
  }

  // Unknown errors
  logger.error(error);

  const response: AppError = {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Ein unerwarteter Fehler ist aufgetreten',
  };

  return reply.status(500).send(response);
}
