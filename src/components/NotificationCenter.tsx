import React, { useState } from 'react';
import { Bell, Check, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types/auto-scrape';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface NotificationCenterProps {
  onNavigate?: (link: string) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link && onNavigate) {
      onNavigate(notification.link);
    }
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

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

  const getNotificationBgColor = (type: Notification['type']) => {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">通知</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              <Check className="h-4 w-4 mr-1" />
              全部已读
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p>暂无通知</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                    !notification.is_read && 'bg-primary/5',
                    getNotificationBgColor(notification.type)
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
