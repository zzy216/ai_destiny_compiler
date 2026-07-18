import { Tag } from 'antd';

const labels: Record<string, string> = {
  draft: '草稿', published: '已发布', disabled: '已停用', deleted: '已删除',
  running: '执行中', succeeded: '成功', failed: '失败', timeout: '超时', cancelled: '已取消',
};

export function StatusTag({ status }: { status: string }) {
  const color = status === 'published' || status === 'succeeded' ? 'success' : status === 'failed' || status === 'timeout' ? 'error' : status === 'running' ? 'processing' : 'default';
  return <Tag color={color}>{labels[status] ?? status}</Tag>;
}
