import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { addUrl, deleteUrl, getUserUrls } from '@/db/api';
import type { Url } from '@/types/types.ts';
import { useEffect } from 'react';

interface UrlManagerProps {
  onUrlsChange?: () => void;
}

export default function UrlManager({ onUrlsChange }: UrlManagerProps) {
  const { user } = useAuth();
  const [urls, setUrls] = useState<Url[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlName, setNewUrlName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
              {urls.map((url) => (
                <div
                  key={url.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    {url.name && (
                      <p className="font-medium text-sm truncate">{url.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{url.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteUrl(url.id)}
                    className="ml-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
