import { AdminManagementController } from '../src/admin/admin-management.controller';
import { AuthController } from '../src/auth/auth.controller';
import { AuthenticatedUser } from '../src/auth/auth-context';
import { ConversationsController } from '../src/conversations/conversations.controller';
import {
  AdminModelsController,
  CustomModelsController,
  ModelsController,
} from '../src/models/models.controller';

const ADMIN: AuthenticatedUser = { id: '00000000-0000-4000-8000-000000000001', role: 'admin' };
const USER: AuthenticatedUser = { id: '00000000-0000-4000-8000-000000000002', role: 'user' };
const MODEL_ID = '6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';
const CONVERSATION_ID = '7cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';

describe('authenticated controller identity wiring', () => {
  it('routes auth requests to AuthService instead of the old contract placeholder', async () => {
    const service = {
      login: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
      changePassword: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new AuthController(service as never);

    await expect(controller.login({ identifier: 'user@example.com', password: 'correct-horse-battery-staple' })).resolves.toEqual({
      data: { accessToken: 'access', refreshToken: 'refresh' },
    });
    await expect(controller.changePassword({ currentPassword: 'correct-horse-battery-staple', newPassword: 'correct-horse-battery-staple-new' }, USER)).resolves.toEqual({
      data: { success: true },
    });
    expect(service.changePassword).toHaveBeenCalledWith(USER.id, {
      currentPassword: 'correct-horse-battery-staple',
      newPassword: 'correct-horse-battery-staple-new',
    });
  });

  it('passes the current user into model and conversation services', async () => {
    const modelService = {
      listAvailableModels: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      listCustomModels: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      createCustomModel: jest.fn().mockResolvedValue({ id: MODEL_ID }),
    };
    const models = new ModelsController(modelService as never);
    const customModels = new CustomModelsController(modelService as never);

    await models.list({ page: 1, perPage: 20 }, USER);
    await customModels.list({ page: 1, perPage: 20 }, USER);
    await customModels.create({ displayName: '我的模型', protocol: 'openai_compatible', baseUrl: 'https://api.example.com/v1', modelName: 'model' } as never, USER);

    expect(modelService.listAvailableModels).toHaveBeenCalledWith({ page: 1, perPage: 20 }, USER.id);
    expect(modelService.listCustomModels).toHaveBeenCalledWith({ page: 1, perPage: 20 }, USER.id);
    expect(modelService.createCustomModel).toHaveBeenCalledWith(expect.any(Object), USER.id);

    const conversationService = {
      createConversation: jest.fn().mockResolvedValue({ id: CONVERSATION_ID }),
      listConversations: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    const conversations = new ConversationsController(conversationService as never);
    await conversations.create({ modelConfigId: MODEL_ID }, USER);
    await conversations.list({ page: 1, perPage: 20 }, USER);

    expect(conversationService.createConversation).toHaveBeenCalledWith({ modelConfigId: MODEL_ID }, USER.id);
    expect(conversationService.listConversations).toHaveBeenCalledWith({ page: 1, perPage: 20 }, USER.id);
  });

  it('passes the current admin actor into admin services', async () => {
    const modelService = {
      createAdminModel: jest.fn().mockResolvedValue({ id: MODEL_ID }),
      setDefaultModel: jest.fn().mockResolvedValue({ id: MODEL_ID, isDefault: true }),
    };
    const adminModels = new AdminModelsController(modelService as never);

    await adminModels.create({ slug: 'primary', displayName: '主模型', modelType: 'api', protocol: 'openai_compatible', baseUrl: 'https://api.example.com/v1', modelName: 'model' } as never, ADMIN);
    await adminModels.setDefault(MODEL_ID, ADMIN);

    expect(modelService.createAdminModel).toHaveBeenCalledWith(expect.any(Object), ADMIN.id);
    expect(modelService.setDefaultModel).toHaveBeenCalledWith(MODEL_ID, ADMIN.id);

    const adminService = {
      createCoachConfig: jest.fn().mockResolvedValue({ id: 'coach-1' }),
      publishKnowledgeCard: jest.fn().mockResolvedValue({ id: 'card-1', status: 'published' }),
    };
    const admin = new AdminManagementController(adminService as never);

    await admin.createCoachConfig({ name: '教练' } as never, ADMIN);
    await admin.publishKnowledgeCard('card-1', ADMIN);

    expect(adminService.createCoachConfig).toHaveBeenCalledWith(expect.any(Object), ADMIN.id);
    expect(adminService.publishKnowledgeCard).toHaveBeenCalledWith('card-1', ADMIN.id);
  });
});
