import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';

export default function UpdateLinksPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [updatedCount, setUpdatedCount] = useState(0);

  const updateDetailLinks = async () => {
    if (!user) return;

    setLoading(true);
    setMessage('');
    setUpdatedCount(0);

    try {
      // 1. 获取所有URLs
      const { data: urls, error: urlsError } = await supabase
        .from('urls')
        .select('id, url')
        .eq('user_id', user.id);

      if (urlsError) throw urlsError;

      const urlMap = {};
      urls.forEach(u => urlMap[u.id] = u.url);

      // 2. 获取所有没有detail_link的交易
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id, url_id')
        .eq('user_id', user.id)
        .is('detail_link', null);

      if (transError) throw transError;

      if (transactions.length === 0) {
        setMessage('没有需要更新的数据');
        setLoading(false);
        return;
      }

      // 3. 批量更新
      let count = 0;
      for (const trans of transactions) {
        const url = urlMap[trans.url_id];
        if (!url) continue;

        const { error: updateError } = await supabase
          .from('transactions')
          .update({ detail_link: url })
          .eq('id', trans.id);

        if (updateError) {
          console.error(`更新交易 ${trans.id} 失败:`, updateError);
        } else {
          count++;
        }
      }

      setUpdatedCount(count);
      setMessage(`✅ 成功更新 ${count} 条交易数据的详情链接`);
    } catch (error) {
      console.error('更新失败:', error);
      setMessage('❌ 更新失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>更新详情链接</CardTitle>
            <CardDescription>
              将已抓取的交易数据的详情链接字段更新为对应的URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <Alert className={message.startsWith('✅') ? 'border-green-500' : 'border-destructive'}>
                <AlertDescription className="flex items-center gap-2">
                  {message.startsWith('✅') && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {message}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                此操作会将所有没有详情链接的交易数据，更新为其来源网址的URL。
              </p>

              <Button
                onClick={updateDetailLinks}
                disabled={loading || !user}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '开始更新'
                )}
              </Button>

              {updatedCount > 0 && (
                <div className="text-center">
                  <a href="/" className="text-blue-600 hover:underline">
                    返回首页查看结果 →
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
