import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { getTransactions } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { Transaction } from '@/types/types.ts';

interface TransactionTableProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

export default function TransactionTable({ startDate, endDate, refreshTrigger }: TransactionTableProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clearLoading, setClearLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 加载交易数据
  const loadTransactions = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const data = await getTransactions(user.id, startDate, endDate);
      setTransactions(data);
    } catch (err) {
      console.error('加载交易数据失败:', err);
      setError('加载数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 清空交易数据
  const handleClearData = async () => {
    if (!user) return;
    if (!confirm('确定要清空所有交易数据吗？此操作不可恢复！')) return;

    setClearLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // 先统计数量
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 删除当前用户的所有交易数据
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setSuccessMessage(`已清空 ${count || 0} 条交易数据`);
      setTransactions([]);

      // 3秒后清除提示
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('清空数据失败:', err);
      setError('清空数据失败，请重试');
    } finally {
      setClearLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [user, startDate, endDate, refreshTrigger]);

  // 格式化价格
  const formatPrice = (price?: number) => {
    if (price === null || price === undefined) return '-';
    return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 格式化数量
  const formatQuantity = (quantity?: number) => {
    if (quantity === null || quantity === undefined) return '-';
    return `${quantity.toLocaleString('zh-CN')}张`;
  };

  // 格式化日期
  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // 格式化绿证年份
  const formatCertYear = (certYear?: string | string[]) => {
    if (!certYear) return '-';

    // 如果是数组，用 / 连接
    if (Array.isArray(certYear)) {
      return certYear.join('/');
    }

    // 如果是字符串且已经是数组格式（如 "[\"2025\"]"），则解析
    if (certYear.startsWith('[') && certYear.endsWith(']')) {
      try {
        const parsed = JSON.parse(certYear);
        if (Array.isArray(parsed)) {
          return parsed.join('/');
        }
      } catch {
        // 解析失败，返回原字符串
      }
    }

    // 普通字符串直接返回
    return certYear;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>交易数据</CardTitle>
            <CardDescription>
              {transactions.length > 0 ? (
                <>
                  <span>共 {transactions.length} 条记录</span>
                  <span className="block mt-1 text-xs">
                    💡 提示：当前显示的是示例数据（2025年绿证价格约7元），详情链接需要从实际网站抓取后才能显示
                  </span>
                </>
              ) : (
                '暂无数据，请先添加网址并执行查询'
              )}
            </CardDescription>
          </div>
          {transactions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearData}
              disabled={clearLoading || loading}
              className="shrink-0"
            >
              {clearLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  清空中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  清空数据
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {successMessage && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
            <AlertDescription className="text-green-700 dark:text-green-300">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无交易数据</p>
            <p className="text-sm mt-2">请添加网址后点击查询按钮获取数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>招标单位</TableHead>
                  <TableHead>投标单位</TableHead>
                  <TableHead>中标单位</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                  <TableHead className="text-right">成交量</TableHead>
                  <TableHead className="text-right">绿证单价</TableHead>
                  <TableHead>通道类型</TableHead>
                  <TableHead>绿证年份</TableHead>
                  <TableHead>招标开始日期</TableHead>
                  <TableHead>招标结束日期</TableHead>
                  <TableHead>中标日期</TableHead>
                  <TableHead>详情链接</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {transaction.project_name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.bidding_unit || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.bidder_unit || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.winning_unit || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(transaction.total_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(transaction.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(transaction.unit_price)}
                    </TableCell>
                    <TableCell>
                      {transaction.is_channel !== null && transaction.is_channel !== undefined ? (
                        <Badge variant={transaction.is_channel ? 'default' : 'secondary'}>
                          {transaction.is_channel ? '通道' : '非通道'}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{formatCertYear(transaction.cert_year)}</TableCell>
                    <TableCell>{formatDate(transaction.bid_start_date)}</TableCell>
                    <TableCell>{formatDate(transaction.bid_end_date)}</TableCell>
                    <TableCell>{formatDate(transaction.award_date)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {transaction.detail_link ? (
                        <a
                          href={transaction.detail_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm"
                          title={transaction.detail_link}
                        >
                          <span className="truncate">{transaction.detail_link}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">暂无链接</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
