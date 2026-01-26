import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getTransactions } from '@/db/api';
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

  useEffect(() => {
    loadTransactions();
  }, [user, startDate, endDate, refreshTrigger]);

  // 格式化价格
  const formatPrice = (price?: number) => {
    if (price === null || price === undefined) return '-';
    return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 格式化日期
  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易数据</CardTitle>
        <CardDescription>
          {transactions.length > 0 
            ? `共 ${transactions.length} 条记录` 
            : '暂无数据，请先添加网址并执行查询'}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  <TableHead>中标单位</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead>通道类型</TableHead>
                  <TableHead>年份</TableHead>
                  <TableHead>交易日期</TableHead>
                  <TableHead>详情</TableHead>
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
                      {transaction.winning_unit || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(transaction.total_price)}
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
                    <TableCell>{transaction.cert_year || '-'}</TableCell>
                    <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                    <TableCell>
                      {transaction.detail_link ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a
                            href={transaction.detail_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        '-'
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
