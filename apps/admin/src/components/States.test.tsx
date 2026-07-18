import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState, ErrorState, LoadingState } from './States';

describe('admin states', () => {
  it('renders loading and empty states', () => {
    const { rerender } = render(<LoadingState />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    rerender(<EmptyState description="没有模型" />);
    expect(screen.getByText('没有模型')).toBeInTheDocument();
  });

  it('renders an actionable error state', () => {
    const retry = () => undefined;
    render(<ErrorState error={new Error('API 不可用')} onRetry={retry} />);
    expect(screen.getByText('API 不可用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
