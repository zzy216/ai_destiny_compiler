import { Card, Select, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../api/client';
import { ErrorState, EmptyState, LoadingState } from '../../components/States';
import { StatusTag } from '../../components/StatusTag';

export function AgentRunsPage() {
  const query = useQuery({ queryKey: ['admin', 'agent-runs'], queryFn: () => apiClient.listAgentRuns() });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const runs = query.data?.data ?? [];
  return <div className="page-stack"><div className="page-heading"><div><h2>Agent Run</h2><p>查看执行状态、耗时和 Token 摘要，不默认展示完整结果或敏感 Prompt。</p></div><Select aria-label="状态筛选" placeholder="状态筛选" allowClear options={[{ value: 'succeeded', label: '成功' }, { value: 'failed', label: '失败' }, { value: 'running', label: '执行中' }]} /></div><Card>{runs.length === 0 ? <EmptyState description="还没有 Agent Run" /> : <Table rowKey="id" dataSource={runs} pagination={false} columns={[{ title: '时间', dataIndex: 'startedAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') }, { title: '模型', dataIndex: 'modelName' }, { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag status={value} /> }, { title: '耗时', dataIndex: 'durationMs', render: (value: number | null) => value == null ? '-' : `${value} ms` }, { title: 'Token', render: (_: unknown, record) => `${record.inputTokens ?? 0} / ${record.outputTokens ?? 0}` }]} />}</Card><Typography.Text type="secondary">管理后台默认只显示脱敏摘要；完整对话和 Prompt 查看需要后续权限与审计能力。</Typography.Text></div>;
}
