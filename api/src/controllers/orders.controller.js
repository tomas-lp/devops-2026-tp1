import { validateId, validateOrder, validateStatus } from '../validation.js';

export function createOrdersController(service) {
  return {
    list: async (req, res) => res.json({ data: await service.list() }),
    get: async (req, res) => res.json({ data: await service.get(validateId(req.params.id)) }),
    create: async (req, res) => {
      const order = await service.create(validateOrder(req.body));
      res.status(201).location(`/api/orders/${order.id}`).json({ data: order });
    },
    changeStatus: async (req, res) => res.json({
      data: await service.changeStatus(validateId(req.params.id), validateStatus(req.body)),
    }),
    remove: async (req, res) => res.json({ data: await service.remove(validateId(req.params.id)) }),
  };
}
