import { Layout, Menu, Tag, Typography } from 'antd';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const items = [
  { key: '/', label: '运营总览' },
  { key: '/models', label: '模型设置' },
  { key: '/coach-config', label: '教练配置' },
  { key: '/knowledge-cards', label: '法典知识卡' },
  { key: '/agent-runs', label: 'Agent Run' },
];

export function AdminLayout() {
  const location = useLocation();
  const selected = items.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ?? '/';

  return (
    <Layout className="admin-layout">
      <Layout.Sider breakpoint="lg" collapsedWidth="0" className="admin-sider">
        <div className="brand-mark"><span className="brand-orb">命</span><span>命运编译器</span></div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items.map((item) => ({ ...item, label: <NavLink to={item.key}>{item.label}</NavLink> }))} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <div><Typography.Title level={4}>管理后台</Typography.Title><Typography.Text type="secondary">模型、教练配置与知识资产</Typography.Text></div>
          <Tag color="gold">开发模式</Tag>
        </Layout.Header>
        <Layout.Content className="admin-content"><Outlet /></Layout.Content>
      </Layout>
    </Layout>
  );
}
