import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserUrlsWithAutoScrape,
  enableAutoScrape,
  disableAutoScrape,
  updateScrapeInterval,
  triggerImmediateScrape,
} from '@/db/api';
import type { UrlWithAutoScrape, ScrapeInterval, ScrapingResult } from '@/types/auto-scrape';

export function useAutoScrape() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState<UrlWithAutoScrape[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 加载URLs（包含自动抓取信息）
  const loadUrls = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getUserUrlsWithAutoScrape(user.id);
      setUrls(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error('加载URLs失败:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 启用自动抓取
  const enableScrape = useCallback(async (urlId: string, interval: ScrapeInterval) => {
    setLoading(true);
    setError(null);

    try {
      await enableAutoScrape(urlId, interval);
      await loadUrls();
    } catch (err: any) {
      setError(err.message || '启用失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadUrls]);

  // 禁用自动抓取
  const disableScrape = useCallback(async (urlId: string) => {
    setLoading(true);
    setError(null);

    try {
      await disableAutoScrape(urlId);
      await loadUrls();
    } catch (err: any) {
      setError(err.message || '禁用失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadUrls]);

  // 更新抓取间隔
  const updateInterval = useCallback(async (urlId: string, interval: ScrapeInterval) => {
    setLoading(true);
    setError(null);

    try {
      await updateScrapeInterval(urlId, interval);
      await loadUrls();
    } catch (err: any) {
      setError(err.message || '更新失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadUrls]);

  // 立即抓取
  const immediateScrape = useCallback(async (urlId: string): Promise<ScrapingResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await triggerImmediateScrape(urlId);
      await loadUrls();
      return result;
    } catch (err: any) {
      setError(err.message || '抓取失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadUrls]);

  return {
    urls,
    loading,
    error,
    loadUrls,
    enableScrape,
    disableScrape,
    updateInterval,
    immediateScrape,
  };
}
