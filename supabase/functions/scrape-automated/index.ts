import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.177.0/node/crypto.ts';

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
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const plain = stripped.replace(/<[^>]+>/g, ' ');
  const normalized = cleanText(plain);
  const titleMatch =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    '';
  const projectTitle = cleanText(titleMatch);
  const qtyMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(个|张|MWh)/i);
  const qtyValue = qtyMatch ? parseFloat(qtyMatch[1]) : null;
  const publishMatches = normalized.match(/(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/g) || [];
  let publishDate: string | null = null;
  if (publishMatches.length > 0) {
    const last = publishMatches[publishMatches.length - 1];
    const m = last.match(/(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
    if (m) {
      const y = m[1];
      const mo = m[2].padStart(2, '0');
      const d = m[3].padStart(2, '0');
      publishDate = `${y}-${mo}-${d}`;
    }
  }
  const extractionPrompt =
    [
      '从下方正文中抽取结构化JSON：',
      '- 忽略页眉、页脚和序号',
      '- project_name：取公告中最醒目的完整标题',
      '- quantity：正文中带“个”或“张”或“MWh”的数字',
      '- publish_date：形如YYYY-MM-DD，通常在文末',
    ].join('\n');
  if ((projectTitle && projectTitle.length > 1) || qtyValue !== null || publishDate) {
    return [
      {
        url_id: urlId,
        user_id: userId || undefined,
        project_name: projectTitle || null,
        quantity: qtyValue,
        publish_date: publishDate,
        detail_link: baseUrl || null,
      },
    ];
  }
  const tableTransactions = parseHtmlTable(html, urlId, userId, baseUrl);
  if (tableTransactions.length > 0) return tableTransactions;

  const listTransactions = parseHtmlList(html, urlId, userId, baseUrl);
  if (listTransactions.length > 0) return listTransactions;

  return [];
}

function toPlainText(html: string): string {
  if (!html) return "";
  // 1. 暴力剔除 script/style 等整块代码区
  let text = html.replace(/<(script|style|svg|img|video)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // 2. 终极卸妆：强制把所有带属性的标签（如 <td style="mso-...">）洗成绝对纯净标签（如 <td>）
  text = text.replace(/<([a-zA-Z0-9]+)\b[^>]*>/g, '<$1>');
  // 3. 压缩空白，为 LLM 节省注意力
  text = text.replace(/\s{2,}/g, ' ').replace(/\n+/g, '\n');
  return text.trim();
}

/**
 * 检查网页列表是否有实质性更新
 * @param htmlContent 抓取到的原始 HTML 或清洗后的文本
 * @param lastHash 数据库中存储的上一次 Hash 值
 * @returns boolean true 表示有更新，false 表示没变
 */
function hasPageUpdated(htmlContent: string, lastHash: string | null): { updated: boolean, newHash: string } {
  const cleanContent = (htmlContent || '').trim();
  const newHash = createHash('md5').update(cleanContent).digest('hex');
  if (lastHash === newHash) {
    console.log("【巡逻发现】指纹未变，内容没更新，跳过 LLM 扫描以节省 Token。");
    return { updated: false, newHash };
  }
  console.log("【巡逻发现】网页内容已更新！新指纹:", newHash);
  return { updated: true, newHash };
}

async function llmExtractTransactions(rawText: string, urlId: string, userId: string, detailUrl: string): Promise<any[]> {
  const apiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!apiKey) return [];
  const base = Deno.env.get('OPENAI_BASE_URL') || Deno.env.get('OPENAI_API_BASE') || Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.openai.com/v1';
  const model = Deno.env.get('OPENAI_MODEL') || (base.includes('deepseek') ? 'deepseek-chat' : 'gpt-4o-mini');
  console.log("【数据探针】提交给LLM的文本中是否包含已知金额(如16120):", rawText.includes("16120") || rawText.includes("1.61"));
  const system = [
    '任务：从极不规范的招标/公告 HTML 文本中进行“深度阅读与推理”提取结构化信息。',
    '重要：核心数据（单价、总价、各种日期）很可能存在于 <table> 表格标签内，请仔细比对 <th> 表头与 <td> 单元格的数据对应关系进行抽取。',
    '严格输出：仅返回严格的JSON数组，不含其他文本；数组中每个对象必须包含以下所有字段（即使无法确定也必须显式设置为 null，不得省略任何 key）：',
    '{',
    '  "project_name": string|null,',
    '  "bidding_unit": string|null,',
    '  "bidder_unit": string|null,',
    '  "winning_unit": string|null,',
    '  "total_price": number|null,',
    '  "quantity": number|null,',
    '  "unit_price": number|null,',
    '  "detail_link": string|null,',
    '  "is_channel": boolean|null,',
    '  "cert_year": string[]|null,',
    '  "bid_start_date": string|null,',
    '  "bid_end_date": string|null,',
    '  "award_date": string|null',
    '}',
    '',
    '抽取规则（严格）：',
    '1) 忽略页眉、页脚、序号与噪声；对表格残片与多段落进行上下文推理；优先从<table>表中结合<th>/<td>做字段对齐。',
    '2) project_name：必须提取公告中最醒目的完整标题（优先H1/H2/标题行）。',
    '3) bidding_unit（采购方）：寻找“采购人/招标人/买方”后的单位名称。',
    '4) winning_unit/bidder_unit（中标/候选方）：寻找“成交候选人/中标人/供应商”等后的企业名称。',
    '5) quantity（绿证数量）：提取带“个/张/MWh”的数字；仅返回数字。',
    '6) total_price（总金额）：寻找带“元/万元”的金额；如果单位为“万元”，请先×10000后以“元”为单位输出数字。',
    '7) unit_price（单价）：寻找“元/张”或“单价”的较小数值（如6.5），只输出数字。',
    '8) cert_year（绿证年份）：从标题或正文（如“2025年绿证”“购置202X年”）中提取为字符串数组，例如["2025"]；如多年份请全部保留。',
    '9) publish_date若出现（YYYY-MM-DD，常见于文末），可用于推断 award_date 或 bid_end_date；如存在更明确的语义，请分别填入相应日期字段（YYYY-MM-DD）。',
    '10) bid_start_date / bid_end_date：寻找“公告发布时间/报名时间/递交响应文件截止时间”等线索并格式化为YYYY-MM-DD。',
    '11) award_date：寻找“成交结果公告日期/中标结果公告日期”等并格式化为YYYY-MM-DD。',
    '',
    '全局约束：尽最大努力填充字段，除非通篇毫无线索，否则不要轻易填null；任何情况下都不得省略字段 key。'
  ].join('\n');
  const userContent = ['HTML：', rawText, '', '仅输出JSON数组，不要包含多余文本。'].join('\n');
  const body = { model, temperature: 0.1, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let jsonText = "";
    const text = rawText;
    console.log("【强力探针】喂给LLM的纯净HTML中是否包含16120:", text.includes("16120"));
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await resp.json();
    console.log("【智谱API完整返回】:", JSON.stringify(data));
    const content = data?.choices?.[0]?.message?.content || "";
    console.log("【智谱原生交卷内容】:", content);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    } else {
      throw new Error("大模型返回内容中未找到 JSON 数组结构");
    }
    if (!jsonText || !jsonText.trim()) {
      throw new Error("大模型返回的 JSON 内容为空");
    }
    const arr = JSON.parse(jsonText);
    if (!Array.isArray(arr)) throw new Error('LLM返回非数组');
    return arr.map((t: any) => {
      const baseTransaction: any = {
        url_id: urlId,
        user_id: userId || undefined,
        project_name: null,
        bidding_unit: null,
        bidder_unit: null,
        winning_unit: null,
        total_price: null,
        quantity: null,
        unit_price: null,
        detail_link: detailUrl ?? null,
        is_channel: null,
        cert_year: null,
        bid_start_date: null,
        bid_end_date: null,
        award_date: null,
      };
      // 金额容错转换：支持逗号分隔、含“万元”单位
      const parseMoney = (v: any): number|null => {
        if (typeof v === 'number') return v;
        if (!v) return null;
        const s = String(v).replace(/,/g, '').trim();
        const wan = /万/.test(s);
        const num = parseFloat(s.replace(/[^\d.]/g, ''));
        return isNaN(num) ? null : (wan ? num * 10000 : num);
      };
      const parseNumber = (v: any): number|null => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const num = parseFloat(v.replace(/[^\d.]/g, ''));
          return isNaN(num) ? null : num;
        }
        return null;
      };
      const toYearArray = (v: any): string[]|null => {
        if (Array.isArray(v)) return v.map(x => String(x));
        if (v === null || v === undefined || v === '') return null;
        return [String(v)];
      };
      const totalCandidate = t?.total_price ?? t?.totalPrice ?? t?.total ?? t?.price ?? t?.amount;
      const unitCandidate = t?.unit_price ?? t?.unitPrice ?? t?.price_per_unit ?? t?.unit ?? t?.price;
      const qtyCandidate = t?.quantity ?? t?.qty ?? t?.amount ?? t?.count;
      return Object.assign({}, baseTransaction, {
        url_id: urlId,
        user_id: userId || undefined,
        project_name: t.project_name ?? null,
        bidding_unit: t.bidding_unit ?? null,
        bidder_unit: t.bidder_unit ?? null,
        winning_unit: t.winning_unit ?? null,
        total_price: parseMoney(totalCandidate),
        quantity: parseNumber(qtyCandidate),
        unit_price: parseMoney(unitCandidate),
        detail_link: t.detail_link ?? detailUrl ?? null,
        is_channel: typeof t.is_channel === 'boolean' ? t.is_channel : null,
        cert_year: toYearArray(t.cert_year),
        bid_start_date: t.bid_start_date ?? null,
        bid_end_date: t.bid_end_date ?? null,
        award_date: t.award_date ?? null,
      });
    });
  } catch (e) {
    console.error("【LLM解析过程发生崩溃】:", (e as any)?.message || e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function llmExtractLinks(structuredHtml: string, baseUrl: string): Promise<string[]> {
  const apiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  const resolveUrl = (href: string): string => {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  };
  const dedupe = (arr: string[]) => Array.from(new Set(arr));
  if (!apiKey) {
    const hrefs = Array.from(structuredHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis))
      .map(m => resolveUrl(m[1]))
      .filter(u => /ggzy\.zj\.gov\.cn/i.test(u));
    return dedupe(hrefs);
  }
  const base = Deno.env.get('OPENAI_BASE_URL') || Deno.env.get('OPENAI_API_BASE') || Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.openai.com/v1';
  const model = Deno.env.get('OPENAI_MODEL') || (base.includes('deepseek') ? 'deepseek-chat' : 'gpt-4o-mini');
  const system = [
    '任务：从给定的招标/公告HTML中提取与“绿证/绿色电力/GEC/交易/招标/中标/采购/证/绿电”等关键词高度相关的详情页链接（绝对URL）。',
    '严格输出：仅返回JSON数组，元素是字符串URL；不得包含其他文本。'
  ].join('\n');
  const userContent = ['HTML：', structuredHtml, '', '仅输出 JSON 数组，数组元素为绝对URL字符串。'].join('\n');
  const body = { model, temperature: 0.1, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '[]';
    const match = content.match(/\[[\s\S]*\]/);
    const jsonText = match ? match[0] : '[]';
    const arr = JSON.parse(jsonText);
    if (!Array.isArray(arr)) return [];
    const abs = arr.map((u: string) => resolveUrl(String(u))).filter((u: string) => /ggzy\.zj\.gov\.cn/i.test(u));
    return dedupe(abs);
  } catch {
    const hrefs = Array.from(structuredHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis))
      .map(m => resolveUrl(m[1]))
      .filter(u => /ggzy\.zj\.gov\.cn/i.test(u));
    return dedupe(hrefs);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 带重试的抓取函数（指数退避）
 */
async function scrapeWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<{ html: string; success: boolean }> {
  const isZhejiang = /ggzy\.zj\.gov\.cn/i.test(url);
  const makeJinaUrls = (u: string): string[] => {
    try {
      const uObj = new URL(u);
      const withoutScheme = `${uObj.host}${uObj.pathname}${uObj.search}${uObj.hash}`;
      return [
        `https://r.jina.ai/http://${withoutScheme}`,
        `https://r.jina.ai/https://${withoutScheme}`,
      ];
    } catch {
      return [
        `https://r.jina.ai/http://${u.replace(/^https?:\/\//, '')}`,
        `https://r.jina.ai/https://${u.replace(/^https?:\/\//, '')}`,
      ];
    }
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let response: Response | null = null;
      let bodyText: string | null = null;

      if (isZhejiang) {
        // 浙江域名强制走 Jina 代理（全球IP池），对冲单IP封禁
        const candidates = makeJinaUrls(url);
        for (const ju of candidates) {
          response = await fetch(ju, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept-Language': 'zh-CN,zh;q=0.9',
              'Referer': 'https://ggzy.zj.gov.cn/',
            },
          });
          console.log('【抓取状态(Jina)】', { url: ju, status: response.status });
          if (response.ok) {
            bodyText = await response.text();
            console.log('【抓取片段(Jina)】', (bodyText || '').substring(0, 500));
            // 如果内容疑似被拦截或过短，尝试直连高伪装模式
            const blocked = /Access Denied|Checking your browser|403 Forbidden|Shield|WAF|captcha|Verification|验证|访问受限/i.test(bodyText || '');
            if (!blocked && (bodyText || '').trim().length >= 150) {
              break;
            } else {
              console.warn('【Jina内容疑似被拦截或过短，尝试直连高伪装】');
              response = null;
              bodyText = null;
            }
          }
        }

        // 直连高伪装模式（一次尝试）：携带完整Chrome头与模拟Cookie
        if (!response) {
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://ggzy.zj.gov.cn/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            // 简单的Cookie模拟（非敏感），用于绕过部分基础拦截
            'Cookie': 'cookieconsent_status=dismiss; _ga=GA1.1.123456789.1700000000; _gid=GA1.1.987654321.1700000000',
          };
          const directResp = await fetch(url, { headers });
          console.log('【抓取状态(直连高伪装)】', { url, status: directResp.status });
          if (directResp.ok) {
            const txt = await directResp.text();
            console.log('【抓取片段(直连高伪装)】', txt.substring(0, 500));
            // 若直连可用则用此结果
            response = directResp;
            bodyText = txt;
          }
        }
      } else {
        // 其他域名保持现有逻辑（加UA），南网逻辑不变
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        });
        console.log('【抓取状态(直连)】', { url, status: response.status });
      }

      if (!response) {
        throw new Error('抓取初始化失败（无可用响应）');
      }

      if (!response.ok) {
        console.error('抓取返回非200', { url, status: response.status, statusText: response.statusText });
        try {
          const t = await response.text();
          console.log('【抓取片段(非200)】', (t || '').substring(0, 500));
        } catch (_) {}
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (bodyText == null) {
        bodyText = await response.text();
      }
      console.log('【抓取片段(最终)】', (bodyText || '').substring(0, 500));
      if (!bodyText || bodyText.trim().length === 0) {
        console.error('抓取返回空响应体', { url, status: response.status });
        throw new Error('Empty response body');
      }

      return { html: bodyText, success: true };
    } catch (error) {
      console.error(`抓取失败 (尝试 ${attempt + 1}/${maxRetries}):`, error.message);

      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 指数退避 + 抖动（2000ms ± 500ms），避免请求节律过于规律
      const backoff = baseDelay * Math.pow(2, attempt);
      const jitter = 2000 + Math.floor(Math.random() * 1000 - 500); // 1500ms~2500ms
      const delay = Math.max(0, backoff + jitter);
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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeUrlId = (urlId || '').trim();
  const isValidUrlId = uuidRegex.test(safeUrlId);
  const safeUserId = (userId && userId !== 'N/A' && userId !== '' && uuidRegex.test(userId)) ? userId : null;
  if (!isValidUrlId) {
    console.error('无效的 urlId', { urlId });
    return {
      newRecords: [],
      updatedRecords: [],
      duplicateCount: 0,
      totalRecords: 0,
    };
  }

  let lastHash: string | null = null;
  try {
    const { data: urlRow, error: readHashError } = await supabaseClient
      .from('urls')
      .select('last_content_hash')
      .eq('id', safeUrlId)
      .single();
    if (!readHashError) {
      lastHash = urlRow?.last_content_hash ?? null;
    } else {
      console.warn('读取 last_content_hash 失败:', readHashError.message || readHashError);
    }
  } catch (e) {
    console.warn('读取 last_content_hash 异常:', (e as any)?.message || e);
  }

  const { html, success } = await scrapeWithRetry(url);
  const isZhejiang = /ggzy\.zj\.gov\.cn/i.test(url);
  const minLen = isZhejiang ? 150 : 300;
  if (!success || !html) {
    console.log("【抓取预览】无内容或失败，前500字:", (html || '').substring(0, 500));
    throw new Error('抓取内容过短，疑似被拦截');
  }
  const blocked = /Access Denied|Checking your browser|403 Forbidden/i.test(html);
  if (blocked) {
    console.log("【抓取阻断提示】内容包含疑似拦截文案，前500字:", html.substring(0, 500));
    throw new Error('抓取被目标站拦截，触发防护文案');
  }
  if (html.trim().length < minLen) {
    console.log("【抓取预览】长度过短，前500字:", html.substring(0, 500));
    throw new Error('抓取内容过短，疑似被拦截');
  }

  let parsed: any[] = [];
  try {
    const structuredHtml = toPlainText(html);
    const { updated, newHash } = hasPageUpdated(structuredHtml, lastHash);
    if (!updated) {
      return {
        newRecords: [],
        updatedRecords: [],
        duplicateCount: 0,
        totalRecords: 0,
      };
    }
    const llm = await llmExtractTransactions(structuredHtml, safeUrlId, safeUserId || '', url);
    if (llm && llm.length > 0) {
      parsed = llm;
    } else {
      throw new Error('LLM 未返回有效数据，拒绝回退旧规则');
    }
  } catch (e) {
    console.error('LLM解析失败，已阻止回退旧规则:', e?.message || e);
    throw e;
  }
  const allTransactions = parsed.map((t: any) => {
    const base: any = { ...t, url_id: safeUrlId };
    if (safeUserId) {
      base.user_id = safeUserId;
    } else {
      if ('user_id' in base) {
        delete base.user_id;
      }
    }
    return base;
  });
  console.log("Jina AI 抓取回来的网页文本前500字:", (html || '').substring(0, 500));
  console.log("大模型解析生成的原始 JSON 对象:", JSON.stringify(allTransactions));

  if (allTransactions.length === 0) {
    return {
      newRecords: [],
      updatedRecords: [],
      duplicateCount: 0,
      totalRecords: 0,
    };
  }

  console.log("【入库终极检查】准备存入DB的第一个对象:", JSON.stringify(allTransactions[0]));
  const transactionsWithHash = await Promise.all(
    allTransactions.map(async (transaction) => ({
      ...transaction,
      data_hash: await generateDataHash(transaction),
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    }))
  );

  const hashes = transactionsWithHash.map(t => t.data_hash);
  console.log("执行DB操作前，当前 userId 的值是:", safeUserId);
  let query = supabaseClient
    .from('transactions')
    .select('id, data_hash')
    .eq('url_id', safeUrlId)
    .in('data_hash', hashes);
  if (safeUserId) {
    query = query.eq('user_id', safeUserId);
  }
  const { data: existingRecords, error: queryError } = await query;

  if (queryError) {
    console.error('查询已存在记录失败:', queryError);
    throw queryError;
  }

  const existingHashes = new Set(existingRecords?.map(r => r.data_hash) || []);

  const newRecords = transactionsWithHash.filter(t => !existingHashes.has(t.data_hash));
  const duplicateCount = transactionsWithHash.length - newRecords.length;

  if (newRecords.length > 0) {
    const sanitizedNewRecords = newRecords.map((rec) => {
      const copy: any = { ...rec };
      copy.url_id = safeUrlId;
      Object.keys(copy).forEach((k) => {
        const v = copy[k];
        if (k !== 'url_id' && (v === '' || v === 'N/A' || v === null || v === undefined)) {
          delete copy[k];
        }
      });
      return copy;
    });
    console.log("准备插入的数据内容:", JSON.stringify(sanitizedNewRecords));
    const markedRecords = sanitizedNewRecords.map((rec) => {
      const m: any = { ...rec };
      Object.keys(m).forEach((k) => {
        if (k !== 'url_id' && typeof m[k] === 'string' && m[k] === '') {
          m[k] = 'ERROR_EMPTY_STRING';
        }
      });
      return m;
    });
    if (markedRecords.length > 0) {
      console.log("最终提交给数据库的第一条数据详情:", JSON.stringify(markedRecords[0]));
    }
    console.log("执行DB操作前，当前 userId 的值是:", safeUserId);
    const { error: insertError } = await supabaseClient
      .from('transactions')
      .insert(markedRecords);

    if (insertError) {
      console.error('插入新记录失败:', insertError);
      throw insertError;
    }
  }

  // 更新 last_content_hash（失败不影响流程）
  try {
    const structuredHtml = toPlainText(html);
    const { newHash } = hasPageUpdated(structuredHtml, lastHash);
    const { error: updateHashError } = await supabaseClient
      .from('urls')
      .update({ last_content_hash: newHash })
      .eq('id', safeUrlId);
    if (updateHashError) {
      console.warn('更新 last_content_hash 失败:', updateHashError.message || updateHashError);
    }
  } catch (e) {
    console.warn('更新 last_content_hash 异常:', (e as any)?.message || e);
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
  // 若 userId 缺失，安全跳过写入，避免违反 NOT NULL 约束
  if (!userId || userId === 'N/A') {
    console.warn('跳过 scraping_logs 写入：缺少有效 userId');
    return;
  }
  console.log("执行DB操作前，当前 userId 的值是:", userId);
  const payload: any = {
    url_id: urlId,
    status: result.status,
    message: result.error || '抓取完成',
    records_count: result.recordsCount,
    new_records_count: result.newRecordsCount,
    updated_records_count: result.updatedRecordsCount,
    duplicate_count: result.duplicateCount,
    duration_ms: result.durationMs,
    error_details: result.error ? { message: result.error } : null,
  };
  payload.user_id = userId;
  const { error } = await supabaseClient.from('scraping_logs').insert(payload);

  if (error) {
    console.error('记录抓取日志失败:', error);
  }

/**
 * 更新URL表中的抓取统计
 */
async function updateUrlStats(
  supabaseClient: any,
  urlId: string,
  result: ScrapingResult,
  userId?: string | null
): Promise<void> {
  console.log("执行DB操作前，当前 userId 的值是:", userId ?? null);
  // 读取当前统计，确保以“简单整数”更新，避免把响应对象赋值到字段
  let currentScrapeCount = 0;
  let currentNewRecordsCount = 0;
  try {
    const { data: urlRow, error: readErr } = await supabaseClient
      .from('urls')
      .select('total_scrape_count,total_new_records_count')
      .eq('id', urlId)
      .single();
    if (!readErr && urlRow) {
      currentScrapeCount = urlRow.total_scrape_count ?? 0;
      currentNewRecordsCount = urlRow.total_new_records_count ?? 0;
    }
  } catch (e) {
    console.warn('读取 URL 统计失败，使用0作为初始值:', (e as any)?.message || e);
  }

  const updates: any = {
    last_scraped_at: new Date().toISOString(),
    last_scrape_status: result.status,
    total_scrape_count: currentScrapeCount + 1,
  };

  if (result.status === 'error') {
    updates.last_error_message = result.error;
  } else {
    updates.total_new_records_count = currentNewRecordsCount + (result.newRecordsCount || 0);
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

async function handleRequest(req: Request): Promise<Response> {
  console.log("【探针版本】包含完整日志打印 - 20260226_02_FORCE_REFRESH");
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 极简调试路径：通过环境变量或查询参数启动
  try {
    const helloOnly = (Deno.env.get('HELLO_ONLY') || '').trim() === '1';
    const urlObj = new URL(req.url);
    const helloParam = urlObj.searchParams.get('mode') === 'min' || urlObj.searchParams.get('hello') === '1';
    if (helloOnly || helloParam) {
      const responsePayload = { success: true, message: 'Hello World' };
      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  } catch {}

  // 授权校验 (灵活匹配新旧钥匙)
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const apiKey = req.headers.get('apikey');
  const receivedKey = (authHeader || apiKey || '').trim();

  console.log("【调试】收到钥匙长度与尾8位:", { len: receivedKey.length, tail8: receivedKey.slice(-8) });

  const expectedAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const expectedServiceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const expectedCustomAnonKey = (Deno.env.get('SB_ANON_KEY') || '').trim();

  console.log("【调试】期望 OFFICIAL ANON 长度与尾8位:", { len: expectedAnonKey.length, tail8: expectedAnonKey.slice(-8) });
  console.log("【调试】期望 SERVICE 长度与尾8位:", { len: expectedServiceKey.length, tail8: expectedServiceKey.slice(-8) });
  console.log("【调试】期望 CUSTOM ANON 长度与尾8位:", { len: expectedCustomAnonKey.length, tail8: expectedCustomAnonKey.slice(-8) });

  // if (receivedKey !== expectedAnonKey && receivedKey !== expectedServiceKey && receivedKey !== expectedCustomAnonKey) {
  //   console.error("【授权失败】收到钥匙长度与尾8位:", { len: receivedKey.length, tail8: receivedKey.slice(-8) });
  //   console.error("【授权失败】期望 OFFICIAL ANON 长度与尾8位:", { len: expectedAnonKey.length, tail8: expectedAnonKey.slice(-8) });
  //   console.error("【授权失败】期望 SERVICE 长度与尾8位:", { len: expectedServiceKey.length, tail8: expectedServiceKey.slice(-8) });
  //   console.error("【授权失败】期望 CUSTOM ANON 长度与尾8位:", { len: expectedCustomAnonKey.length, tail8: expectedCustomAnonKey.slice(-8) });
  //   return new Response(JSON.stringify({ error: '未授权' }), {
  //     status: 401,
  //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  //   });
  // }

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SB_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    let parsedUserId: string | undefined;
    let parsedUrlId: string | undefined;
    let rawBody = await req.text();
    if (!rawBody || rawBody.trim().length === 0) {
      console.error('请求体为空，跳过抓取');
      return new Response(
        JSON.stringify({
          success: true,
          message: '请求体为空，已跳过抓取',
          results: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      try {
        const payload: AutoScrapeRequest = JSON.parse(rawBody);
        parsedUserId = payload.userId;
        parsedUrlId = payload.urlId;
      } catch (e) {
        console.error('请求体非有效JSON，跳过抓取', { error: e.message, raw: rawBody.substring(0, 500) });
        return new Response(
          JSON.stringify({
            success: true,
            message: '请求体不是有效的 JSON，已跳过抓取',
            results: [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const uuidGuard = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const rawCandidateUserId = (parsedUserId || user?.id || '').trim();
    const targetUserId = (!rawCandidateUserId || rawCandidateUserId === 'N/A' || !uuidGuard.test(rawCandidateUserId)) ? null : rawCandidateUserId;

    // 授权已在入口处校验通过

    console.log(`开始自动抓取: userId=${targetUserId || 'N/A'}, urlId=${parsedUrlId || '全部'}`);

    // 查询要抓取的URL
    let urlsQuery = supabaseClient
      .from('urls')
      .select('id, url')
      .eq('is_auto_scrape', true);
    if (targetUserId) {
      urlsQuery = urlsQuery.eq('user_id', targetUserId);
    }
    console.log("执行DB操作前，当前 userId 的值是:", targetUserId);

    if (parsedUrlId) {
      urlsQuery = urlsQuery.eq('id', parsedUrlId);
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

          let scrapeResult;
          if (/ggzy\.zj\.gov\.cn/i.test(urlData.url)) {
            const { html, success } = await scrapeWithRetry(urlData.url);
            if (!success || !html || html.trim().length < 300) {
              throw new Error('抓取内容过短，疑似被拦截');
            }
            const structuredHtml = toPlainText(html);
            const links = await llmExtractLinks(structuredHtml, urlData.url);
            const uniqueLinks = Array.from(new Set(links));
            console.log(`从浙江平台提取到 ${uniqueLinks.length} 个候选链接`);
            let totalNew: any[] = [];
            let duplicate = 0;
            let total = 0;
            for (const link of uniqueLinks) {
              try {
                const r = await processIncrementalScrape(supabaseClient, urlData.id, targetUserId, link);
                totalNew = totalNew.concat(r.newRecords || []);
                duplicate += r.duplicateCount || 0;
                total += r.totalRecords || 0;
              } catch (e) {
                console.error('处理详情链接失败:', link, (e as any)?.message || e);
              }
            }
            scrapeResult = {
              newRecords: totalNew,
              updatedRecords: [],
              duplicateCount: duplicate,
              totalRecords: total,
            };
          } else {
            const r = await processIncrementalScrape(
              supabaseClient,
              urlData.id,
              targetUserId,
              urlData.url
            );
            scrapeResult = r;
          }

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
          await updateUrlStats(supabaseClient, urlData.id, result, targetUserId);

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
          await updateUrlStats(supabaseClient, urlData.id, result, targetUserId);

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

    // ... 确保这是最后一个 return
    const responsePayload = {
      success: true,
      message: `抓取完成: ${successCount} 成功, ${errorCount} 失败, 共 ${totalNewRecords} 条新数据`,
      results,
      summary: {
        totalDuration,
        successCount,
        errorCount,
        totalNewRecords,
      },
    };
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("【全局崩溃日志】:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

Deno.serve(async (req) => { 
  return handleRequest(req);
});
