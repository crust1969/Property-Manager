import Fastify from 'fastify';
import { corsPlugin } from './plugins/cors.js';
import { jwtPlugin } from './plugins/jwt.js';
import { databasePluginRegistration } from './plugins/database.js';
import { errorHandler } from './plugins/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoryRoutes } from './modules/category/category.routes.js';
import { classificationRoutes } from './modules/category/classification.routes.js';
import { propertyRoutes } from './modules/property/property.routes.js';
import { acquisitionRoutes } from './modules/property/acquisition.routes.js';
import { leaseRoutes } from './modules/lease/lease.routes.js';
import { tenantRoutes } from './modules/tenant/tenant.routes.js';
import { incomeRoutes } from './modules/income/income.routes.js';
import { expenseRoutes } from './modules/expense/expense.routes.js';
import { depositRoutes } from './modules/deposit/deposit.routes.js';
import { documentRoutes } from './modules/document/document.routes.js';
import { loanRoutes } from './modules/loan/loan.routes.js';
import { depreciationRoutes } from './modules/depreciation/depreciation.routes.js';
import { reminderRoutes } from './modules/reminder/reminder.routes.js';
import { cashflowRoutes } from './modules/cashflow/cashflow.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { utilityBillingRoutes } from './modules/utility-billing/utility-billing.routes.js';
import { reportRoutes } from './modules/report/report.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Register plugins
  await app.register(databasePluginRegistration);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);

  // Set custom error handler
  app.setErrorHandler(errorHandler);

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register module routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(propertyRoutes, { prefix: '/api/v1/properties' });
  await app.register(acquisitionRoutes, { prefix: '/api/v1/properties' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(classificationRoutes, { prefix: '/api/v1' });
  await app.register(leaseRoutes, { prefix: '/api/v1/leases' });
  await app.register(tenantRoutes, { prefix: '/api/v1/tenants' });
  await app.register(incomeRoutes, { prefix: '/api/v1/income' });
  await app.register(expenseRoutes, { prefix: '/api/v1/expenses' });
  await app.register(depositRoutes, { prefix: '/api/v1/deposits' });
  await app.register(documentRoutes, { prefix: '/api/v1/documents' });
  await app.register(loanRoutes, { prefix: '/api/v1/loans' });
  await app.register(depreciationRoutes, { prefix: '/api/v1/depreciation' });
  await app.register(reminderRoutes, { prefix: '/api/v1/reminders' });
  await app.register(cashflowRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(utilityBillingRoutes, { prefix: '/api/v1/utility-billing' });
  await app.register(reportRoutes, { prefix: '/api/v1/reports' });
  await app.register(settingsRoutes, { prefix: '/api/v1/settings' });

  return app;
}
