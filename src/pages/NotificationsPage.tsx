import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, CheckCircle2, XCircle, Info, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types/auto-scrape';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function NotificationsPage() {
  const { user, profile } = useAuth();
  const { notifications, markAsRead, markAllAsRead, removeNotification } = useNotifications(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'scraping_success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'scraping_error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'new_data':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationBadge = (type: Notification['type']) => {
    switch (type) {
      case 'scraping_success':
        return <Badge variant="default" className="bg-green-500">抓取成功</Badge>;
      case 'scraping_error':
        return <Badge variant="destructive">抓取失败</Badge>;
      case 'new_data':
        return <Badge variant="default" className="bg-blue-500">新数据</Badge>;
    }
  };

  const getNotificationBgColor = (type: Notification['type'], isRead: boolean) => {
    if (isRead) return 'bg-muted/30';

    switch (type) {
      case 'scraping_success':
        return 'bg-green-50 dark:bg-green-950/20';
      case 'scraping_error':
        return 'bg-red-50 dark:bg-red-950/20';
      case 'new_data':
        return 'bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'bg-muted';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const adminBadge: any = profile?.role === 'admin' ? (
    <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
      管理员
    </span>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* 头部 */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">通知中心</h1>
                <p className="text-sm text-muted-foreground">
                  欢迎，{profile?.username || user?.email}
                  {adminBadge}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" size="sm">
                <Check className="h-4 w-4 mr-2" />
                全部已读
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>通知</CardTitle>
                <CardDescription>
                  {unreadCount > 0 ? `您有 ${unreadCount} 条未读通知` : '暂无未读通知'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  全部
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unread')}
                >
                  未读
                </Button>
                <Button
                  variant={filter === 'read' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('read')}
                >
                  已读
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无通知</p>
                  <p className="text-sm">当有新数据或抓取状态变化时，您会收到通知</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 rounded-lg border transition-colors',
                        getNotificationBgColor(notification.type, notification.is_read)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {getNotificationBadge(notification.type)}
                              <h3 className="font-semibold">{notification.title}</h3>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          {notification.metadata && (
                            <div className="text-xs space-y-1">
                              {notification.metadata.newRecordsCount && (
                                <div>新增记录: <span className="font-medium">{notification.metadata.newRecordsCount}</span></div>
                              )}
                              {notification.metadata.url && (
                                <div className="truncate">来源: {notification.metadata.url}</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeNotification(notification.id)}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
