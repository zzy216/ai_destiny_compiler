import { AdminManagementController } from '../src/admin/admin-management.controller';

const ADMIN = { id: '00000000-0000-4000-8000-000000000001', role: 'admin' as const };

describe('AdminManagementController', () => {
  it('routes list and publish actions to the management service', async () => {
    const service = {
      listCoachConfigs: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      publishKnowledgeCard: jest.fn().mockResolvedValue({ id: 'card-1', status: 'published' }),
    };
    const controller = new AdminManagementController(service as never);

    await expect(controller.listCoachConfigs({ page: 1, perPage: 20 })).resolves.toEqual({ data: [], meta: {} });
    await expect(controller.publishKnowledgeCard('card-1', ADMIN)).resolves.toEqual({ data: { id: 'card-1', status: 'published' } });
    expect(service.listCoachConfigs).toHaveBeenCalledWith({ page: 1, perPage: 20 });
    expect(service.publishKnowledgeCard).toHaveBeenCalledWith('card-1', ADMIN.id);
  });
});
