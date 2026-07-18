import { useState } from 'react';
import { Button, Card, Input, Modal, Space, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type CoachConfig, type CoachConfigInput } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { StatusTag } from '../../components/StatusTag';

export function CoachConfigPage() {
  const [editing, setEditing] = useState<CoachConfig | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'coach-configs'], queryFn: () => apiClient.listCoachConfigs() });
  const publish = useMutation({ mutationFn: apiClient.publishCoachConfig, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'coach-configs'] }); message.success('教练配置已发布'); } });
  const save = useMutation({ mutationFn: ({ id, config }: { id: string | null; config: CoachConfigInput | Partial<CoachConfigInput> }) => id ? apiClient.updateCoachConfig(id, config) : apiClient.createCoachConfig(config as CoachConfigInput), onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin', 'coach-configs'] }); setEditing(null); message.success(variables.id ? '教练配置已保存' : '教练配置草稿已创建'); } });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const configs = query.data?.data ?? [];
  return <div className="page-stack">
    <div className="page-heading"><div><h2>教练配置</h2><p>管理角色、目标、系统提示词和输出约束。发布版本后旧 Agent Run 仍保留原快照。</p></div><Button type="primary" onClick={() => setEditing({ id: '', version: 0, name: '', status: 'draft', productGoal: '' })}>新建草稿</Button></div>
    <Card>{configs.length === 0 ? <EmptyState description="还没有教练配置" /> : <Table rowKey="id" dataSource={configs} pagination={false} columns={[
      { title: '版本', dataIndex: 'version', render: (value: number) => `v${value}` },
      { title: '名称', dataIndex: 'name' },
      { title: '目标', dataIndex: 'productGoal' },
      { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag status={value} /> },
      { title: '操作', render: (_: unknown, record: CoachConfig) => <Space><Button size="small" onClick={() => setEditing(record)}>编辑</Button>{record.status === 'draft' && <Button size="small" type="primary" onClick={() => void publish.mutateAsync(record.id)}>发布</Button>}</Space> },
    ]} />}</Card>
    <Modal title={editing?.id ? '编辑教练配置' : '新建教练配置'} open={Boolean(editing)} onCancel={() => setEditing(null)} footer={null}>
      <div className="form-stack"><label>名称<Input value={editing?.name} onChange={(event) => setEditing((current) => current && { ...current, name: event.target.value })} /></label><label>产品目标<Input.TextArea value={editing?.productGoal} onChange={(event) => setEditing((current) => current && { ...current, productGoal: event.target.value })} /></label><Button type="primary" loading={save.isPending} onClick={() => { if (!editing) return; if (!editing.name.trim() || !editing.productGoal.trim()) { message.error('名称和产品目标不能为空'); return; } const config = { name: editing.name, productGoal: editing.productGoal, roleDefinition: editing.roleDefinition ?? '', systemPrompt: editing.systemPrompt ?? '', conversationRules: editing.conversationRules ?? {}, actionRules: editing.actionRules ?? {}, prohibitedContent: editing.prohibitedContent ?? {}, safetyRules: editing.safetyRules ?? {}, outputSchema: editing.outputSchema ?? {}, defaultModelConfigId: editing.defaultModelConfigId ?? null }; save.mutate({ id: editing.id || null, config }); }}>保存草稿</Button></div>
    </Modal>
  </div>;
}
