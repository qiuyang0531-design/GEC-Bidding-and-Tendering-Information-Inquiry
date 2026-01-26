import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Loader2, Leaf } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import UrlManager from '@/components/UrlManager';
import TransactionTable from '@/components/TransactionTable';
import { getUserUrls, scrapeUrlData } from '@/db/api';

export default function HomePage() {
  const { user, profile } = useAuth();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const adminBadge: any = profile?.role === 'admin' ? (
    <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
      管理员
    </span>
  ) : null;

  // 执行查询
  const handleQuery = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 获取用户的所有URLs
      const urls = await getUserUrls(user.id);

      if (urls.length === 0) {
        setError('请先添加至少一个网址');
        setLoading(false);
        return;
      }

      // 对每个URL执行抓取
      let successCount = 0;
      let failCount = 0;

      for (const url of urls) {
        try {
          await scrapeUrlData(url.id, url.url);
          successCount++;
        } catch (err) {
          console.error(`抓取 ${url.url} 失败:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`成功查询 ${successCount} 个网址的数据`);
        setRefreshTrigger(prev => prev + 1);
      }

      if (failCount > 0) {
        setError(`${failCount} 个网址查询失败，请检查网址是否正确`);
      }
    } catch (err) {
      console.error('查询失败:', err);
      setError('查询失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* 头部 */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">绿色电力证书交易查询</h1>
                <p className="text-sm text-muted-foreground">
                  欢迎，{profile?.username || user?.email}
                  {adminBadge}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 xl:grid-cols-3">
          {/* 左侧：网址管理 */}
          <div className="xl:col-span-1">
            <UrlManager onUrlsChange={() => setRefreshTrigger(prev => prev + 1)} />
          </div>

          {/* 右侧：查询和数据展示 */}
          <div className="xl:col-span-2 space-y-6">
            {/* 查询控制面板 */}
            <Card>
              <CardHeader>
                <CardTitle>数据查询</CardTitle>
                <CardDescription>选择日期范围并执行查询</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-primary bg-primary/5">
                    <AlertDescription className="text-primary">{success}</AlertDescription>
                  </Alert>
                )}

                {/* 日期选择 */}
                <div className="grid gap-4 @md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">开始日期</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !startDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP', { locale: zhCN }) : '选择日期'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">结束日期</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !endDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP', { locale: zhCN }) : '选择日期'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* 查询按钮 */}
                <Button onClick={handleQuery} disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      查询中...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      执行查询
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* 交易数据表格 */}
            <TransactionTable
              startDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
              endDate={endDate ? format(endDate, 'yyyy-MM-dd') : undefined}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
