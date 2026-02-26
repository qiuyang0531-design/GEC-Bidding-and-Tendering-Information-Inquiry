import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, AlertCircle, Clock, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScrapingLogs } from '@/db/api';
import type { ScrapingLog } from '@/types/auto-scrape';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ScrapingHistoryProps {
  urlId?: string;
  limit?: number;
}

export default function ScrapingHistory({ urlId, limit = 50 }: ScrapingHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [user, urlId, statusFilter]);

  const loadLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await getScrapingLogs(
        user.id,
        urlId,
        statusFilter || undefined,
        limit
      );
      setLogs(data);
    } catch (err) {
      console.error('加载抓取日志失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ScrapingLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ScrapingLog['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">成功</Badge>;
      case 'error':
        return <Badge variant="destructive">失败</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">部分成功</Badge>;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>抓取历史</CardTitle>
            <CardDescription>查看数据抓取记录和统计</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={statusFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              全部
            </Button>
            <Button
              variant={statusFilter === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('success')}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              成功
            </Button>
            <Button
              variant={statusFilter === 'error' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('error')}
            >
              <XCircle className="h-4 w-4 mr-1" />
              失败
            </Button>
            <Button
              variant={statusFilter === 'partial' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('partial')}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              部分
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mb-2 opacity-50" />
            <p>暂无抓取记录</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3 pr-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    log.status === 'success' && 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20',
                    log.status === 'error' && 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
                    log.status === 'partial' && 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="shrink-0 mt-0.5">
                        {getStatusIcon(log.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(log.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                        </div>
                        {log.message && (
                          <p className="text-sm font-medium mb-1">{log.message}</p>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div>总记录: {log.records_count}</div>
                          <div>新增: {log.new_records_count}</div>
                          <div>更新: {log.updated_records_count}</div>
                          <div>重复: {log.duplicate_count}</div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(log.duration_ms)}
                          </span>
                        </div>
                        {log.error_details && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                            {log.error_details.message || '未知错误'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
