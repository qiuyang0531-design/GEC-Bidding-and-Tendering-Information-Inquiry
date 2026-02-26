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
import NotificationCenter from '@/components/NotificationCenter';
import DataSourceManager from '@/components/DataSourceManager';
import ScrapingHistory from '@/components/ScrapingHistory';
import { getUserUrls, scrapeUrlData, multiChannelScrape } from '@/db/api';
import { CSG_CHANNELS } from '@/lib/gec-channels';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  // 日期范围状态
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 记录每个网址的查询状态
  const [urlStatuses, setUrlStatuses] = useState<Record<string, { status: 'success' | 'error' | 'idle'; message?: string }>>({});

  // 多频道抓取状态
  const [multiChannelScraping, setMultiChannelScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{
    channelName: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [scrapeResults, setScrapeResults] = useState<{
    channels: number;
    links: number;
    success: number;
    failed: number;
    irrelevant: number;
  } | null>(null);

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
    setUrlStatuses({}); // 重置状态

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
      const newStatuses: Record<string, { status: 'success' | 'error'; message?: string }> = {};

      for (const url of urls) {
        try {
          await scrapeUrlData(url.id, url.url);
          successCount++;
          newStatuses[url.id] = { status: 'success', message: '查询成功' };
        } catch (err: any) {
          console.error(`抓取 ${url.url} 失败:`, err);
          failCount++;
          // 提取错误信息
          let errorMessage = '查询失败';
          if (err.message) {
            errorMessage = err.message;
          } else if (err.context) {
            errorMessage = `${err.context}: ${err.name || '未知错误'}`;
          }
          newStatuses[url.id] = { status: 'error', message: errorMessage };
        }
      }

      setUrlStatuses(newStatuses);

      if (successCount > 0) {
        setSuccess(`成功查询 ${successCount} 个网址的数据`);
        setRefreshTrigger(prev => prev + 1);
      }

      if (failCount > 0) {
        setError(`${failCount} 个网址查询失败，请查看网址列表中的错误提示`);
      }
    } catch (err) {
      console.error('查询失败:', err);
      setError('查询失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 多频道抓取
  const handleMultiChannelScrape = async () => {
    if (!user) return;

    setMultiChannelScraping(true);
    setError('');
    setSuccess('');
    setScrapeProgress(null);
    setScrapeResults(null);

    try {
      console.log('🎯 开始多频道自动抓取...');
      console.log('📋 启用的频道:', CSG_CHANNELS.filter(ch => ch.enabled).map(ch => ch.name).join(', '));

      const result = await multiChannelScrape(user.id, undefined, {
        maxPages: 5,
        delay: 2000,
        onProgress: (update) => {
          setScrapeProgress(update);
        },
      });

      if (!result.success) {
        setError('多频道抓取失败');
        return;
      }

      setScrapeResults(result.total);

      // 构建结果消息
      let message = `多频道抓取完成！`;
      message += ` 共 ${result.total.channels} 个频道`;
      message += `，${result.total.links} 个链接`;
      if (result.total.success > 0) {
        message += `，成功 ${result.total.success} 条`;
      }
      if (result.total.irrelevant > 0) {
        message += `，跳过 ${result.total.irrelevant} 条无关内容`;
      }
      if (result.total.failed > 0) {
        message += `，失败 ${result.total.failed} 条`;
      }

      setSuccess(message);

      // 刷新交易数据
      setRefreshTrigger(prev => prev + 1);

      // 5秒后清除进度
      setTimeout(() => {
        setScrapeProgress(null);
        setScrapeResults(null);
      }, 5000);

    } catch (err: any) {
      console.error('多频道抓取失败:', err);
      setError(err.message || '多频道抓取失败');
    } finally {
      setMultiChannelScraping(false);
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
            <NotificationCenter
              onNavigate={(link) => {
                if (link.startsWith('/')) {
                  navigate(link);
                }
              }}
            />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 xl:grid-cols-3">
          {/* 左侧：网址管理 + 管理员功能 */}
          <div className="xl:col-span-1 space-y-6">
            <UrlManager
              onUrlsChange={() => setRefreshTrigger(prev => prev + 1)}
              urlStatuses={urlStatuses}
            />

            {/* 管理员专属功能 */}
            {profile?.role === 'admin' && (
              <>
                <DataSourceManager />
                <ScrapingHistory limit={20} />
              </>
            )}
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">日期范围</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dateRange.from && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'PPP', { locale: zhCN })} - {format(dateRange.to, 'PPP', { locale: zhCN })}
                            </>
                          ) : (
                            format(dateRange.from, 'PPP', { locale: zhCN })
                          )
                        ) : (
                          '选择日期范围'
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{
                          from: dateRange.from,
                          to: dateRange.to,
                        }}
                        onSelect={(range) => {
                          setDateRange(range || { from: undefined, to: undefined });
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 查询按钮 */}
                <Button onClick={handleQuery} disabled={loading || multiChannelScraping} className="w-full" size="lg">
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

                {/* 多频道抓取按钮 */}
                <Button
                  onClick={handleMultiChannelScrape}
                  disabled={loading || multiChannelScraping}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  {multiChannelScraping ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      多频道抓取中...
                    </>
                  ) : (
                    <>
                      <Leaf className="mr-2 h-5 w-5" />
                      多频道自动抓取
                    </>
                  )}
                </Button>

                {/* 多频道抓取进度 */}
                {scrapeProgress && (
                  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-medium">{scrapeProgress.channelName}</span>
                      </div>
                      <div className="text-sm mt-1">{scrapeProgress.message}</div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* 多频道抓取结果摘要 */}
                {scrapeResults && (
                  <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      <div className="font-medium mb-1">抓取结果摘要：</div>
                      <div className="text-sm space-y-1">
                        <div>• 频道数: {scrapeResults.channels}</div>
                        <div>• 总链接: {scrapeResults.links}</div>
                        <div>• 成功: {scrapeResults.success} 条</div>
                        {scrapeResults.irrelevant > 0 && (
                          <div>• 跳过: {scrapeResults.irrelevant} 条（无关内容）</div>
                        )}
                        {scrapeResults.failed > 0 && (
                          <div className="text-red-600">• 失败: {scrapeResults.failed} 条</div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 交易数据表格 */}
            <TransactionTable
              startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined}
              endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
