import type { FastifyInstance } from 'fastify';
import { CategoryService } from './category.service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoriesQuerySchema,
} from './category.validators.js';

export async function categoryRoutes(app: FastifyInstance) {
  const categoryService = new CategoryService(app);

  // All category routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/v1/categories?propertyId=
  app.get('/', async (request, reply) => {
    const query = getCategoriesQuerySchema.parse(request.query);
    const userId = request.user.userId;

    const categories = categoryService.listByProperty(query.propertyId, userId);
    return reply.status(200).send(categories);
  });

  // POST /api/v1/categories
  app.post('/', async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const userId = request.user.userId;

    const category = categoryService.create(body, userId);
    return reply.status(201).send(category);
  });

  // PUT /api/v1/categories/:id
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCategorySchema.parse(request.body);
    const userId = request.user.userId;

    const category = categoryService.update(id, body, userId);
    return reply.status(200).send(category);
  });

  // POST /api/v1/categories/:id/deactivate
  app.post('/:id/deactivate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    categoryService.deactivate(id, userId);
    return reply.status(200).send({ message: 'Kategorie deaktiviert' });
  });
}
