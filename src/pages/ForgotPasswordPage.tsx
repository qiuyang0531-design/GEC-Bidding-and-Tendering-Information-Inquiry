import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证输入
      if (!email.trim()) {
        setError('请输入邮箱地址');
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

      const { error: resetError } = await resetPassword(email);

      if (resetError) {
        setError('发送重置邮件失败，请检查邮箱地址是否正确');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('发送重置邮件失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/login" className="hover:opacity-70">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold">重置密码</CardTitle>
          <CardDescription>
            {success
              ? '重置邮件已发送到您的邮箱'
              : '输入您的邮箱地址，我们将发送重置密码的邮件'}
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
                <Label htmlFor="email">邮箱地址</Label>
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
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '发送中...' : '发送重置邮件'}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                我们已向 <strong>{email}</strong> 发送了重置密码的邮件。
                请查收邮件并按照提示重置密码。
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground text-center">
              没有收到邮件？请检查垃圾邮件文件夹，或{' '}
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  handleSubmit(new Event('submit') as any);
                }}
                className="text-primary hover:underline"
              >
                重新发送
              </button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              返回登录
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
