import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 检查是否从重置邮件链接进入
    const params = new URLSearchParams(location.search);
    if (!params.get('access_token') && !user) {
      setError('无效的重置链接，请重新申请重置密码');
    }
  }, [location.search, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证密码
      if (!password) {
        setError('请输入新密码');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('密码长度至少为6位');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setLoading(false);
        return;
      }

      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError('更新密码失败，请重试或重新申请重置链接');
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError('更新密码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:opacity-70"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          <CardTitle className="text-2xl font-bold">设置新密码</CardTitle>
          <CardDescription>
            {success
              ? '密码已成功更新'
              : '请输入您的新密码'}
          </CardDescription>
        </CardHeader>
        {!success ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">新密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入新密码（至少6位）"
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
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '更新密码'
                )}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                密码已成功更新！3秒后自动跳转到登录页面...
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              立即登录
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
