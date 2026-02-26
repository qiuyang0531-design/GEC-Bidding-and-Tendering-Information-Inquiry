import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Leaf } from 'lucide-react';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUpWithUsername, signInWithUsername } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证输入
      if (!username.trim() || !email.trim() || !password || !confirmPassword) {
        setError('请填写所有字段');
        setLoading(false);
        return;
      }

      // 验证用户名格式（只允许字母、数字和下划线）
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('用户名只能包含字母、数字和下划线');
        setLoading(false);
        return;
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('请输入有效的邮箱地址');
        setLoading(false);
        return;
      }

      // 验证密码长度
      if (password.length < 6) {
        setError('密码长度至少为6位');
        setLoading(false);
        return;
      }

      // 验证密码匹配
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setLoading(false);
        return;
      }

      // 注册
      const { error: signUpError } = await signUpWithUsername(username, email, password);

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('该用户名或邮箱已被注册');
        } else {
          setError('注册失败：' + signUpError.message);
        }
        setLoading(false);
        return;
      }

      // 注册成功后自动登录
      const { error: signInError } = await signInWithUsername(email, password);

      if (signInError) {
        setError('注册成功，但自动登录失败，请使用邮箱登录');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('注册失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Leaf className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">创建账户</CardTitle>
          <CardDescription>注册以开始使用绿色电力证书查询系统</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">只能包含字母、数字和下划线</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入您的邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">用于接收确认邮件和重置密码</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '注册中...' : '注册'}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              已有账户？{' '}
              <Link to="/login" className="text-primary hover:underline">
                立即登录
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
