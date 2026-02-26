import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/db/api';
import type { Notification } from '@/types/auto-scrape';

export function useNotifications(unreadOnly: boolean = false) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载通知
  const loadNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getNotifications(user.id, unreadOnly);
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error('加载通知失败:', err);
    } finally {
      setLoading(false);
    }
  }, [user, unreadOnly]);

  // 加载未读数量
  const loadUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('加载未读数量失败:', err);
    }
  }, [user]);

  // 初始加载
  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  // 标记为已读
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      await loadNotifications();
      await loadUnreadCount();
    } catch (err: any) {
      setError(err.message || '操作失败');
      throw err;
    }
  }, [loadNotifications, loadUnreadCount]);

  // 标记所有为已读
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await markAllNotificationsRead(user.id);
      await loadNotifications();
      await loadUnreadCount();
    } catch (err: any) {
      setError(err.message || '操作失败');
      throw err;
    }
  }, [user, loadNotifications, loadUnreadCount]);

  // 删除通知
  const removeNotification = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      await loadNotifications();
      await loadUnreadCount();
    } catch (err: any) {
      setError(err.message || '删除失败');
      throw err;
    }
  }, [loadNotifications, loadUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };
}
