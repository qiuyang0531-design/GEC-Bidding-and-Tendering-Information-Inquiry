import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
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
  }
];

export default routes;
