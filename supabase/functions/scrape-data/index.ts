import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  urlId: string;
  url: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 创建Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 获取当前用户
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 解析请求体
    const { urlId, url }: RequestBody = await req.json();

    if (!urlId || !url) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 抓取网页数据
    console.log(`开始抓取: ${url}`);
    const response = await fetch(url);
    const html = await response.text();

    // 解析HTML数据
    // 传入html、urlId、userId和完整的url（用于处理相对链接）
    const transactions = parseHtmlData(html, urlId, user.id, url);

    // 如果有数据，插入到数据库
    if (transactions.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('transactions')
        .insert(transactions);

      if (insertError) {
        console.error('插入数据失败:', insertError);
        return new Response(
          JSON.stringify({ error: '保存数据失败', details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功抓取 ${transactions.length} 条数据`,
        count: transactions.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('抓取失败:', error);
    return new Response(
      JSON.stringify({ error: '抓取失败', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// 解析HTML数据的函数
// 这是一个示例实现，实际应用中需要根据目标网站的HTML结构进行定制
function parseHtmlData(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];

  // 尝试不同的解析方法
  // 方法1：解析HTML表格
  const tableTransactions = parseHtmlTable(html, urlId, userId, baseUrl);
  if (tableTransactions.length > 0) {
    return tableTransactions;
  }

  // 方法2：解析列表结构
  const listTransactions = parseHtmlList(html, urlId, userId, baseUrl);
  if (listTransactions.length > 0) {
    return listTransactions;
  }

  // 如果都失败，记录日志
  console.log('未能从HTML中提取数据');
  console.log('HTML长度:', html.length);
  console.log('请根据实际网站HTML结构定制解析逻辑');
  console.log('参考文档: SCRAPING_IMPLEMENTATION_GUIDE.md');

  return transactions;
}

// 方法1：解析HTML表格
function parseHtmlTable(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];

  try {
    // 提取表格行（跳过表头）
    const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const rows = Array.from(html.matchAll(tableRowRegex));

    // 至少需要2行（表头+数据）
    if (rows.length < 2) return transactions;

    // 从第二行开始处理（跳过表头）
    for (let i = 1; i < rows.length; i++) {
      const rowHtml = rows[i][1];

      // 提取单元格
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = Array.from(rowHtml.matchAll(cellRegex));

      // 确保有足够的列
      if (cells.length < 5) continue;

      // 根据列的顺序提取数据（需要根据实际网站调整）
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

      // 验证必填字段
      if (transaction.project_name && transaction.project_name.length > 0) {
        transactions.push(transaction);
      }
    }
  } catch (error) {
    console.error('表格解析失败:', error);
  }

  return transactions;
}

// 方法2：解析列表结构
function parseHtmlList(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];

  try {
    // 尝试查找常见的列表容器
    const itemPatterns = [
      /<div[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<li[^>]*class="[^"]*transaction[^"]*"[^>]*>(.*?)<\/li>/gis,
      /<article[^>]*>(.*?)<\/article>/gis,
    ];

    for (const pattern of itemPatterns) {
      const items = Array.from(html.matchAll(pattern));

      if (items.length === 0) continue;

      for (const item of items) {
        const itemHtml = item[1];

        const transaction = {
          url_id: urlId,
          user_id: userId,
          project_name: extractByPattern(itemHtml, /项目名称[：:]\s*([^<\n]+)/),
          bidding_unit: extractByPattern(itemHtml, /招标单位[：:]\s*([^<\n]+)/),
          bidder_unit: extractByPattern(itemHtml, /投标单位[：:]\s*([^<\n]+)/),
          winning_unit: extractByPattern(itemHtml, /中标单位[：:]\s*([^<\n]+)/),
          total_price: extractPrice(extractByPattern(itemHtml, /总价[：:]\s*([^<\n]+)/) || ''),
          quantity: extractNumber(extractByPattern(itemHtml, /成交量[：:]\s*([^<\n]+)/) || ''),
          unit_price: extractPrice(extractByPattern(itemHtml, /单价[：:]\s*([^<\n]+)/) || ''),
          detail_link: extractLink(itemHtml, baseUrl),
          is_channel: parseChannelType(extractByPattern(itemHtml, /通道[：:]\s*([^<\n]+)/) || ''),
          cert_year: extractYear(extractByPattern(itemHtml, /年份[：:]\s*([^<\n]+)/) || ''),
          bid_start_date: parseDate(extractByPattern(itemHtml, /招标开始[：:]\s*([^<\n]+)/) || ''),
          bid_end_date: parseDate(extractByPattern(itemHtml, /招标结束[：:]\s*([^<\n]+)/) || ''),
          award_date: parseDate(extractByPattern(itemHtml, /中标日期[：:]\s*([^<\n]+)/) || ''),
        };

        if (transaction.project_name && transaction.project_name.length > 0) {
          transactions.push(transaction);
        }
      }

      if (transactions.length > 0) break;
    }
  } catch (error) {
    console.error('列表解析失败:', error);
  }

  return transactions;
}

// ========== 辅助函数 ==========

// 清理文本（去除HTML标签和多余空格）
function cleanText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // 去除HTML标签
    .replace(/&nbsp;/g, ' ') // 替换&nbsp;
    .replace(/&amp;/g, '&')  // 替换&amp;
    .replace(/&lt;/g, '<')   // 替换&lt;
    .replace(/&gt;/g, '>')   // 替换&gt;
    .replace(/&quot;/g, '"') // 替换&quot;
    .replace(/&#\d+;/g, '')  // 去除数字实体
    .trim();
}

// 提取价格（去除货币符号和逗号）
function extractPrice(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const price = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

// 提取数字
function extractNumber(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

// 提取链接
function extractLink(html: string, baseUrl: string): string | null {
  if (!html) return null;
  const match = html.match(/href=["']([^"']+)["']/);
  if (!match) return null;

  let link = match[1];

  // 处理相对路径
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
  } catch (error) {
    console.error('链接解析失败:', error);
    return null;
  }
}

// 解析通道类型
function parseChannelType(html: string): boolean | null {
  if (!html) return null;
  const text = cleanText(html);
  if (!text || text === '-' || text.trim() === '') return null;
  if (text.includes('通道') && !text.includes('非')) return true;
  if (text.includes('非通道')) return false;
  return null;
}

// 提取年份（支持单年份和多年份）
function extractYear(html: string): string | null {
  if (!html) return null;
  const text = cleanText(html);

  // 匹配多年份格式：2024/2025 或 2024-2025
  const multiYearMatch = text.match(/(\d{4})[\/\-](\d{4})/);
  if (multiYearMatch) {
    return `${multiYearMatch[1]}/${multiYearMatch[2]}`;
  }

  // 匹配单年份格式：2025
  const singleYearMatch = text.match(/\d{4}/);
  if (singleYearMatch) {
    return singleYearMatch[0];
  }

  return null;
}

// 解析日期
function parseDate(html: string): string | null {
  if (!html) return null;
  const text = cleanText(html);

  // 匹配日期格式：YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD
  const dateMatch = text.match(/(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

// 根据正则模式提取内容
function extractByPattern(html: string, pattern: RegExp): string | null {
  if (!html) return null;
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}

  return transactions;
}

// 辅助函数：从HTML片段中提取字段
// function extractField(html: string, fieldType: string): string {
//   // 根据字段类型和HTML结构提取数据
//   // 这需要根据实际网站的HTML结构来实现
//   return '';
// }
