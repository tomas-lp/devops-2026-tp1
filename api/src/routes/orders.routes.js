import { Router } from 'express';
import { createOrdersController } from '../controllers/orders.controller.js';

export function ordersRoutes(service) {
  const router = Router();
  const controller = createOrdersController(service);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.patch('/:id/status', controller.changeStatus);
  router.delete('/:id', controller.remove);
  return router;
}
