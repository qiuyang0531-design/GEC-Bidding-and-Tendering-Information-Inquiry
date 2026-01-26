import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Loader2, CheckCircle2, XCircle, AlertCircle, Pencil } from 'lucide-react';
import { addUrl, deleteUrl, getUserUrls, updateUrl } from '@/db/api';
import type { Url } from '@/types/types.ts';
import { useEffect } from 'react';
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

interface UrlManagerProps {
  onUrlsChange?: () => void;
  urlStatuses?: Record<string, { status: 'success' | 'error' | 'idle'; message?: string }>;
}

export default function UrlManager({ onUrlsChange, urlStatuses = {} }: UrlManagerProps) {
  const { user } = useAuth();
  const [urls, setUrls] = useState<Url[]>([]);
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

  // 加载URLs
  const loadUrls = async () => {
    if (!user) return;
    
    try {
      const data = await getUserUrls(user.id);
      setUrls(data);
    } catch (err) {
      console.error('加载URLs失败:', err);
    }
  };

  useEffect(() => {
    loadUrls();
  }, [user]);

  // 添加URL
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // 验证URL格式
      if (!newUrl.trim()) {
        setError('请输入网址');
        setLoading(false);
        return;
      }

      // 简单的URL验证
      try {
        new URL(newUrl);
      } catch {
        setError('请输入有效的网址（包含http://或https://）');
        setLoading(false);
        return;
      }

      await addUrl(user.id, newUrl, newUrlName || undefined);
      setSuccess('网址添加成功');
      setNewUrl('');
      setNewUrlName('');
      await loadUrls();
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
      await loadUrls();
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
      // 验证URL格式
      if (!editUrl.trim()) {
        setError('请输入网址');
        setEditLoading(false);
        return;
      }

      // 简单的URL验证
      try {
        new URL(editUrl);
      } catch {
        setError('请输入有效的网址（包含http://或https://）');
        setEditLoading(false);
        return;
      }

      await updateUrl(editingUrl.id, editUrl, editUrlName || undefined);
      setSuccess('网址更新成功');
      setEditDialogOpen(false);
      setEditingUrl(null);
      await loadUrls();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>网址管理</CardTitle>
        <CardDescription>添加需要查询的绿色电力证书交易网址</CardDescription>
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
            />
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
            <div className="space-y-2">
              {urls.map((url) => {
                const status = urlStatuses[url.id];
                return (
                  <div
                    key={url.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg transition-colors",
                      status?.status === 'error' 
                        ? 'bg-destructive/10 border border-destructive/20' 
                        : status?.status === 'success'
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* 状态图标 */}
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

                      {/* 网址信息 */}
                      <div className="flex-1 min-w-0">
                        {url.name && (
                          <p className="font-medium text-sm truncate">{url.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{url.url}</p>
                        {/* 错误信息 */}
                        {status?.status === 'error' && status.message && (
                          <p className="text-xs text-destructive mt-1">
                            ⚠️ {status.message}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* 操作按钮 */}
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
                />
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
