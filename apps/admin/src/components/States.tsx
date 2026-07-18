import { Alert, Empty, Spin } from 'antd';

export function LoadingState() {
  return <div className="state-center"><Spin size="large" /></div>;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return <Alert type="error" showIcon message="加载失败" description={error.message} action={onRetry ? <button className="link-button" onClick={onRetry}>重试</button> : undefined} />;
}

export function EmptyState({ description = '暂无数据' }: { description?: string }) {
  return <Empty description={description} />;
}
