import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AdminApp } from './App';

describe('AdminApp', () => {
  it('renders the admin navigation and dashboard overview', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminApp />
      </MemoryRouter>,
    );

    expect(screen.getByText('命运编译器')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '模型设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '运营总览' })).toBeInTheDocument();
    expect(screen.getByText('开发模式')).toBeInTheDocument();
  });
});
