import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useQueries } from '@tanstack/react-query';

import { apiClient } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/States';

export function DashboardPage() {
  const results = useQueries({ queries: [
    { queryKey: ['admin', 'models'], queryFn: apiClient.listModels },
    { queryKey: ['admin', 'coach-configs'], queryFn: () => apiClient.listCoachConfigs() },
    { queryKey: ['admin', 'knowledge-cards'], queryFn: () => apiClient.listKnowledgeCards() },
    { queryKey: ['admin', 'agent-runs'], queryFn: () => apiClient.listAgentRuns() },
  ] });
  const loading = results.some((result) => result.isLoading);
  const error = results.find((result) => result.error)?.error as Error | undefined;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return <div className="page-stack">
    <div className="page-heading"><div><Typography.Title level={2}>运营总览</Typography.Title><Typography.Text type="secondary">查看当前管理资产和 Agent 执行情况</Typography.Text></div></div>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} xl={6}><Card><Statistic title="系统模型" value={results[0].data?.meta.total ?? 0} suffix="个" /></Card></Col>
      <Col xs={24} sm={12} xl={6}><Card><Statistic title="教练配置" value={results[1].data?.meta.total ?? 0} suffix="个版本" /></Card></Col>
      <Col xs={24} sm={12} xl={6}><Card><Statistic title="法典知识卡" value={results[2].data?.meta.total ?? 0} suffix="张" /></Card></Col>
      <Col xs={24} sm={12} xl={6}><Card><Statistic title="Agent Run" value={results[3].data?.meta.total ?? 0} suffix="次" /></Card></Col>
    </Row>
    <Card title="本阶段说明"><Typography.Paragraph>当前为开发期管理后台，认证和权限将在阶段 5 接入。模型凭据只允许写入，列表和详情仅展示脱敏状态。</Typography.Paragraph></Card>
  </div>;
}
