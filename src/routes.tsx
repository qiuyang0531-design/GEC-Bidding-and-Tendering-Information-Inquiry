import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotificationsPage from './pages/NotificationsPage';
import UpdateLinksPage from './pages/UpdateLinksPage';
import ClearDataPage from './pages/ClearDataPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />
  },
  {
    name: '通知',
    path: '/notifications',
    element: <NotificationsPage />
  },
  {
    name: '清理数据',
    path: '/clear-data',
    element: <ClearDataPage />,
    visible: false
  },
  {
    name: '更新链接',
    path: '/update-links',
    element: <UpdateLinksPage />,
    visible: false
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    visible: false
  },
  {
    name: '注册',
    path: '/register',
    element: <RegisterPage />,
    visible: false
  },
  {
    name: '忘记密码',
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    visible: false
  },
  {
    name: '重置密码',
    path: '/reset-password',
    element: <ResetPasswordPage />,
    visible: false
  }
];

export default routes;
