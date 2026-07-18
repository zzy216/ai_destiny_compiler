import { AdminManagementController } from '../src/admin/admin-management.controller';

describe('AdminManagementController', () => {
  it('routes list and publish actions to the management service', async () => {
    const service = {
      listCoachConfigs: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      publishKnowledgeCard: jest.fn().mockResolvedValue({ id: 'card-1', status: 'published' }),
    };
    const controller = new AdminManagementController(service as never);

    await expect(controller.listCoachConfigs({ page: 1, perPage: 20 })).resolves.toEqual({ data: [], meta: {} });
    await expect(controller.publishKnowledgeCard('card-1')).resolves.toEqual({ data: { id: 'card-1', status: 'published' } });
    expect(service.listCoachConfigs).toHaveBeenCalledWith({ page: 1, perPage: 20 });
    expect(service.publishKnowledgeCard).toHaveBeenCalledWith('card-1', expect.any(String));
  });
});
