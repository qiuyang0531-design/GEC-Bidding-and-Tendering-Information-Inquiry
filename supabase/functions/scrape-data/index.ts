import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// 从 JWT token 中提取 payload（不验证签名，只提取数据）
function extractJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payloadBase64 = parts[1];

    // 使用 Deno 内置的 base64 解码
    const binaryString = atob(payloadBase64);
    const payload = JSON.parse(binaryString);

    return payload;
  } catch (e) {
    console.error('Failed to extract JWT payload (method 1):', e.message);

    // 如果直接解析失败，尝试修复 base64 padding
    try {
      const parts = token.split('.');
      let base64 = parts[1];

      // 添加缺失的 padding
      while (base64.length % 4) {
        base64 += '=';
      }

      const binaryString = atob(base64);
      const payload = JSON.parse(binaryString);

      console.log('Successfully parsed with added padding');
      return payload;
    } catch (e2) {
      console.error('Failed to extract JWT payload (method 2):', e2.message);

      // 最后尝试：使用 TextDecoder
      try {
        const parts = token.split('.');
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

        while (base64.length % 4) {
          base64 += '=';
        }

        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const decoded = new TextDecoder('utf-8').decode(bytes);
        const payload = JSON.parse(decoded);

        console.log('Successfully parsed with TextDecoder');
        return payload;
      } catch (e3) {
        console.error('Failed to extract JWT payload (method 3):', e3.message);
        console.error('All methods failed');
        return null;
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders }); 
  }

  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const apiKey = req.headers.get('apikey');
  const receivedKey = (authHeader || apiKey || '').trim();
  const expectedAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const expectedServiceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const expectedCustomAnonKey = (Deno.env.get('SB_ANON_KEY') || '').trim();
  if (receivedKey !== expectedAnonKey && receivedKey !== expectedServiceKey && receivedKey !== expectedCustomAnonKey) {
    console.error('【授权失败】收到钥匙长度与尾8位:', { len: receivedKey.length, tail8: receivedKey.slice(-8) });
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('=== REQUEST RECEIVED ===');

    const bodyText = await req.text();
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const urlId = parsed.urlId;
    const url = parsed.url;

    if (!urlId || !url) {
      return new Response(
        JSON.stringify({ error: 'Missing urlId or url' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing URL:', url);
    console.log('URL ID:', urlId);

    // 暂时跳过所有认证检查，使用固定的用户 ID
    const userId = '00000000-0000-0000-0000-000000000000';
    console.log('Using test user ID:', userId);

    const supabaseUrl = Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SB_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');

    // 确定使用的密钥类型
    const useKey = serviceRoleKey || anonKey || '';
    const keyType = serviceRoleKey ? 'SERVICE_ROLE_KEY' : (anonKey ? 'ANON_KEY' : 'NO_KEY');

    console.log('Supabase Configuration:');
    console.log('  URL:', supabaseUrl ? 'SET' : 'NOT_SET');
    console.log('  Key Type:', keyType);

    // 创建 Supabase 客户端
    const supabaseClient = createClient(supabaseUrl, useKey);

    // 使用代理服务抓取网页
    console.log('Fetching URL via proxy...');
    let html = '';
    let fetchError = null;

    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://cors-anywhere.herokuapp.com/${url}`,
      url,
    ];

    for (let i = 0; i < proxies.length; i++) {
      const proxyUrl = proxies[i];
      try {
        const proxyName = i === proxies.length - 1 ? 'Direct' : `Proxy ${i + 1}`;
        console.log(`Trying ${proxyName}...`);

        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        });

        if (response.ok) {
          html = await response.text();
          console.log(`✅ ${proxyName} SUCCESS! Fetched HTML length: ${html.length}`);
          break;
        } else {
          console.log(`❌ ${proxyName} returned status: ${response.status}`);
        }
      } catch (e) {
        console.log(`❌ Proxy ${i + 1} failed: ${e.message}`);
        fetchError = e;
        continue;
      }
    }

    if (!html) {
      console.error('❌ All proxies failed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch URL via all methods',
          details: fetchError?.message || 'Unknown error',
          url: url,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Parsing HTML...');
    let transactions: any[] = [];
    let llmError: string | null = null;
    try {
      const plainText = toPlainText(html);
      const llm = await llmExtractTransactions(plainText, urlId, userId, url);
      if (llm && llm.length > 0) {
        transactions = llm;
      } else {
        transactions = await parseHtmlData(html, urlId, userId, url);
      }
    } catch (e) {
      llmError = e?.message || String(e);
      console.error('LLM解析失败，回退本地规则:', llmError);
      transactions = await parseHtmlData(html, urlId, userId, url);
      try {
        await supabaseClient.from('urls').update({ last_error_message: llmError }).eq('id', urlId);
      } catch {}
    }
    console.log("Jina AI 抓取回来的网页文本前500字:", (html || '').substring(0, 500));
    console.log("大模型解析生成的原始 JSON 对象:", JSON.stringify(transactions));

    if (transactions.length === 0) {
      console.log('No transactions extracted from HTML');
      return new Response(
        JSON.stringify({
          success: true,
          message: '未能从网页中提取交易数据',
          count: 0,
          newCount: 0,
          duplicateCount: 0,
          htmlLength: html.length,
          note: '网页已抓取，但解析器无法识别数据结构。',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Extracted ${transactions.length} transactions`);

    // 为所有交易记录生成哈希
    const transactionsWithHash = await Promise.all(
      transactions.map(async (transaction) => ({
        ...transaction,
        data_hash: await generateDataHash(transaction),
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      }))
    );

    // 查询已存在的哈希
    const hashes = transactionsWithHash.map(t => t.data_hash);
    console.log(`Checking ${hashes.length} hashes for duplicates...`);

    let existingQuery = supabaseClient
      .from('transactions')
      .select('id, data_hash')
      .eq('url_id', urlId)
      .in('data_hash', hashes);
    if (userId && userId !== 'N/A' && userId !== '') {
      existingQuery = existingQuery.eq('user_id', userId);
    }
    const { data: existingRecords, error: queryError } = await existingQuery;

    if (queryError) {
      console.error('❌ 查询已存在记录失败:', queryError);
      console.error('   Error code:', queryError.code);
      console.error('   Error message:', queryError.message);
      console.error('   Error hint:', queryError.hint);
    } else {
      console.log(`✅ 查询成功，找到 ${existingRecords?.length || 0} 条已存在的记录`);
    }

    const existingHashes = new Set(existingRecords?.map(r => r.data_hash) || []);

    // 分离新记录和重复记录
    const newRecords = transactionsWithHash.filter(t => !existingHashes.has(t.data_hash));
    const duplicateRecords = transactionsWithHash.filter(t => existingHashes.has(t.data_hash));

    console.log(`总记录: ${transactionsWithHash.length}, 新记录: ${newRecords.length}, 重复记录: ${duplicateRecords.length}`);

    // 只插入新记录
    let insertedCount = 0;
    if (newRecords.length > 0) {
      console.log(`准备插入 ${newRecords.length} 条新记录:`);
      newRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.project_name?.substring(0, 30)}... - ${record.bidding_unit || '无招标单位'}`);
      });

      const toInsert = newRecords.map((rec) => {
        const copy: any = { ...rec, url_id: urlId };
        if (copy.user_id === undefined || copy.user_id === null || copy.user_id === '' || copy.user_id === 'N/A') {
          delete copy.user_id;
        }
        return copy;
      });
      console.log("准备插入的数据内容:", JSON.stringify(toInsert));

      const { error: insertError, data: insertedData } = await supabaseClient
        .from('transactions')
        .insert(toInsert)
        .select('id');

      if (insertError) {
        console.error('❌ 插入数据失败:', insertError);
        console.error('   Error code:', insertError.code);
        console.error('   Error message:', insertError.message);
        console.error('   Error hint:', insertError.hint);
        console.error('   Error details:', insertError.details);
        return new Response(
          JSON.stringify({
            success: false,
            error: '保存数据失败',
            details: insertError.message,
            code: insertError.code
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      insertedCount = newRecords.length;
      console.log(`✅ 成功插入 ${insertedCount} 条新记录`);
      console.log(`   Inserted IDs: ${insertedData?.map(d => d.id).join(', ') || 'N/A'}`);
    } else {
      console.log('⚠️ 没有新记录需要插入（所有记录都是重复的）');
    }

    console.log('✅ === SENDING RESPONSE ===');
    return new Response(
      JSON.stringify({
        success: true,
        message: `抓取完成：共 ${transactionsWithHash.length} 条记录，新增 ${insertedCount} 条，重复 ${duplicateRecords.length} 条`,
        count: transactionsWithHash.length,
        newCount: insertedCount,
        duplicateCount: duplicateRecords.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ==================== 辅助函数 ====================

async function generateDataHash(transaction: any): Promise<string> {
  const hashInput = [
    transaction.project_name || '',
    transaction.bidding_unit || '',
    transaction.winning_unit || '',
    transaction.total_price || 0,
    transaction.award_date || '',
    transaction.bid_start_date || '',
    transaction.detail_link || '',  // 加入详情链接，确保不同来源的数据不会被去重
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function toPlainText(html: string): string {
  // 保留结构化标签，仅去除噪声标签，将结构化HTML直接交给 LLM
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<img[\s\S]*?>/gi, '')
    .replace(/<video[\s\S]*?<\/video>/gi, '');
}

async function llmExtractTransactions(rawText: string, urlId: string, userId: string, detailUrl: string): Promise<any[]> {
  const apiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!apiKey) return [];
  const base = Deno.env.get('OPENAI_BASE_URL') || Deno.env.get('OPENAI_API_BASE') || Deno.env.get('DEEPSEEK_BASE_URL') || 'https://api.openai.com/v1';
  const model = Deno.env.get('OPENAI_MODEL') || (base.includes('deepseek') ? 'deepseek-chat' : 'gpt-4o-mini');
  console.log("【数据探针】提交给LLM的文本中是否包含已知金额(如16120):", rawText.includes("16120") || rawText.includes("1.61"));
  const system = [
    '任务：从极不规范的招标/公告 HTML 文本中进行“深度阅读与推理”提取结构化信息。',
    '重要：核心数据（单价、总价、各种日期）很可能存在于 <table> 表格标签内，请仔细比对 <th> 表头和 <td> 单元格的数据对应关系进行抽取。',
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
  const body = { model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
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
    const content = data?.choices?.[0]?.message?.content || '';
    let jsonText = content;
    if (jsonText.trim()[0] !== '[') {
      const start = jsonText.indexOf('[');
      const end = jsonText.lastIndexOf(']');
      if (start >= 0 && end > start) jsonText = jsonText.slice(start, end + 1);
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
      const parseMoney = (v: any): number|null => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const s = v.trim();
          const wan = /万/.test(s);
          const num = parseFloat(s.replace(/[^\d.]/g, ''));
          if (isNaN(num)) return null;
          return wan ? num * 10000 : num;
        }
        return null;
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
      return Object.assign({}, baseTransaction, {
        url_id: urlId,
        user_id: userId || undefined,
        project_name: t.project_name ?? null,
        bidding_unit: t.bidding_unit ?? null,
        bidder_unit: t.bidder_unit ?? null,
        winning_unit: t.winning_unit ?? null,
        total_price: parseMoney(t.total_price),
        quantity: parseNumber(t.quantity),
        unit_price: parseMoney(t.unit_price),
        detail_link: t.detail_link ?? detailUrl ?? null,
        is_channel: typeof t.is_channel === 'boolean' ? t.is_channel : null,
        cert_year: toYearArray(t.cert_year),
        bid_start_date: t.bid_start_date ?? null,
        bid_end_date: t.bid_end_date ?? null,
        award_date: t.award_date ?? null,
      });
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseHtmlData(html: string, urlId: string, userId: string, baseUrl: string): Promise<any[]> {
  const transactions: any[] = [];

  // 针对 bidding.csg.cn 的特殊处理
  if (baseUrl.includes('bidding.csg.cn')) {
    console.log('Using specialized parser for bidding.csg.cn');
    const csgTransactions = await parseCSGBidding(html, urlId, userId);
    if (csgTransactions.length > 0) {
      console.log(`Found ${csgTransactions.length} transactions from CSG parser`);
      return csgTransactions;
    }
  }

  // 策略1: 标准表格解析
  const tableTransactions = parseHtmlTable(html, urlId, userId, baseUrl);
  if (tableTransactions.length > 0) {
    console.log(`Found ${tableTransactions.length} transactions from table`);
    return tableTransactions;
  }

  // 策略2: 列表解析
  const listTransactions = parseHtmlList(html, urlId, userId, baseUrl);
  if (listTransactions.length > 0) {
    console.log(`Found ${listTransactions.length} transactions from list`);
    return listTransactions;
  }

  // 策略3: 宽松表格解析
  const looseTableTransactions = parseLooseTable(html, urlId, userId, baseUrl);
  if (looseTableTransactions.length > 0) {
    console.log(`Found ${looseTableTransactions.length} transactions from loose table`);
    return looseTableTransactions;
  }

  // 策略4: 基于关键词的解析
  const keywordTransactions = parseByKeywords(html, urlId, userId, baseUrl);
  if (keywordTransactions.length > 0) {
    console.log(`Found ${keywordTransactions.length} transactions from keywords`);
    return keywordTransactions;
  }

  console.log('未能从HTML中提取数据');
  return transactions;
}

// ==================== 针对 CSG Bidding 的专用解析器 ====================

async function parseCSGBidding(html: string, urlId: string, userId: string): Promise<any[]> {
  let transactions: any[] = [];

  try {
    // 查找所有链接到详情页面的 <a> 标签
    const linkRegex = /<a[^>]*href="([^"]*\.jhtml)"[^>]*>(.*?)<\/a>/gi;
    const links = Array.from(html.matchAll(linkRegex));

    console.log(`Found ${links.length} links in the page`);

    // 过滤出看起来像招标项目的链接
    const detailUrls: Array<{url: string, text: string}> = [];
    for (const linkMatch of links) {
      const linkUrl = linkMatch[1];
      const linkText = cleanText(linkMatch[2]);

      // 跳过过短或明显不是项目名称的链接
      if (!linkText || linkText.length < 5) continue;

      // 跳过导航类链接
      if (linkText.includes('首页') || linkText.includes('返回') || linkText.includes('更多')) continue;

      const fullUrl = linkUrl.startsWith('http') ? linkUrl : `http://www.bidding.csg.cn${linkUrl}`;
      detailUrls.push({ url: fullUrl, text: linkText });
    }

    console.log(`Filtered to ${detailUrls.length} detail page URLs`);

    // 减少处理的详情页数量，避免超时（只处理前10个）
    const maxDetailPages = 10;
    const urlsToProcess = detailUrls.slice(0, maxDetailPages);

    console.log(`Processing ${urlsToProcess.length} detail pages (max ${maxDetailPages})`);

    try {
      // 并行处理所有详情页以提高速度
      const results = await Promise.allSettled(
        urlsToProcess.map(async (item) => {
          try {
            console.log(`Fetching: ${item.url}`);
            const detailHtml = await fetchUrlViaProxy(item.url);
            if (!detailHtml) {
              console.log(`❌ Failed to fetch: ${item.url}`);
              return null;
            }

            console.log(`✅ Fetched ${detailHtml.length} bytes from ${item.url}`);
            const transaction = parseCSGDetailPage(detailHtml, urlId, userId, item.url);
            if (transaction) {
              console.log(`✅ Parsed: ${transaction.project_name}`);
            } else {
              console.log(`⚠️ Parse returned null for ${item.url}`);
            }
            return transaction;
          } catch (error) {
            console.error(`❌ Error processing ${item.url}:`, error.message);
            return null;
          }
        })
      );

      // 收集成功解析的交易
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          transactions.push(result.value);
        }
      }

      console.log(`Created ${transactions.length} transactions from detail pages`);
    } catch (error) {
      console.error('Detail page processing failed:', error);
    }

    // 降级策略：如果详情页解析失败或结果为空，使用列表页基本信息
    if (transactions.length === 0) {
      console.log('⚠️ No data from detail pages, falling back to list page extraction');
      console.log(`  解析的链接数量: ${detailUrls.length}`);
      transactions = parseCSGListPage(detailUrls, urlId, userId);
      console.log(`Created ${transactions.length} transactions from list page (fallback)`);
    } else {
      console.log(`✅ 从详情页成功解析 ${transactions.length} 条交易记录`);
    }

  } catch (error) {
    console.error('CSG bidding parser failed:', error);
  }

  return transactions;
}

// 降级方案：从列表页提取基本信息
function parseCSGListPage(items: Array<{url: string, text: string}>, urlId: string, userId: string): any[] {
  const transactions: any[] = [];

  for (const item of items) {
    try {
      // 过滤：只保留包含绿证、能源、电力相关关键词的项目
      const relevantKeywords = ['绿证', '绿色', '能源', '电力', '风电', '光伏', '新能源', '碳中和', '碳', '招标', '采购', '项目'];
      const isRelevant = relevantKeywords.some(keyword => item.text.includes(keyword));

      if (!isRelevant) {
        console.log(`  Skipping irrelevant item: ${item.text.substring(0, 30)}...`);
        continue;
      }

      const transaction = {
        url_id: urlId,
        user_id: userId,
        project_name: item.text,
        detail_link: item.url,
        bidding_unit: null,
        winning_unit: null,
        total_price: null,
        quantity: null,
        unit_price: null,
        is_channel: null,
        cert_year: extractYear(item.text),
        bid_start_date: null,
        bid_end_date: null,
        award_date: null,
      };

      console.log(`  ✅ Added from list: ${item.text.substring(0, 30)}...`);
      transactions.push(transaction);
    } catch (error) {
      console.error(`Error processing list item:`, error.message);
    }
  }

  return transactions;
}

// 解析CSG详情页
function parseCSGDetailPage(html: string, urlId: string, userId: string, detailUrl: string): any | null {
  try {
    // CSG详情页使用 <ol> 和 <li> 结构，不是表格
    // 查找所有 <li> 标签内容
    const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
    const liMatches = Array.from(html.matchAll(liRegex));

    console.log(`  Found ${liMatches.length} <li> tags in detail page`);

    const fields: Record<string, string> = {};
    let projectOverview = '';  // 项目概况，用于提取价格和数量

    for (const liMatch of liMatches) {
      const liContent = liMatch[1];
      const text = cleanText(liContent);

      // 解析 "标签：值" 格式
      const colonIndex = text.indexOf('：');
      if (colonIndex > 0) {
        const label = text.substring(0, colonIndex).trim();
        const value = text.substring(colonIndex + 1).trim();

        // 识别字段（根据编号和标签名称）
        if (label.includes('项目名称') || label.startsWith('1.1')) {
          fields.project_name = value;
          console.log(`  Found project_name: ${value}`);
        } else if (label.includes('采购人') || label.includes('采购单位') || label.startsWith('1.4')) {
          fields.bidding_unit = value;
        } else if (label.includes('项目概况') || label.startsWith('1.3')) {
          projectOverview = value;
          console.log(`  Found project_overview: ${value.substring(0, 50)}...`);
        } else if (label.includes('采购编号') || label.startsWith('1.2')) {
          fields.procurement_no = value;
        } else if (label.includes('采购方式') || label.startsWith('1.5')) {
          fields.procurement_method = value;
        }
      }
    }

    // 从项目概况中提取价格和数量信息
    // 格式示例："现拟需采购2480张绿证...共计16120元...单张限价为6.5元"
    if (projectOverview) {
      // 提取数量：查找 "XX张绿证" 或 "采购XX张"
      const quantityMatch = projectOverview.match(/(\d+)张/g);
      if (quantityMatch) {
        const quantityStr = quantityMatch[0].replace('张', '');
        fields.quantity = quantityStr;
      }

      // 提取总价：查找 "共计XXXX元" 或 "总计XXXX元"
      const totalPriceMatch = projectOverview.match(/共计(\d+\.?\d*)元|总计(\d+\.?\d*)元/g);
      if (totalPriceMatch) {
        const priceStr = totalPriceMatch[0].replace(/共计|总计|元/g, '');
        fields.total_price = priceStr;
      }

      // 提取单价：查找 "单张限价为X.X元" 或 "单价X.X元"
      const unitPriceMatch = projectOverview.match(/单张限价为(\d+\.?\d*)元|单价(\d+\.?\d*)元/);
      if (unitPriceMatch) {
        const unitPriceStr = unitPriceMatch[1] || unitPriceMatch[2];
        fields.unit_price = unitPriceStr;
      }

      // 提取日期：查找 "XXXX年X月X日" 或 "XXXX-X-X"
      const dateMatch = projectOverview.match(/(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{4}-\d{1,2}-\d{1,2})/);
      if (dateMatch) {
        if (dateMatch[0].includes('年')) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const day = dateMatch[3].padStart(2, '0');
          fields.award_date = `${year}-${month}-${day}`;
        } else {
          fields.award_date = dateMatch[0];
        }
      }
    }

    // 验证项目名称
    const finalProjectName = fields.project_name;
    if (!finalProjectName || finalProjectName.length < 3) {
      console.log(`  ⚠️ Skipping: project_name="${finalProjectName}" (too short or missing)`);
      return null;
    }

    const transaction = {
      url_id: urlId,
      user_id: userId,
      project_name: finalProjectName,
      detail_link: detailUrl,
      bidding_unit: fields.bidding_unit || null,
      winning_unit: null,  // CSG招标页面通常不显示中标单位
      total_price: fields.total_price ? extractPrice(fields.total_price) : null,
      quantity: fields.quantity ? extractNumber(fields.quantity) : null,
      unit_price: fields.unit_price ? extractPrice(fields.unit_price) : null,
      is_channel: null,
      cert_year: extractYear(finalProjectName),
      bid_start_date: null,
      bid_end_date: null,
      award_date: fields.award_date || null,
    };

    console.log(`✅ Parsed transaction: ${finalProjectName}`);
    console.log(`  - Bidding Unit: ${fields.bidding_unit || 'N/A'}`);
    console.log(`  - Total Price: ${fields.total_price || 'N/A'}`);
    console.log(`  - Quantity: ${fields.quantity || 'N/A'}`);
    console.log(`  - Unit Price: ${fields.unit_price || 'N/A'}`);

    return transaction;

  } catch (error) {
    console.error('❌ Failed to parse CSG detail page:', error);
    return null;
  }
}

// 通过代理获取URL内容（增强版，更多备选代理）
async function fetchUrlViaProxy(url: string): Promise<string | null> {
  // 尝试多个代理服务，增加成功率
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://corsproxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
    url,  // 直接连接作为最后尝试
  ];

  for (let i = 0; i < proxies.length; i++) {
    const proxyUrl = proxies[i];
    try {
      console.log(`  Trying proxy ${i + 1}/${proxies.length}...`);

      // 增加超时时间到30秒
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        console.log(`  ✅ Proxy ${i + 1} succeeded (${html.length} bytes)`);
        return html;
      } else {
        console.log(`  ❌ Proxy ${i + 1} returned status: ${response.status}`);
      }
    } catch (e) {
      console.log(`  ❌ Proxy ${i + 1} failed: ${e.message}`);
      continue;
    }
  }

  console.log(`  ❌ All proxies failed for ${url}`);
  return null;
}

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

function parseLooseTable(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];
  try {
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
    const tbodyMatches = Array.from(html.matchAll(tbodyRegex));

    for (const tbodyMatch of tbodyMatches) {
      const tbodyContent = tbodyMatch[1];
      const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
      const rows = Array.from(tbodyContent.matchAll(rowRegex));

      if (rows.length < 2) continue;

      for (let i = 1; i < rows.length; i++) {
        const rowHtml = rows[i][1];
        const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;
        const cells = Array.from(rowHtml.matchAll(cellRegex));

        if (cells.length < 3) continue;

        const allTexts = cells.map(cell => cleanText(cell[1])).filter(t => t && t.length > 0);

        if (allTexts.length < 3) continue;

        const transaction = {
          url_id: urlId,
          user_id: userId,
          project_name: allTexts[0] || '',
          bidding_unit: allTexts[1] || '',
          winning_unit: allTexts[2] || '',
          total_price: extractPriceFromTexts(allTexts),
          bid_start_date: extractDateFromTexts(allTexts),
          award_date: extractDateFromTexts(allTexts),
        };

        if (transaction.project_name && transaction.project_name.length > 0) {
          transactions.push(transaction);
        }
      }

      if (transactions.length > 0) break;
    }
  } catch (error) {
    console.error('宽松表格解析失败:', error);
  }
  return transactions;
}

function parseByKeywords(html: string, urlId: string, userId: string, baseUrl: string): any[] {
  const transactions: any[] = [];
  try {
    const patterns = [
      /(?:中标|招标)[^<]{10,200}/gi,
      /项目名称[^<]{5,100}/gi,
      /招标单位[^<]{5,100}/gi,
    ];

    const potentialData = new Set<string>();
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(m => potentialData.add(cleanText(m)));
      }
    }

    if (potentialData.size < 3) return transactions;

    const dataArray = Array.from(potentialData);
    const transaction = {
      url_id: urlId,
      user_id: userId,
      project_name: dataArray.find(t => t.includes('项目')) || dataArray[0] || '',
      bidding_unit: dataArray.find(t => t.includes('招标')) || '',
      total_price: extractPrice(dataArray.join(' ')),
    };

    if (transaction.project_name && transaction.project_name.length > 0) {
      transactions.push(transaction);
    }
  } catch (error) {
    console.error('关键词解析失败:', error);
  }
  return transactions;
}

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

function extractPriceFromTexts(texts: string[]): number | null {
  for (const text of texts) {
    const price = extractPrice(text);
    if (price !== null && price > 100) {
      return price;
    }
  }
  return null;
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

function extractDateFromTexts(texts: string[]): string | null {
  for (const text of texts) {
    const date = parseDate(text);
    if (date !== null) {
      return date;
    }
  }
  return null;
}

function extractByPattern(html: string, pattern: RegExp): string | null {
  if (!html) return null;
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}
