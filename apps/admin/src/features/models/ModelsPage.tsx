import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from 'antd';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiClient, type CreateModelInput, type Model } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { StatusTag } from '../../components/StatusTag';

const modelSchema = z.object({
  slug: z.string().min(2, '请输入英文标识'),
  displayName: z.string().min(1, '请输入展示名称'),
  modelType: z.enum(['api', 'local']),
  protocol: z.string().min(1),
  baseUrl: z.string().url('请输入有效 URL'),
  modelName: z.string().min(1, '请输入模型标识'),
  provider: z.string().optional(),
  apiKey: z.string().optional(),
});

type ModelFormValues = z.infer<typeof modelSchema>;

export function ModelsPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'models'], queryFn: apiClient.listModels });
  const form = useForm<ModelFormValues>({ resolver: zodResolver(modelSchema), defaultValues: { modelType: 'api', protocol: 'openai_compatible' } });
  const saveMutation = useMutation({ mutationFn: ({ id, input }: { id: string | null; input: Partial<CreateModelInput> }) => id ? apiClient.updateModel(id, input) : apiClient.createModel(input as CreateModelInput), onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin', 'models'] }); setOpen(false); setEditingId(null); form.reset(); message.success(variables.id ? '模型草稿已更新' : '模型草稿已创建'); } });
  const action = useMutation({ mutationFn: async ({ id, kind }: { id: string; kind: 'publish' | 'disable' | 'default' | 'test' }) => kind === 'publish' ? apiClient.publishModel(id) : kind === 'disable' ? apiClient.disableModel(id) : kind === 'default' ? apiClient.setDefaultModel(id) : apiClient.testModel(id), onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin', 'models'] }); message.success(variables.kind === 'test' ? '连接测试已完成' : '模型状态已更新'); } });

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const models = query.data?.data ?? [];
  const openForm = (record?: Model) => { setEditingId(record?.id ?? null); form.reset({ slug: '', displayName: record?.displayName ?? '', modelType: record?.modelType ?? 'api', protocol: record?.protocol ?? 'openai_compatible', baseUrl: record?.currentVersion?.baseUrl ?? '', modelName: record?.currentVersion?.modelName ?? '', provider: '', apiKey: '' }); setOpen(true); };

  return <div className="page-stack">
    <div className="page-heading"><div><h2>模型设置</h2><p>维护系统模型、发布版本和连接状态；凭据只展示脱敏信息。</p></div><Button type="primary" onClick={() => openForm()}>新增模型</Button></div>
    <Card>{models.length === 0 ? <EmptyState description="还没有系统模型" /> : <Table rowKey="id" dataSource={models} pagination={false} columns={[
      { title: '模型', render: (_: unknown, record: Model) => <Space direction="vertical" size={0}><strong>{record.displayName}</strong><span className="muted">{record.protocol} · {record.modelType}</span></Space> },
      { title: '状态', render: (_: unknown, record: Model) => <Space><StatusTag status={record.status} />{record.isDefault && <span className="default-badge">默认</span>}</Space> },
      { title: '凭据', render: (_: unknown, record: Model) => record.hasCredential ? `已配置 ${record.secretHint ?? ''}` : '未配置' },
      { title: '操作', render: (_: unknown, record: Model) => <Space wrap><Button size="small" onClick={() => openForm(record)}>编辑</Button><Button size="small" onClick={() => void action.mutateAsync({ id: record.id, kind: 'test' })}>连接测试</Button>{record.status === 'draft' && <Button size="small" type="primary" onClick={() => void action.mutateAsync({ id: record.id, kind: 'publish' })}>发布</Button>}{record.status === 'published' && <Button size="small" onClick={() => void action.mutateAsync({ id: record.id, kind: 'disable' })}>停用</Button>}{record.status === 'published' && !record.isDefault && <Button size="small" onClick={() => void action.mutateAsync({ id: record.id, kind: 'default' })}>设为默认</Button>}</Space> },
    ]} />}</Card>
    <Modal title={editingId ? '编辑系统模型' : '新增系统模型'} open={open} onCancel={() => { setOpen(false); setEditingId(null); }} onOk={() => void form.handleSubmit((values) => saveMutation.mutate({ id: editingId, input: values }))()} confirmLoading={saveMutation.isPending}>
      <Form layout="vertical">
        <Form.Item label="英文标识"><Input {...form.register('slug')} /></Form.Item>
        <Form.Item label="展示名称"><Input {...form.register('displayName')} /></Form.Item>
        <Form.Item label="模型类型"><Select value={form.watch('modelType')} onChange={(value) => form.setValue('modelType', value)} options={[{ value: 'api', label: 'API' }, { value: 'local', label: '本地' }]} /></Form.Item>
        <Form.Item label="协议"><Input {...form.register('protocol')} /></Form.Item>
        <Form.Item label="Base URL"><Input {...form.register('baseUrl')} /></Form.Item>
        <Form.Item label="模型标识"><Input {...form.register('modelName')} /></Form.Item>
        <Form.Item label="API Key（只写入，不回显）"><Input.Password {...form.register('apiKey')} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
