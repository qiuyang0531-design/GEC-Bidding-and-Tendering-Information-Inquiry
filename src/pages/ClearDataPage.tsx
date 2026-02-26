import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function ClearDataPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const clearTransactions = async () => {
    if (!user) return;

    if (!confirm('确定要删除所有交易数据吗？此操作不可恢复！')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 先统计数量
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;

      // 删除当前用户的所有交易数据
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setMessage(`✅ 成功删除 ${count || 0} 条交易数据`);

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('删除失败:', error);
      setMessage(`❌ 删除失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              清理交易数据
            </CardTitle>
            <CardDescription>
              删除所有已抓取的交易数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                ⚠️ 此操作将<strong>永久删除</strong>所有交易数据，不可恢复！
                <br />
                删除后需要重新执行"批量抓取"来获取数据。
              </AlertDescription>
            </Alert>

            {message && (
              <Alert className={message.startsWith('✅') ? 'border-green-500' : 'border-destructive'}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button
                onClick={clearTransactions}
                disabled={loading}
                variant="destructive"
                size="lg"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '删除所有交易数据'
                )}
              </Button>

              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="lg"
              >
                取消
              </Button>
            </div>

            <div className="text-center">
              <a href="/" className="text-sm text-muted-foreground hover:underline">
                返回首页 →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
