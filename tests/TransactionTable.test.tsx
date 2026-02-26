/**
 * 组件测试：TransactionTable.tsx
 * 重点：Transaction 数据字段缺失时，各列是否正确显示 '-' / '暂无链接' / 占位符
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import type { Transaction } from '@/types/types';

// ── mock 必须在所有 import 之前声明（vitest 会 hoist 到顶部）────────────
const mockGetTransactions = vi.fn();

vi.mock('@/db/api', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
}));

vi.mock('@/db/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ count: 0, head: true }),
      }),
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    profile: null,
    signOut: vi.fn(),
  }),
}));

// ── 静态 import 组件（mock 已 hoist，此处拿到的是 mock 版本）─────────────
import TransactionTable from '@/components/TransactionTable';

// ── 工厂函数：生成最小合法 Transaction ────────────────────────────────────
function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-001',
    url_id: 'url-001',
    user_id: 'test-user-id',
    project_name: '2024年风电绿证采购项目',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── 辅助：渲染并等待异步数据加载完成 ──────────────────────────────────────
async function renderTable(transactions: Transaction[]) {
  mockGetTransactions.mockResolvedValue(transactions);

  await act(async () => {
    render(<TransactionTable />);
  });

  if (transactions.length > 0) {
    await screen.findByText(transactions[0].project_name, {}, { timeout: 3000 });
  } else {
    await screen.findByText('暂无交易数据', {}, { timeout: 3000 });
  }
}

// ── 辅助：获取数据行（跳过表头行，index 从 0 开始）───────────────────────
function getDataRow(index = 0) {
  const rows = screen.getAllByRole('row');
  // rows[0] 是表头行，数据行从 rows[1] 开始
  return rows[index + 1];
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TransactionTable — 空状态', () => {
  beforeEach(() => vi.clearAllMocks());

  it('无数据时显示"暂无交易数据"提示', async () => {
    await renderTable([]);
    expect(screen.getByText('暂无交易数据')).toBeInTheDocument();
    expect(screen.getByText('请添加网址后点击查询按钮获取数据')).toBeInTheDocument();
  });

  it('无数据时不渲染表格', async () => {
    await renderTable([]);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('无数据时不显示"清空数据"按钮', async () => {
    await renderTable([]);
    expect(screen.queryByRole('button', { name: /清空数据/ })).not.toBeInTheDocument();
  });
});

describe('TransactionTable — 表头', () => {
  beforeEach(() => vi.clearAllMocks());

  it('渲染全部 13 个列标题', async () => {
    await renderTable([makeTransaction()]);
    const headers = [
      '项目名称', '招标单位', '投标单位', '中标单位',
      '总价', '成交量', '绿证单价', '通道类型',
      '绿证年份', '招标开始日期', '招标结束日期', '中标日期', '详情链接',
    ];
    for (const h of headers) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
  });
});

describe('TransactionTable — 全字段完整数据', () => {
  beforeEach(() => vi.clearAllMocks());

  it('所有字段有值时正确渲染每列', async () => {
    const tx = makeTransaction({
      bidding_unit: '南方电网',
      bidder_unit: '华能集团',
      winning_unit: '国家电投',
      total_price: 650000,
      quantity: 100000,
      unit_price: 6.5,
      is_channel: true,
      cert_year: '2024/2025',
      bid_start_date: '2024-01-01',
      bid_end_date: '2024-01-15',
      award_date: '2024-02-01',
      detail_link: 'https://example.com/detail/001',
    });
    await renderTable([tx]);

    const row = getDataRow(0);
    expect(within(row).getByText('南方电网')).toBeInTheDocument();
    expect(within(row).getByText('华能集团')).toBeInTheDocument();
    expect(within(row).getByText('国家电投')).toBeInTheDocument();
    expect(within(row).getByText(/650,000/)).toBeInTheDocument();
    expect(within(row).getByText(/100,000张/)).toBeInTheDocument();
    expect(within(row).getByText(/6\.5/)).toBeInTheDocument();
    expect(within(row).getByText('通道')).toBeInTheDocument();
    expect(within(row).getByText('2024/2025')).toBeInTheDocument();
    const link = within(row).getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/detail/001');
  });
});

describe('TransactionTable — 字段缺失时的占位符', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bidding_unit 缺失时第2列显示 "-"', async () => {
    await renderTable([makeTransaction({ bidding_unit: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('-');
  });

  it('bidder_unit 缺失时第3列显示 "-"', async () => {
    await renderTable([makeTransaction({ bidder_unit: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('-');
  });

  it('winning_unit 缺失时第4列显示 "-"', async () => {
    await renderTable([makeTransaction({ winning_unit: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('-');
  });

  it('total_price 缺失时第5列显示 "-"', async () => {
    await renderTable([makeTransaction({ total_price: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('-');
  });

  it('quantity 缺失时第6列显示 "-"', async () => {
    await renderTable([makeTransaction({ quantity: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[5]).toHaveTextContent('-');
  });

  it('unit_price 缺失时第7列显示 "-"', async () => {
    await renderTable([makeTransaction({ unit_price: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[6]).toHaveTextContent('-');
  });

  it('is_channel 缺失时第8列显示 "-"', async () => {
    await renderTable([makeTransaction({ is_channel: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[7]).toHaveTextContent('-');
  });

  it('cert_year 缺失时第9列显示 "-"', async () => {
    await renderTable([makeTransaction({ cert_year: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[8]).toHaveTextContent('-');
  });

  it('bid_start_date 缺失时第10列显示 "-"', async () => {
    await renderTable([makeTransaction({ bid_start_date: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[9]).toHaveTextContent('-');
  });

  it('bid_end_date 缺失时第11列显示 "-"', async () => {
    await renderTable([makeTransaction({ bid_end_date: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[10]).toHaveTextContent('-');
  });

  it('award_date 缺失时第12列显示 "-"', async () => {
    await renderTable([makeTransaction({ award_date: undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[11]).toHaveTextContent('-');
  });

  it('detail_link 缺失时第13列显示"暂无链接"且无 <a> 标签', async () => {
    await renderTable([makeTransaction({ detail_link: undefined })]);
    const row = getDataRow(0);
    expect(within(row).getByText('暂无链接')).toBeInTheDocument();
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
  });

  it('仅 project_name 有值（12个可选字段全部缺失）时每列均显示占位符', async () => {
    await renderTable([makeTransaction()]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    // 列索引 1-11 均应显示 '-'
    for (let i = 1; i <= 11; i++) {
      expect(cells[i]).toHaveTextContent('-');
    }
    // 列索引 12（详情链接）显示"暂无链接"
    expect(cells[12]).toHaveTextContent('暂无链接');
  });
});

describe('TransactionTable — is_channel 边界值', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is_channel = true 时显示"通道" Badge', async () => {
    await renderTable([makeTransaction({ is_channel: true })]);
    expect(screen.getByText('通道')).toBeInTheDocument();
  });

  it('is_channel = false 时显示"非通道" Badge', async () => {
    await renderTable([makeTransaction({ is_channel: false })]);
    expect(screen.getByText('非通道')).toBeInTheDocument();
  });

  it('is_channel = null 时显示 "-"', async () => {
    await renderTable([makeTransaction({ is_channel: null as unknown as undefined })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[7]).toHaveTextContent('-');
  });
});

describe('TransactionTable — cert_year 格式', () => {
  beforeEach(() => vi.clearAllMocks());

  it('普通字符串年份直接显示', async () => {
    await renderTable([makeTransaction({ cert_year: '2025' })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[8]).toHaveTextContent('2025');
  });

  it('斜杠分隔双年份原样显示', async () => {
    await renderTable([makeTransaction({ cert_year: '2024/2025' })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[8]).toHaveTextContent('2024/2025');
  });

  it('JSON 数组格式字符串解析后用 / 连接', async () => {
    await renderTable([makeTransaction({ cert_year: '["2024","2025"]' })]);
    const cells = within(getDataRow(0)).getAllByRole('cell');
    expect(cells[8]).toHaveTextContent('2024/2025');
  });
});

describe('TransactionTable — 多行数据', () => {
  beforeEach(() => vi.clearAllMocks());

  it('渲染多条记录时每行独立显示正确数据', async () => {
    const txs = [
      makeTransaction({ id: 'tx-001', project_name: '风电项目A', total_price: 10000 }),
      makeTransaction({ id: 'tx-002', project_name: '光伏项目B', total_price: undefined }),
      makeTransaction({ id: 'tx-003', project_name: '分布式项目C', detail_link: 'https://c.com' }),
    ];
    await renderTable(txs);

    expect(screen.getByText('风电项目A')).toBeInTheDocument();
    expect(screen.getByText('光伏项目B')).toBeInTheDocument();
    expect(screen.getByText('分布式项目C')).toBeInTheDocument();

    // 项目B total_price 缺失，第5列应为 '-'
    const cellsB = within(getDataRow(1)).getAllByRole('cell');
    expect(cellsB[4]).toHaveTextContent('-');

    // 项目C 有详情链接
    const linkC = within(getDataRow(2)).getByRole('link');
    expect(linkC).toHaveAttribute('href', 'https://c.com');
  });

  it('有数据时标题区显示记录总数', async () => {
    const txs = [
      makeTransaction({ id: 'tx-001', project_name: '项目一' }),
      makeTransaction({ id: 'tx-002', project_name: '项目二' }),
    ];
    await renderTable(txs);
    expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();
  });

  it('有数据时显示"清空数据"按钮', async () => {
    await renderTable([makeTransaction()]);
    expect(screen.getByRole('button', { name: /清空数据/ })).toBeInTheDocument();
  });
});
