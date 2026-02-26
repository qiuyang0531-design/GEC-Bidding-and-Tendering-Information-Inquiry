import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Leaf } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'username' | 'email'>('email');
  const { signInWithUsername, signInWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (loginType === 'username') {
        // 用户名登录
        if (!username.trim() || !password) {
          setError('请输入用户名和密码');
          setLoading(false);
          return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          setError('用户名只能包含字母、数字和下划线');
          setLoading(false);
          return;
        }

        const { error: signInError } = await signInWithUsername(username, password);

        if (signInError) {
          setError('登录失败，请检查用户名和密码');
        } else {
          navigate('/');
        }
      } else {
        // 邮箱登录
        if (!email.trim() || !password) {
          setError('请输入邮箱和密码');
          setLoading(false);
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          setError('请输入有效的邮箱地址');
          setLoading(false);
          return;
        }

        const { error: signInError } = await signInWithEmail(email, password);

        if (signInError) {
          setError('登录失败，请检查邮箱和密码');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
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
          <CardTitle className="text-2xl font-bold">绿色电力证书查询</CardTitle>
          <CardDescription>登录您的账户以继续</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {/* 登录方式切换 */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setLoginType('email')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  loginType === 'email'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                邮箱登录
              </button>
              <button
                type="button"
                onClick={() => setLoginType('username')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  loginType === 'username'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                用户名登录
              </button>
            </div>

            {loginType === 'email' ? (
              /* 邮箱登录表单 */
              <>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              /* 用户名登录表单 */
              <>
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
                  <p className="text-xs text-muted-foreground">旧版用户请使用用户名登录</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
            <div className="flex justify-between text-sm">
              <Link
                to="/forgot-password"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                忘记密码？
              </Link>
              <span className="text-muted-foreground">还没有账户？</span>
              <Link
                to="/register"
                className="text-primary hover:underline"
              >
                立即注册
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
