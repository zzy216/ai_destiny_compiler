import { useState } from 'react';
import { Button, Card, Input, Modal, Space, Table, Tag, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type KnowledgeCard, type KnowledgeCardInput } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { StatusTag } from '../../components/StatusTag';

export function KnowledgeCardsPage() {
  const [editing, setEditing] = useState<KnowledgeCard | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'knowledge-cards'], queryFn: () => apiClient.listKnowledgeCards() });
  const publish = useMutation({ mutationFn: apiClient.publishKnowledgeCard, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-cards'] }); message.success('知识卡已发布'); } });
  const save = useMutation({ mutationFn: ({ id, card }: { id: string | null; card: KnowledgeCardInput | Partial<KnowledgeCardInput> }) => id ? apiClient.updateKnowledgeCard(id, card) : apiClient.createKnowledgeCard(card as KnowledgeCardInput), onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-cards'] }); setEditing(null); message.success(variables.id ? '知识卡已保存' : '知识卡草稿已创建'); } });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const cards = query.data?.data ?? [];
  return <div className="page-stack">
    <div className="page-heading"><div><h2>法典知识卡</h2><p>维护问题信号、诊断问题和候选行动，发布后参与新的 Agent 执行。</p></div><Button type="primary" onClick={() => setEditing({ id: '', cardKey: '', version: 0, name: '', category: '', tags: [], status: 'draft' })}>新建知识卡</Button></div>
    <Card>{cards.length === 0 ? <EmptyState description="还没有知识卡" /> : <Table rowKey="id" dataSource={cards} pagination={false} columns={[
      { title: '卡片', render: (_: unknown, record: KnowledgeCard) => <Space direction="vertical" size={0}><strong>{record.name}</strong><span className="muted">{record.cardKey} · v{record.version}</span></Space> },
      { title: '分类', dataIndex: 'category' },
      { title: '标签', dataIndex: 'tags', render: (tags: string[]) => <Space wrap>{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
      { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag status={value} /> },
      { title: '操作', render: (_: unknown, record: KnowledgeCard) => <Space><Button size="small" onClick={() => setEditing(record)}>编辑</Button>{record.status === 'draft' && <Button size="small" type="primary" onClick={() => void publish.mutateAsync(record.id)}>发布</Button>}</Space> },
    ]} />}</Card>
    <Modal title={editing?.id ? '编辑知识卡' : '新建知识卡'} open={Boolean(editing)} onCancel={() => setEditing(null)} footer={null}><div className="form-stack"><label>名称<Input value={editing?.name} onChange={(event) => setEditing((current) => current && { ...current, name: event.target.value })} /></label><label>分类<Input value={editing?.category} onChange={(event) => setEditing((current) => current && { ...current, category: event.target.value })} /></label><Button type="primary" loading={save.isPending} onClick={() => { if (!editing) return; if (!editing.name.trim() || !editing.category.trim()) { message.error('名称和分类不能为空'); return; } const card = { cardKey: editing.cardKey || `admin-${Date.now()}`, name: editing.name, category: editing.category, tags: editing.tags ?? [], problemSignals: editing.problemSignals ?? [], variables: {}, diagnosticQuestions: editing.diagnosticQuestions ?? [], candidateActions: editing.candidateActions ?? [], stopDoing: editing.stopDoing ?? [], reviewQuestions: editing.reviewQuestions ?? [] }; save.mutate({ id: editing.id || null, card }); }}>保存草稿</Button></div></Modal>
  </div>;
}
