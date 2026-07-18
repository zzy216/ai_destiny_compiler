import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';

import { AdminApp } from './app/App';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

createRoot(document.getElementById('root')!).render(<StrictMode><ConfigProvider locale={zhCN}><QueryClientProvider client={queryClient}><BrowserRouter><AdminApp /></BrowserRouter></QueryClientProvider></ConfigProvider></StrictMode>);
