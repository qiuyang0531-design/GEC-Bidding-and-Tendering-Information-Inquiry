import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2, Edit, Trash2, Play } from 'lucide-react';
import { getDataSources, addDataSource, updateDataSource, deleteDataSource } from '@/db/api';
import type { DataSource, ParserConfig } from '@/types/auto-scrape';

export default function DataSourceManager() {
  const { profile } = useAuth();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [parserConfig, setParserConfig] = useState('');

  // 非管理员不能访问
  if (profile?.role !== 'admin') {
    return (
      <Alert>
        <AlertDescription>只有管理员可以访问数据源管理</AlertDescription>
      </Alert>
    );
  }

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    setLoading(true);
    try {
      const data = await getDataSources();
      setDataSources(data);
    } catch (err) {
      setError('加载数据源失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSource(null);
    setName('');
    setBaseUrl('');
    setParserConfig(JSON.stringify(
      {
        type: 'table',
        selectors: {
          container: 'table.data-table',
          project: 'tr td:nth-child(1)',
          bidding: 'tr td:nth-child(2)',
        }
      },
      null,
      2
    ));
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (source: DataSource) => {
    setEditingSource(source);
    setName(source.name);
    setBaseUrl(source.base_url);
    setParserConfig(JSON.stringify(source.parser_config, null, 2));
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 验证JSON格式
      let config: ParserConfig;
      try {
        config = JSON.parse(parserConfig);
      } catch {
        setError('解析器配置格式错误，请检查JSON格式');
        setSaving(false);
        return;
      }

      if (editingSource) {
        await updateDataSource(editingSource.id, {
          name,
          base_url: baseUrl,
          parser_config: config,
        });
        setSuccess('数据源更新成功');
      } else {
        await addDataSource(name, baseUrl, config);
        setSuccess('数据源添加成功');
      }

      setDialogOpen(false);
      await loadDataSources();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除数据源 "${name}" 吗？`)) return;

    try {
      await deleteDataSource(id);
      setSuccess('数据源删除成功');
      await loadDataSources();
    } catch (err) {
      setError('删除失败');
    }
  };

  const handleToggleActive = async (source: DataSource) => {
    try {
      await updateDataSource(source.id, { is_active: !source.is_active });
      await loadDataSources();
    } catch (err) {
      setError('更新状态失败');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>数据源管理</CardTitle>
            <CardDescription>管理可插拔的数据源解析器配置</CardDescription>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            添加数据源
          </Button>
        </div>
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

        {dataSources.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无数据源，点击"添加数据源"开始配置
          </div>
        ) : (
          <div className="space-y-3">
            {dataSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{source.name}</h3>
                    <Badge variant={source.is_active ? 'default' : 'secondary'}>
                      {source.is_active ? '启用' : '禁用'}
                    </Badge>
                    <Badge variant="outline">{source.parser_config.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{source.base_url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={source.is_active}
                    onCheckedChange={() => handleToggleActive(source)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(source)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(source.id, source.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 添加/编辑对话框 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? '编辑数据源' : '添加数据源'}
              </DialogTitle>
              <DialogDescription>
                配置数据源的基础信息和解析器规则
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">数据源名称</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：北京GEC交易中心"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">基础URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parserConfig">解析器配置 (JSON)</Label>
                <Textarea
                  id="parserConfig"
                  value={parserConfig}
                  onChange={(e) => setParserConfig(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder='{"type": "table", "selectors": {...}}'
                />
                <p className="text-xs text-muted-foreground">
                  配置解析器选择器、字段映射和转换规则。必须是有效的JSON格式。
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
