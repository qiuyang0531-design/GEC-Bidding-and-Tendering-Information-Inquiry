/**
 * 单元测试：scrape-data Edge Function 核心辅助函数
 * 测试对象：parseHtmlTable / extractPrice / extractLink / parseDate / extractYear / parseChannelType
 *
 * 由于 Edge Function 运行在 Deno 环境，此处将函数逻辑内联复制进行纯逻辑测试，
 * 完全不依赖 Deno / Supabase 运行时。
 */

import { describe, it, expect } from 'vitest';

// ==================== 内联复制的纯函数（与 index.ts 保持一致）====================

function cleanText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrice(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const price = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

function extractNumber(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function extractLink(html: string, baseUrl: string): string | null {
  if (!html) return null;
  const match = html.match(/href=["']([^"']+)['"]/);
  if (!match) return null;
  const link = match[1];
  try {
    if (link.startsWith('http')) {
      return link;
    } else if (link.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.protocol}//${urlObj.host}${link}`;
    } else {
      const urlObj = new URL(baseUrl);
      const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
      return `${urlObj.protocol}//${urlObj.host}${basePath}/${link}`;
    }
  } catch {
    return null;
  }
}

function parseChannelType(html: string): boolean | null {
  if (!html) return null;
  const text = cleanText(html);
  if (!text || text === '-' || text.trim() === '') return null;
  if (text.includes('通道') && !text.includes('非')) return true;
  if (text.includes('非通道')) return false;
  return null;
}

function extractYear(html: string): string | null {
  if (!html) return null;
  const text = cleanText(html);
  const multiYearMatch = text.match(/(\d{4})[\/\-](\d{4})/);
  if (multiYearMatch) {
    return `${multiYearMatch[1]}/${multiYearMatch[2]}`;
  }
  const singleYearMatch = text.match(/\d{4}/);
  if (singleYearMatch) {
    return singleYearMatch[0];
  }
  return null;
}

function parseDate(html: string): string | null {
  if (!html) return null;
  const text = cleanText(html);
  const dateMatch = text.match(/(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseHtmlTable(
  html: string,
  urlId: string,
  userId: string,
  baseUrl: string
): Record<string, unknown>[] {
  const transactions: Record<string, unknown>[] = [];
  try {
    const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const rows = Array.from(html.matchAll(tableRowRegex));
    if (rows.length < 2) return transactions;

    for (let i = 1; i < rows.length; i++) {
      const rowHtml = rows[i][1];
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = Array.from(rowHtml.matchAll(cellRegex));
      if (cells.length < 5) continue;

      const transaction = {
        url_id: urlId,
        user_id: userId,
        project_name: cleanText(cells[0]?.[1] || ''),
        bidding_unit: cleanText(cells[1]?.[1] || ''),
        bidder_unit: cleanText(cells[2]?.[1] || ''),
        winning_unit: cleanText(cells[3]?.[1] || ''),
        total_price: extractPrice(cells[4]?.[1] || ''),
        quantity: extractNumber(cells[5]?.[1] || ''),
        unit_price: extractPrice(cells[6]?.[1] || ''),
        detail_link: extractLink(cells[0]?.[1] || '', baseUrl),
        is_channel: parseChannelType(cells[7]?.[1] || ''),
        cert_year: extractYear(cells[8]?.[1] || ''),
        bid_start_date: parseDate(cells[9]?.[1] || ''),
        bid_end_date: parseDate(cells[10]?.[1] || ''),
        award_date: parseDate(cells[11]?.[1] || ''),
      };

      if (transaction.project_name && transaction.project_name.length > 0) {
        transactions.push(transaction);
      }
    }
  } catch (error) {
    // 忽略解析错误
  }
  return transactions;
}

// ==================== 测试套件 ====================

// ─── extractPrice ───────────────────────────────────────────────────────────
describe('extractPrice', () => {
  it('从纯数字字符串中提取价格', () => {
    expect(extractPrice('12345')).toBe(12345);
  });

  it('从带千分位逗号的字符串中提取价格', () => {
    expect(extractPrice('1,234,567.89')).toBe(1234567.89);
  });

  it('从带有人民币符号的字符串中提取价格', () => {
    expect(extractPrice('¥ 98,765.00')).toBe(98765);
  });

  it('从带 HTML 标签的字符串中提取价格', () => {
    expect(extractPrice('<span>总价：65,000.00 元</span>')).toBe(65000);
  });

  it('从带 HTML 实体的字符串中提取价格', () => {
    expect(extractPrice('&nbsp;16,120&nbsp;')).toBe(16120);
  });

  it('从带小数点价格中正确解析', () => {
    expect(extractPrice('6.5')).toBe(6.5);
  });

  it('输入为空字符串时返回 null', () => {
    expect(extractPrice('')).toBeNull();
  });

  it('输入为仅文字（无数字）时返回 null', () => {
    expect(extractPrice('暂无价格')).toBeNull();
  });

  it('输入为 "-" 占位符时返回 null', () => {
    // "-" 不含数字，应返回 null
    expect(extractPrice('-')).toBeNull();
  });

  it('从复杂招标文本中提取第一个出现的数字', () => {
    // 注意：函数返回文本中第一个匹配到的数字
    expect(extractPrice('共计 16,120 元，单张限价 6.5 元')).toBe(16120);
  });
});

// ─── parseHtmlTable ──────────────────────────────────────────────────────────
describe('parseHtmlTable', () => {
  const URL_ID = 'url-001';
  const USER_ID = 'user-001';
  const BASE_URL = 'https://example-bidding.com/list.html';

  it('解析标准 13 列招投标表格，提取完整字段', () => {
    const html = `
      <table>
        <tr><th>项目名称</th><th>招标单位</th><th>投标单位</th><th>中标单位</th>
            <th>总价</th><th>成交量</th><th>单价</th><th>通道类型</th>
            <th>证书年份</th><th>招标开始</th><th>招标结束</th><th>中标日期</th></tr>
        <tr>
          <td><a href="/detail/001.html">2024年风电绿证采购项目</a></td>
          <td>南方电网公司</td>
          <td>华能集团</td>
          <td>国家电投</td>
          <td>650,000.00</td>
          <td>100,000</td>
          <td>6.5</td>
          <td>通道</td>
          <td>2024/2025</td>
          <td>2024-01-01</td>
          <td>2024-01-15</td>
          <td>2024-02-01</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.project_name).toBe('2024年风电绿证采购项目');
    expect(row.bidding_unit).toBe('南方电网公司');
    expect(row.bidder_unit).toBe('华能集团');
    expect(row.winning_unit).toBe('国家电投');
    expect(row.total_price).toBe(650000);
    expect(row.quantity).toBe(100000);
    expect(row.unit_price).toBe(6.5);
    expect(row.is_channel).toBe(true);
    expect(row.cert_year).toBe('2024/2025');
    expect(row.bid_start_date).toBe('2024-01-01');
    expect(row.bid_end_date).toBe('2024-01-15');
    expect(row.award_date).toBe('2024-02-01');
  });

  it('正确拼接相对路径详情链接为绝对 URL', () => {
    const html = `
      <table>
        <tr><th>项目名称</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr>
          <td><a href="/detail/abc.html">光伏绿证采购</a></td>
          <td>电网公司</td><td>-</td><td>-</td><td>10000</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result[0].detail_link).toBe('https://example-bidding.com/detail/abc.html');
  });

  it('绝对链接保持不变', () => {
    const html = `
      <table>
        <tr><th>项目名称</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr>
          <td><a href="https://other-site.com/detail/999.html">项目A</a></td>
          <td>单位A</td><td>-</td><td>-</td><td>20000</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result[0].detail_link).toBe('https://other-site.com/detail/999.html');
  });

  it('跳过列数少于 5 的行（数据不完整）', () => {
    const html = `
      <table>
        <tr><th>项目名称</th><th>招标单位</th></tr>
        <tr><td>数据不完整</td><td>某单位</td></tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result).toHaveLength(0);
  });

  it('跳过 project_name 为空的行', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr>
          <td></td>
          <td>单位</td><td>-</td><td>-</td><td>5000</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result).toHaveLength(0);
  });

  it('解析多行数据，每行生成独立记录', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr><td>项目A</td><td>单位A</td><td>-</td><td>-</td><td>10000</td></tr>
        <tr><td>项目B</td><td>单位B</td><td>-</td><td>-</td><td>20000</td></tr>
        <tr><td>项目C</td><td>单位C</td><td>-</td><td>-</td><td>30000</td></tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result).toHaveLength(3);
    expect(result[0].project_name).toBe('项目A');
    expect(result[1].project_name).toBe('项目B');
    expect(result[2].project_name).toBe('项目C');
  });

  it('单元格含 HTML 实体时正确清理文本', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr>
          <td>&nbsp;2024年光伏&amp;风电绿证项目&nbsp;</td>
          <td>南方电网&lt;广东&gt;</td>
          <td>-</td><td>-</td><td>50000</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result[0].project_name).toBe('2024年光伏&风电绿证项目');
    expect(result[0].bidding_unit).toBe('南方电网<广东>');
  });

  it('非通道类型正确解析为 false', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th>
            <th>成交量</th><th>单价</th><th>通道</th></tr>
        <tr>
          <td>项目X</td><td>单位X</td><td>-</td><td>-</td>
          <td>10000</td><td>1000</td><td>10</td><td>非通道</td>
        </tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result[0].is_channel).toBe(false);
  });

  it('表格少于两行（无数据行）时返回空数组', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th></tr>
      </table>`;

    const result = parseHtmlTable(html, URL_ID, USER_ID, BASE_URL);
    expect(result).toHaveLength(0);
  });

  it('不含 table 的纯文本返回空数组', () => {
    const result = parseHtmlTable('<div>没有表格内容</div>', URL_ID, USER_ID, BASE_URL);
    expect(result).toHaveLength(0);
  });

  it('url_id 和 user_id 正确赋值到每条记录', () => {
    const html = `
      <table>
        <tr><th>项目</th><th>招标</th><th>投标</th><th>中标</th><th>总价</th></tr>
        <tr><td>测试项目</td><td>测试单位</td><td>-</td><td>-</td><td>1000</td></tr>
      </table>`;

    const result = parseHtmlTable(html, 'my-url-id', 'my-user-id', BASE_URL);
    expect(result[0].url_id).toBe('my-url-id');
    expect(result[0].user_id).toBe('my-user-id');
  });
});

// ─── extractLink ─────────────────────────────────────────────────────────────
describe('extractLink', () => {
  const BASE = 'https://bidding.example.com/list/index.html';

  it('绝对 URL 保持原样返回', () => {
    expect(extractLink('<a href="https://other.com/p.html">详情</a>', BASE))
      .toBe('https://other.com/p.html');
  });

  it('以 / 开头的根相对路径拼接域名', () => {
    expect(extractLink('<a href="/detail/123.html">详情</a>', BASE))
      .toBe('https://bidding.example.com/detail/123.html');
  });

  it('相对路径拼接当前目录', () => {
    expect(extractLink('<a href="detail.html">详情</a>', BASE))
      .toBe('https://bidding.example.com/list/detail.html');
  });

  it('无 href 时返回 null', () => {
    expect(extractLink('<span>无链接</span>', BASE)).toBeNull();
  });

  it('输入为空字符串时返回 null', () => {
    expect(extractLink('', BASE)).toBeNull();
  });
});

// ─── parseDate ───────────────────────────────────────────────────────────────
describe('parseDate', () => {
  it('解析 YYYY-MM-DD 格式', () => {
    expect(parseDate('2024-03-15')).toBe('2024-03-15');
  });

  it('解析 YYYY/MM/DD 格式', () => {
    expect(parseDate('2024/3/5')).toBe('2024-03-05');
  });

  it('解析 YYYY.MM.DD 格式', () => {
    expect(parseDate('2024.12.01')).toBe('2024-12-01');
  });

  it('从带前缀文字的字符串中提取日期', () => {
    expect(parseDate('中标日期：2025-01-20')).toBe('2025-01-20');
  });

  it('无日期字符串返回 null', () => {
    expect(parseDate('暂无日期')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(parseDate('')).toBeNull();
  });
});

// ─── extractYear ─────────────────────────────────────────────────────────────
describe('extractYear', () => {
  it('提取单年份', () => {
    expect(extractYear('2024年光伏绿证项目')).toBe('2024');
  });

  it('提取斜杠分隔的双年份', () => {
    expect(extractYear('绿证年份 2024/2025')).toBe('2024/2025');
  });

  it('提取连字符分隔的双年份', () => {
    expect(extractYear('2024-2025年度项目')).toBe('2024/2025');
  });

  it('无年份时返回 null', () => {
    expect(extractYear('暂无年份信息')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(extractYear('')).toBeNull();
  });
});

// ─── parseChannelType ────────────────────────────────────────────────────────
describe('parseChannelType', () => {
  it('"通道" 返回 true', () => {
    expect(parseChannelType('通道')).toBe(true);
  });

  it('"非通道" 返回 false', () => {
    expect(parseChannelType('非通道')).toBe(false);
  });

  it('空字符串返回 null', () => {
    expect(parseChannelType('')).toBeNull();
  });

  it('"-" 占位符返回 null', () => {
    expect(parseChannelType('-')).toBeNull();
  });

  it('无关文字返回 null', () => {
    expect(parseChannelType('普通项目')).toBeNull();
  });
});
