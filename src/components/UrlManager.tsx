import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Loader2, CheckCircle2, XCircle, AlertCircle, Pencil, Play, List, Download } from 'lucide-react';
import { addUrl, deleteUrl, getUserUrls, updateUrl, scrapeListPage, batchScrapeDetails, scrapeUrlData } from '@/db/api';
import { useAutoScrape } from '@/hooks/useAutoScrape';
import type { Url } from '@/types/types.ts';
import type { UrlWithAutoScrape, ScrapeInterval } from '@/types/auto-scrape';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface UrlManagerProps {
  onUrlsChange?: () => void;
  urlStatuses?: Record<string, { status: 'success' | 'error' | 'idle'; message?: string }>;
}

export default function UrlManager({ onUrlsChange, urlStatuses = {} }: UrlManagerProps) {
  const { user } = useAuth();
  const [urls, setUrls] = useState<UrlWithAutoScrape[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlName, setNewUrlName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 编辑相关状态
  const [editingUrl, setEditingUrl] = useState<Url | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUrl, setEditUrl] = useState('');
  const [editUrlName, setEditUrlName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // 使用自动抓取 hook
  const {
    loading: autoScrapeLoading,
    error: autoScrapeError,
    loadUrls,
    enableScrape,
    disableScrape,
    updateInterval,
    immediateScrape,
  } = useAutoScrape();

  // 加载URLs
  const loadUrlsData = async () => {
    if (!user) return;

    try {
      const data = await getUserUrls(user.id);
      setUrls(data as UrlWithAutoScrape[]);
    } catch (err) {
      console.error('加载URLs失败:', err);
    }
  };

  useEffect(() => {
    loadUrlsData();
  }, [user]);

  // 添加URL
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!newUrl.trim()) {
        setError('请输入网址');
        setLoading(false);
        return;
      }

      try {
        new URL(newUrl);
      } catch {
        setError('请输入有效的网址（包含http://或https://）');
        setLoading(false);
        return;
      }

      // 检查网址是否已存在（前端验证）
      const normalizedUrl = newUrl.trim().toLowerCase();
      const existingUrl = urls.find(u => u.url.toLowerCase() === normalizedUrl);
      if (existingUrl) {
        setError('该网址已存在，请勿重复添加');
        setLoading(false);
        return;
      }

      await addUrl(user.id, newUrl, newUrlName || undefined);
      setSuccess('网址添加成功');
      setNewUrl('');
      setNewUrlName('');
      await loadUrlsData();
      onUrlsChange?.();
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        setError('该网址已存在');
      } else {
        setError('添加失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 删除URL
  const handleDeleteUrl = async (urlId: string) => {
    if (!confirm('确定要删除这个网址吗？')) return;

    try {
      await deleteUrl(urlId);
      setSuccess('网址删除成功');
      await loadUrlsData();
      onUrlsChange?.();
    } catch (err) {
      setError('删除失败，请重试');
    }
  };

  // 打开编辑对话框
  const handleEditUrl = (url: Url) => {
    setEditingUrl(url);
    setEditUrl(url.url);
    setEditUrlName(url.name || '');
    setEditDialogOpen(true);
    setError('');
    setSuccess('');
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingUrl) return;

    setEditLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!editUrl.trim()) {
        setError('请输入网址');
        setEditLoading(false);
        return;
      }

      try {
        new URL(editUrl);
      } catch {
        setError('请输入有效的网址（包含http://或https://）');
        setEditLoading(false);
        return;
      }

      // 检查网址是否与其他网址重复（排除当前编辑的网址）
      const normalizedUrl = editUrl.trim().toLowerCase();
      const duplicateUrl = urls.find(
        u => u.url.toLowerCase() === normalizedUrl && u.id !== editingUrl.id
      );
      if (duplicateUrl) {
        setError('该网址已存在，请使用其他网址');
        setEditLoading(false);
        return;
      }

      await updateUrl(editingUrl.id, editUrl, editUrlName || undefined);
      setSuccess('网址更新成功');
      setEditDialogOpen(false);
      setEditingUrl(null);
      await loadUrlsData();
      onUrlsChange?.();
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        setError('该网址已存在');
      } else {
        setError('更新失败，请重试');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingUrl(null);
    setEditUrl('');
    setEditUrlName('');
    setError('');
  };

  // 处理自动抓取开关
  const handleAutoScrapeToggle = async (urlId: string, enabled: boolean, interval: ScrapeInterval = 24) => {
    try {
      if (enabled) {
        await enableScrape(urlId, interval);
        setSuccess('已启用自动抓取');
      } else {
        await disableScrape(urlId);
        setSuccess('已禁用自动抓取');
      }
      await loadUrlsData();
      onUrlsChange?.();
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  // 处理间隔变更
  const handleIntervalChange = async (urlId: string, interval: ScrapeInterval) => {
    try {
      await updateInterval(urlId, interval);
      setSuccess('抓取间隔已更新');
      await loadUrlsData();
      onUrlsChange?.();
    } catch (err: any) {
      setError(err.message || '更新失败');
    }
  };

  // 立即抓取单个URL
  const handleImmediateScrape = async (urlId: string) => {
    if (!user) return;

    // 找到对应的URL
    const urlObj = urls.find(u => u.id === urlId);
    if (!urlObj) {
      setError('找不到对应的网址');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('📋 开始抓取单个URL:', urlObj.url);

      const result = await scrapeUrlData(urlId, urlObj.url);

      if (result.success) {
        const count = result.newCount || result.count || 0;
        setSuccess(`抓取成功：新增 ${count} 条数据`);
        console.log(`✅ 抓取成功，新增 ${count} 条数据`);
      } else {
        setError(`抓取失败：${result.message}`);
        console.log(`❌ 抓取失败: ${result.message}`);
      }

      await loadUrlsData();
      onUrlsChange?.();
    } catch (err: any) {
      console.error('抓取异常:', err);
      setError(err.message || '抓取失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量抓取列表页
  const [batchScraping, setBatchScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const handleBatchScrape = async (url: string, urlId: string) => {
    if (!user) return;

    setBatchScraping(true);
    setError('');
    setSuccess('');
    setScrapeProgress({ current: 0, total: 0, message: '正在抓取列表页...' });

    try {
      // 步骤1: 抓取列表页，获取所有详情页链接
      const listResult = await scrapeListPage(url, 10); // 最多10页

      if (!listResult.success || !listResult.data) {
        setError(`抓取列表页失败: ${listResult.error}`);
        setBatchScraping(false);
        return;
      }

      const { totalPages, totalLinks, links } = listResult.data;
      setScrapeProgress({ current: 0, total: totalLinks, message: `找到 ${totalLinks} 个详情页，准备抓取...` });

      // 短暂延迟让用户看到进度
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 步骤2: 批量抓取所有详情页（使用较慢的速度避免限流）
      const batchResult = await batchScrapeDetails(user.id, urlId, links, { delay: 2000 });

      setScrapeProgress({ current: totalLinks, total: totalLinks, message: '抓取完成！' });

      // 统计无关内容数量
      const irrelevantCount = batchResult.results.filter((r: any) => r.irrelevant).length;

      let successMessage = `批量抓取完成！共 ${totalLinks} 个链接`;
      if (batchResult.success > 0) {
        successMessage += `，成功 ${batchResult.success} 个`;
      }
      if (irrelevantCount > 0) {
        successMessage += `，跳过 ${irrelevantCount} 个无关内容`;
      }
      if (batchResult.failed > 0) {
        successMessage += `，失败 ${batchResult.failed} 个`;
      }

      setSuccess(successMessage);

      // 等待数据库保存完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      await loadUrlsData();
      onUrlsChange?.();

      // 清除进度显示
      setTimeout(() => setScrapeProgress(null), 3000);
    } catch (err: any) {
      setError(`批量抓取失败: ${err.message}`);
      setScrapeProgress(null);
    } finally {
      setBatchScraping(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>网址管理</CardTitle>
        <CardDescription>
          添加需要查询的绿色电力证书交易网址。
          <br />
          <span className="text-primary">💡 提示：添加列表页URL后，可使用"批量抓取"自动获取所有标讯详情</span>
        </CardDescription>
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

        {/* 批量抓取进度 */}
        {scrapeProgress && (
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{scrapeProgress.message}</span>
                {scrapeProgress.total > 0 && (
                  <span className="text-sm ml-auto">
                    {scrapeProgress.current} / {scrapeProgress.total}
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 添加URL表单 */}
        <form onSubmit={handleAddUrl} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">网址 *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              disabled={loading}
              className={newUrl && urls.some(u => u.url.toLowerCase() === newUrl.trim().toLowerCase()) ? 'border-destructive' : ''}
            />
            {newUrl && urls.some(u => u.url.toLowerCase() === newUrl.trim().toLowerCase()) && (
              <p className="text-xs text-destructive">⚠️ 该网址已存在</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="urlName">备注名称（可选）</Label>
            <Input
              id="urlName"
              type="text"
              placeholder="例如：北京交易中心"
              value={newUrlName}
              onChange={(e) => setNewUrlName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                添加网址
              </>
            )}
          </Button>
        </form>

        {/* URL列表 */}
        {urls.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-semibold text-sm">已添加的网址</h3>
            <div className="space-y-3">
              {urls.map((url) => {
                const status = urlStatuses[url.id];
                const isAutoScrapeEnabled = url.is_auto_scrape || url.scraping_config?.is_enabled;
                const scrapeInterval = url.scrape_interval_hours || 24;

                return (
                  <div
                    key={url.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      status?.status === 'error'
                        ? 'bg-destructive/10 border-destructive/20'
                        : status?.status === 'success'
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-muted'
                    )}
                  >
                    {/* 第一行：网址信息 + 查询状态 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="shrink-0">
                                {status?.status === 'success' && (
                                  <CheckCircle2 className="h-5 w-5 text-primary" />
                                )}
                                {status?.status === 'error' && (
                                  <XCircle className="h-5 w-5 text-destructive" />
                                )}
                                {!status && (
                                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {status?.status === 'success' && '查询成功'}
                                {status?.status === 'error' && `查询失败: ${status.message || '未知错误'}`}
                                {!status && '未查询'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <div className="flex-1 min-w-0">
                          {url.name && (
                            <p className="font-medium text-sm truncate">{url.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground truncate">{url.url}</p>
                          {status?.status === 'error' && status.message && (
                            <p className="text-xs text-destructive mt-1">
                              ⚠️ {status.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditUrl(url)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUrl(url.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* 第二行：自动抓取控制 */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isAutoScrapeEnabled}
                            onCheckedChange={(checked) =>
                              handleAutoScrapeToggle(url.id, checked, scrapeInterval as ScrapeInterval)
                            }
                            disabled={autoScrapeLoading}
                          />
                          <span className="text-sm">自动抓取</span>
                        </div>

                        {isAutoScrapeEnabled && (
                          <Select
                            value={String(scrapeInterval)}
                            onValueChange={(value) =>
                              handleIntervalChange(url.id, Number(value) as ScrapeInterval)
                            }
                            disabled={autoScrapeLoading}
                          >
                            <SelectTrigger className="h-8 w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="6">每6小时</SelectItem>
                              <SelectItem value="12">每12小时</SelectItem>
                              <SelectItem value="24">每天</SelectItem>
                              <SelectItem value="48">每2天</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 显示抓取统计信息 */}
                        {url.last_scraped_at && (
                          <span className="text-xs text-muted-foreground">
                            最后抓取: {formatDistanceToNow(new Date(url.last_scraped_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                        )}
                        {url.total_new_records_count > 0 && (
                          <span className="text-xs text-primary">
                            累计新增: {url.total_new_records_count}
                          </span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImmediateScrape(url.id)}
                        disabled={loading || batchScraping}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        立即抓取
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleBatchScrape(url.url, url.id)}
                        disabled={loading || batchScraping}
                        title="抓取列表页所有详情"
                      >
                        {batchScraping ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            抓取中...
                          </>
                        ) : (
                          <>
                            <List className="h-4 w-4 mr-1" />
                            批量抓取
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑网址</DialogTitle>
              <DialogDescription>
                修改网址信息，保存后将更新数据库中的记录
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-url">网址 *</Label>
                <Input
                  id="edit-url"
                  type="url"
                  placeholder="https://example.com"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  disabled={editLoading}
                  className={
                    editUrl && editingUrl && urls.some(
                      u => u.url.toLowerCase() === editUrl.trim().toLowerCase() && u.id !== editingUrl.id
                    ) ? 'border-destructive' : ''
                  }
                />
                {editUrl && editingUrl && urls.some(
                  u => u.url.toLowerCase() === editUrl.trim().toLowerCase() && u.id !== editingUrl.id
                ) && (
                  <p className="text-xs text-destructive">⚠️ 该网址已存在</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url-name">备注名称（可选）</Label>
                <Input
                  id="edit-url-name"
                  type="text"
                  placeholder="例如：北京交易中心"
                  value={editUrlName}
                  onChange={(e) => setEditUrlName(e.target.value)}
                  disabled={editLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={editLoading}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
