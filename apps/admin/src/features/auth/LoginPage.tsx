import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';

import { useAuth } from '../../app/AuthProvider';

export function LoginPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: { identifier: string; password: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(values);
    } catch (candidate) {
      setError(candidate instanceof Error ? candidate.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand"><span className="brand-orb">命</span><span>命运编译器</span></div>
        <Typography.Title level={2}>管理员登录</Typography.Title>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item label="账号" name="identifier" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoComplete="username" maxLength={254} />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" maxLength={128} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>登录</Button>
        </Form>
      </section>
    </main>
  );
}
