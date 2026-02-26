import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoScrapeRequest {
  userId?: string;
  urlId?: string;
}

interface ScrapingResult {
  urlId: string;
  url: string;
  status: 'success' | 'error' | 'partial';
  recordsCount: number;
  newRecordsCount: number;
  updatedRecordsCount: number;
  duplicateCount: number;
  durationMs: number;
  error?: string;
}

// ==================== 辅助函数 ====================

/**
 * 生成数据哈希（基于关键字段的SHA-256）
 */
async function generateDataHash(transaction: any): Promise<string> {
  const hashInput = [
    transaction.project_name || '',
    transaction.bidding_unit || '',
    transaction.winning_unit || '',
    transaction.total_price || 0,
    transaction.award_date || '',
    transaction.bid_start_date || '',
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 清理文本（去除HTML标签和多余空格）
 */
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
    .trim();
}

/**
 * 提取价格
 */
function extractPrice(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const price = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

/**
 * 提取数字
 */
function extractNumber(html: string): number | null {
  if (!html) return null;
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * 提取链接
 */
function extractLink(html: string, baseUrl: string): string | null {
  if (!html) return null;
  const match = html.match(/href=["']([^"']+)["']/);
  if (!match) return null;

  let link = match[1];
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

/**
 * 解析通道类型
 */
function parseChannelType(html: string): boolean | null {
  if (!html) return null;
  const text = cleanText(html);
  if (!text || text === '-' || text.trim() === '') return null;
  if (text.includes('通道') && !text.includes('非')) return true;
  if (text.includes('非通道')) return false;
  return null;
}

/**
 * 提取年份
 */
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

/**
 * 解析日期
 */
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

/**
 * 根据正则模式提取内容
 */
function extractByPattern(html: string, pattern: RegExp): string | null {
  if (!html) return null;
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}

/**
 * 解析HTML表格数据
 */
function parseHtmlTable(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];
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
    console.error('表格解析失败:', error);
  }
  return transactions;
}

/**
 * 解析HTML列表数据
 */
function parseHtmlList(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];
  try {
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

/**
 * 解析HTML数据
 */
function parseHtmlData(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const tableTransactions = parseHtmlTable(html, urlId, userId, baseUrl);
  if (tableTransactions.length > 0) return tableTransactions;

  const listTransactions = parseHtmlList(html, urlId, userId, baseUrl);
  if (listTransactions.length > 0) return listTransactions;

  return [];
}

/**
 * 带重试的抓取函数（指数退避）
 */
async function scrapeWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<{ html: string; success: boolean }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return { html, success: true };
    } catch (error) {
      console.error(`抓取失败 (尝试 ${attempt + 1}/${maxRetries}):`, error.message);

      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('抓取失败');
}

/**
 * 处理增量抓取和去重
 */
async function processIncrementalScrape(
  supabaseClient: any,
  urlId: string,
  userId: string,
  url: string
): Promise<{
  newRecords: any[];
  updatedRecords: any[];
  duplicateCount: number;
  totalRecords: number;
}> {
  // 1. 抓取网页数据
  const { html } = await scrapeWithRetry(url);

  // 2. 解析HTML数据
  const allTransactions = parseHtmlData(html, urlId, userId, url);

  if (allTransactions.length === 0) {
    return {
      newRecords: [],
      updatedRecords: [],
      duplicateCount: 0,
      totalRecords: 0,
    };
  }

  // 3. 为所有记录生成哈希
  const transactionsWithHash = await Promise.all(
    allTransactions.map(async (transaction) => ({
      ...transaction,
      data_hash: await generateDataHash(transaction),
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    }))
  );

  // 4. 查询已存在的哈希
  const hashes = transactionsWithHash.map(t => t.data_hash);
  const { data: existingRecords, error: queryError } = await supabaseClient
    .from('transactions')
    .select('id, data_hash')
    .eq('user_id', userId)
    .eq('url_id', urlId)
    .in('data_hash', hashes);

  if (queryError) {
    console.error('查询已存在记录失败:', queryError);
    throw queryError;
  }

  const existingHashes = new Set(existingRecords?.map(r => r.data_hash) || []);

  // 5. 分类处理
  const newRecords = transactionsWithHash.filter(t => !existingHashes.has(t.data_hash));
  const duplicateCount = transactionsWithHash.length - newRecords.length;

  // 6. 插入新记录
  if (newRecords.length > 0) {
    const { error: insertError } = await supabaseClient
      .from('transactions')
      .insert(newRecords);

    if (insertError) {
      console.error('插入新记录失败:', insertError);
      throw insertError;
    }
  }

  return {
    newRecords,
    updatedRecords: [],
    duplicateCount,
    totalRecords: allTransactions.length,
  };
}

/**
 * 记录抓取日志
 */
async function logScrapingResult(
  supabaseClient: any,
  userId: string,
  urlId: string,
  result: ScrapingResult
): Promise<void> {
  const { error } = await supabaseClient.from('scraping_logs').insert({
    user_id: userId,
    url_id: urlId,
    status: result.status,
    message: result.error || '抓取完成',
    records_count: result.recordsCount,
    new_records_count: result.newRecordsCount,
    updated_records_count: result.updatedRecordsCount,
    duplicate_count: result.duplicateCount,
    duration_ms: result.durationMs,
    error_details: result.error ? { message: result.error } : null,
  });

  if (error) {
    console.error('记录抓取日志失败:', error);
  }
}

/**
 * 更新URL表中的抓取统计
 */
async function updateUrlStats(
  supabaseClient: any,
  urlId: string,
  result: ScrapingResult
): Promise<void> {
  const updates: any = {
    last_scraped_at: new Date().toISOString(),
    last_scrape_status: result.status,
    total_scrape_count: supabaseClient.rpc('increment', { x: 1 }),
  };

  if (result.status === 'error') {
    updates.last_error_message = result.error;
  } else {
    updates.total_new_records_count = supabaseClient.rpc('increment', {
      x: result.newRecordsCount
    });
    updates.last_error_message = null;
  }

  const { error } = await supabaseClient
    .from('urls')
    .update(updates)
    .eq('id', urlId);

  if (error) {
    console.error('更新URL统计失败:', error);
  }
}

// ==================== 主处理逻辑 ====================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // 获取当前用户（如果是手动触发）
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // 解析请求体
    const { userId, urlId }: AutoScrapeRequest = await req.json();

    // 确定要抓取的用户ID
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`开始自动抓取: userId=${targetUserId}, urlId=${urlId || '全部'}`);

    // 查询要抓取的URL
    let urlsQuery = supabaseClient
      .from('urls')
      .select('id, url')
      .eq('user_id', targetUserId)
      .eq('is_auto_scrape', true);

    if (urlId) {
      urlsQuery = urlsQuery.eq('id', urlId);
    }

    const { data: urls, error: urlsError } = await urlsQuery;

    if (urlsError) {
      throw urlsError;
    }

    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '没有需要抓取的网址',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`找到 ${urls.length} 个需要抓取的网址`);

    // 并发抓取所有网址
    const results: ScrapingResult[] = await Promise.all(
      urls.map(async (urlData) => {
        const urlStartTime = Date.now();
        try {
          console.log(`开始抓取: ${urlData.url}`);

          // 执行增量抓取
          const scrapeResult = await processIncrementalScrape(
            supabaseClient,
            urlData.id,
            targetUserId,
            urlData.url
          );

          const result: ScrapingResult = {
            urlId: urlData.id,
            url: urlData.url,
            status: 'success',
            recordsCount: scrapeResult.totalRecords,
            newRecordsCount: scrapeResult.newRecords.length,
            updatedRecordsCount: scrapeResult.updatedRecords.length,
            duplicateCount: scrapeResult.duplicateCount,
            durationMs: Date.now() - urlStartTime,
          };

          console.log(`抓取成功: ${urlData.url}, 新增: ${result.newRecordsCount}, 重复: ${result.duplicateCount}`);

          // 记录日志
          await logScrapingResult(supabaseClient, targetUserId, urlData.id, result);

          // 更新URL统计
          await updateUrlStats(supabaseClient, urlData.id, result);

          // 如果有新数据，发送通知
          if (result.newRecordsCount > 0) {
            try {
              await supabaseClient.functions.invoke('send-notification', {
                body: {
                  userId: targetUserId,
                  type: 'new_data',
                  title: `抓取成功：发现 ${result.newRecordsCount} 条新数据`,
                  message: `从 ${urlData.url} 抓取到 ${result.newRecordsCount} 条新数据`,
                  metadata: {
                    urlId: urlData.id,
                    url: urlData.url,
                    newRecordsCount: result.newRecordsCount,
                    scrapeDuration: result.durationMs,
                  },
                },
              });
            } catch (notifyError) {
              console.error('发送通知失败:', notifyError);
            }
          }

          return result;
        } catch (error) {
          console.error(`抓取失败: ${urlData.url}`, error);

          const result: ScrapingResult = {
            urlId: urlData.id,
            url: urlData.url,
            status: 'error',
            recordsCount: 0,
            newRecordsCount: 0,
            updatedRecordsCount: 0,
            duplicateCount: 0,
            durationMs: Date.now() - urlStartTime,
            error: error.message || '未知错误',
          };

          // 记录错误日志
          await logScrapingResult(supabaseClient, targetUserId, urlData.id, result);

          // 更新URL统计
          await updateUrlStats(supabaseClient, urlData.id, result);

          // 发送失败通知
          try {
            await supabaseClient.functions.invoke('send-notification', {
              body: {
                userId: targetUserId,
                type: 'scraping_error',
                title: '抓取失败',
                message: `从 ${urlData.url} 抓取数据失败: ${error.message}`,
                metadata: {
                  urlId: urlData.id,
                  url: urlData.url,
                  error: error.message,
                },
              },
            });
          } catch (notifyError) {
            console.error('发送失败通知失败:', notifyError);
          }

          return result;
        }
      })
    );

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const totalNewRecords = results.reduce((sum, r) => sum + r.newRecordsCount, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `抓取完成: ${successCount} 成功, ${errorCount} 失败, 共 ${totalNewRecords} 条新数据`,
        results,
        summary: {
          totalDuration,
          successCount,
          errorCount,
          totalNewRecords,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('自动抓取失败:', error);
    return new Response(
      JSON.stringify({
        error: '自动抓取失败',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
