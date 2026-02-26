/**
 * 使用 Jina AI Reader API 抓取和解析网页内容
 * API 文档: https://jina.ai/reader
 */

export interface JinaReaderResult {
  title?: string;
  url?: string;
  content: string;
  markdown?: string;
}

/**
 * 使用 Jina AI Reader API 获取网页内容（markdown 格式）
 * 通过 Supabase Edge Function 调用，避免 CORS 问题
 */
export async function fetchWithJinaReader(url: string): Promise<string> {
  try {
    console.log('🔍 Fetching via Edge Function + Jina AI Reader:', url);

    // 从环境变量获取 Supabase URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not defined');
    }

    // 调用 Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/scrape-jina`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Edge Function failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Scrape failed: ${result.error || 'Unknown error'}`);
    }

    const markdown = result.markdown || '';
    console.log('✅ Edge Function success, markdown length:', markdown.length);
    console.log('📄 Markdown preview:', markdown.substring(0, 500) + '...');
    console.log('📄 Full content for debugging:', markdown.substring(0, 2000));

    return markdown;
  } catch (error) {
    console.error('❌ fetchWithJinaReader error:', error);

    // 如果 Edge Function 调用失败，降级到直接调用 Jina AI Reader
    console.log('⚠️ Edge Function failed, falling back to direct Jina AI Reader call...');
    return fetchWithJinaReaderDirect(url);
  }
}

/**
 * 直接调用 Jina AI Reader API（降级方案）
 */
async function fetchWithJinaReaderDirect(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  try {
    console.log('🔍 Fetching via direct Jina AI Reader:', url);

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jina AI Reader failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    console.log('📄 Raw response length:', text.length);

    // Jina AI Reader 直接返回 markdown 文本
    const markdown = text;
    console.log('✅ Jina AI Reader direct success, markdown length:', markdown.length);
    console.log('📄 Markdown preview:', markdown.substring(0, 500) + '...');
    console.log('📄 Full content for debugging:', markdown.substring(0, 2000));

    return markdown;
  } catch (error) {
    console.error('❌ Direct Jina AI Reader also failed:', error);
    throw error;
  }
}

/**
 * 从 Jina AI 返回的 markdown 内容中提取 GEC 交易数据
 */
export function parseGECTransactions(markdown: string, urlId: string, userId: string, url: string): any[] {
  console.log('📊 Parsing transactions from markdown...');

  // 首先检查内容是否与 GEC 相关
  if (!isGECRelated(markdown)) {
    console.log('⚠️ 内容与 GEC（绿色电力证书）无关，跳过解析');
    return [];
  }

  const transactions: any[] = [];

  try {
    // 按行分割内容
    const lines = markdown.split('\n');

    // 策略1: 解析单个公告页面（零星采购公告等）
    const announcementTransaction = parseSingleAnnouncement(markdown, urlId, userId, url);
    if (announcementTransaction) {
      console.log('✅ Found transaction from single announcement');
      return [announcementTransaction];
    }

    // 策略2: 解析 markdown 表格
    const tableTransactions = parseMarkdownTable(lines, urlId, userId, url);
    if (tableTransactions.length > 0) {
      console.log(`✅ Found ${tableTransactions.length} transactions from table`);
      return tableTransactions;
    }

    // 策略3: 解析列表格式（项目名称 + 详情）
    const listTransactions = parseMarkdownList(lines, urlId, userId, url);
    if (listTransactions.length > 0) {
      console.log(`✅ Found ${listTransactions.length} transactions from list`);
      return listTransactions;
    }

    // 策略4: 提取键值对格式的数据
    const kvTransactions = parseKeyValuePairs(lines, urlId, userId, url);
    if (kvTransactions.length > 0) {
      console.log(`✅ Found ${kvTransactions.length} transactions from key-value pairs`);
      return kvTransactions;
    }

    console.log('⚠️ No transactions extracted from markdown');
    return transactions;

  } catch (error) {
    console.error('❌ Parse markdown failed:', error);
    return [];
  }
}

/**
 * 检查内容是否与绿色电力证书（GEC）相关
 */
function isGECRelated(content: string): boolean {
  const gecKeywords = [
    '绿证',
    '绿色电力证书',
    '绿色证书',
    'GEC',
    '绿电证书',
    '绿色电力交易证书',
    '可再生能源证书',
    '新能源证书',
  ];

  const lowerContent = content.toLowerCase();

  // 检查是否包含 GEC 相关关键词
  for (const keyword of gecKeywords) {
    if (content.includes(keyword) || lowerContent.includes(keyword.toLowerCase())) {
      console.log(`✅ 内容包含 GEC 关键词: ${keyword}`);
      return true;
    }
  }

  // 检查项目名称是否包含 GEC 相关词
  const projectNameMatch = content.match(/项目名称[：:]\s*([^\n]+)/);
  if (projectNameMatch) {
    const projectName = projectNameMatch[1];
    console.log(`项目名称: ${projectName}`);
    return isGECRelated(projectName);
  }

  return false;
}

/**
 * 解析单个公告页面（零星采购公告等）
 */
function parseSingleAnnouncement(markdown: string, urlId: string, userId: string, url: string): any | null {
  // 检查是否是公告页面（包含采购编号、项目信息等）
  const hasProcurementNumber = /采购编号[:：]\s*[A-Z0-9]+/.test(markdown);
  const hasProjectInfo = /项目名称[:：]/.test(markdown) || /1\.1\.项目名称/.test(markdown);
  const hasGreenCert = /绿证|绿色电力证书/.test(markdown);

  if (!hasProcurementNumber || !hasProjectInfo) {
    return null;
  }

  console.log('📋 Detected single announcement page');

  const transaction: any = {
    url_id: urlId,
    user_id: userId,
    project_name: null,
    procurement_number: null, // 招标编号
    detail_link: url,
    bidding_unit: null,
    winning_unit: null,
    total_price: null,
    quantity: null,
    unit_price: null,
    is_channel: null,
    cert_year: null,
    bid_start_date: null,
    bid_end_date: null,
    award_date: null,
    publish_date: null, // 发布时间
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 提取招标编号
    if (/采购编号[:：]/.test(trimmed)) {
      const match = trimmed.match(/采购编号[:：]\s*([A-Z0-9]+)/);
      if (match) {
        transaction.procurement_number = match[1].trim();
        console.log(`  → 招标编号: ${transaction.procurement_number}`);
      }
    }

    // 提取项目名称
    if (/1\.1\.项目名称[:：]/.test(trimmed) || /项目名称[:：]/.test(trimmed)) {
      const match = trimmed.match(/项目名称[:：]\s*(.+)/);
      if (match) {
        transaction.project_name = match[1].trim();
      }
    }

    // 提取采购人/招标单位
    if (/1\.4\.采购人[:：]/.test(trimmed) || /采购人[:：]/.test(trimmed)) {
      const match = trimmed.match(/采购人[:：]\s*(.+)/);
      if (match) {
        transaction.bidding_unit = match[1].trim();
      }
    }

    // 提取发布时间
    if (/发布时间[:：]/.test(trimmed) || /发布日期[:：]/.test(trimmed)) {
      const match = trimmed.match(/(?:发布时间|发布日期)[:：]\s*(.+)/);
      if (match) {
        const dateStr = match[1].trim();
        transaction.publish_date = parseDate(dateStr) || dateStr;
        console.log(`  → 发布时间: ${transaction.publish_date}`);
      }
    }

    // 从项目概况中提取数量、单价、总价
    if (/项目概况[:：]/.test(trimmed) || /1\.3\.项目概况/.test(trimmed)) {
      // 提取数量（如：2480张绿证）
      const quantityMatch = trimmed.match(/(\d+\.?\d*)\s*张\s*绿证/);
      if (quantityMatch) {
        transaction.quantity = parseFloat(quantityMatch[1]);
      }

      // 提取单价（如：单张限价为6.5元）
      const unitPriceMatch = trimmed.match(/单张限价[为：]?\s*(\d+\.?\d*)\s*元/);
      if (unitPriceMatch) {
        transaction.unit_price = parseFloat(unitPriceMatch[1]);
      }

      // 提取总价（如：共计16120元）
      const totalPriceMatch = trimmed.match(/共计\s*(\d+\.?\d*)\s*元/);
      if (totalPriceMatch) {
        transaction.total_price = parseFloat(totalPriceMatch[1]);
      }
    }
  }

  // 如果没有从项目概况中提取到，尝试从表格中提取
  if (!transaction.total_price) {
    // 查找表格中的概算金额或最高限价
    const tableAmountMatch = markdown.match(/\|\s*1\s*\|[^|]*\|\s*(\d+\.?\d*)\s*\|/);
    if (tableAmountMatch) {
      transaction.total_price = parseFloat(tableAmountMatch[1]);
    }
  }

  // 提取报价日期（如：2026-01-08 15:00至2026-01-14 15:00）
  const dateRangeMatch = markdown.match(/(\d{4}-\d{2}-\d{2})\s*\d{2}:\d{2}\s*至\s*(\d{4}-\d{2}-\d{2})/);
  if (dateRangeMatch) {
    transaction.bid_start_date = dateRangeMatch[1];
    transaction.bid_end_date = dateRangeMatch[2];
  }

  // 从项目名称提取年份
  if (transaction.project_name) {
    transaction.cert_year = extractYear(transaction.project_name);
  }

  // 判断通道类型（必须在整个内容中检查）
  // - 通道绿证（is_channel = true）：电能跨省+绿证跨省，关键词：通道、跨省绿证
  // - 非通道绿证（is_channel = false）：电能不跨省+绿证跨省，关键词：非通道
  // - 未标注（is_channel = null）：未明确标注

  // 检查是否明确标注为"通道"或"跨省绿证"
  const isChannel = /通道|跨省绿证/.test(markdown);

  // 检查是否明确标注为"非通道"
  const isNonChannel = /非通道/.test(markdown);

  if (isChannel && !isNonChannel) {
    transaction.is_channel = true;
    console.log('  → 通道类型: 通道绿证（跨省）');
  } else if (isNonChannel) {
    transaction.is_channel = false;
    console.log('  → 通道类型: 非通道绿证（不跨省）');
  } else {
    transaction.is_channel = null;
    console.log('  → 通道类型: 未标注');
  }

  // 至少需要项目名称才能返回
  if (!transaction.project_name) {
    console.log('⚠️ Announcement parsing failed: no project name found');
    return null;
  }

  console.log('✅ Parsed announcement:', {
    project_name: transaction.project_name,
    quantity: transaction.quantity,
    unit_price: transaction.unit_price,
    total_price: transaction.total_price,
    bidding_unit: transaction.bidding_unit,
    is_channel: transaction.is_channel,
  });

  return transaction;
}

/**
 * 解析 markdown 表格
 */
function parseMarkdownTable(lines: string[], urlId: string, userId: string, url: string): any[] {
  const transactions: any[] = [];
  let inTable = false;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检测表格分隔符行
    if (line.includes('---')) {
      inTable = true;
      // 获取表头
      const headerLine = lines[i - 1];
      if (headerLine && headerLine.includes('|')) {
        headers = headerLine.split('|')
          .map(h => h.trim())
          .filter(h => h);
      }
      console.log('Table headers:', headers);
      continue;
    }

    // 解析表格行
    if (inTable && line.startsWith('|')) {
      const cells = line.split('|')
        .map(c => c.trim())
        .filter(c => c);

      if (cells.length > 2) {
        const transaction = createTransactionFromCells(headers, cells, urlId, userId, url);
        if (transaction && transaction.project_name) {
          transactions.push(transaction);
        }
      }
    } else if (inTable && !line.startsWith('|')) {
      inTable = false;
      headers = [];
    }
  }

  return transactions;
}

/**
 * 解析 markdown 列表
 */
function parseMarkdownList(lines: string[], urlId: string, userId: string, url: string): any[] {
  const transactions: any[] = [];

  // 查找包含 "项目" 的行作为标题
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // GEC 项目通常会有标题（带 # 或数字编号）
    if (line.match(/^#+\s*\d+\./) || line.match(/^\d+\./)) {
      const title = line.replace(/^#+\s*\d+\.\s*/, '').trim();

      // 收集后续几行作为项目信息
      const infoLines: string[] = [];
      let j = i + 1;

      while (j < lines.length && j < i + 10) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.match(/^#+/) && !nextLine.match(/^\d+\./)) {
          infoLines.push(nextLine);
          j++;
        } else {
          break;
        }
      }

      // 从信息中提取数据
      const transaction = extractTransactionFromInfo(title, infoLines, urlId, userId, url);
      if (transaction) {
        transactions.push(transaction);
        i = j - 1; // 跳过已处理的行
      }
    }
  }

  return transactions;
}

/**
 * 解析键值对格式
 */
function parseKeyValuePairs(lines: string[], urlId: string, userId: string, url: string): any[] {
  const transactions: any[] = [];
  let currentTransaction: any = null;
  let infoLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测新的项目开始（带编号）
    if (trimmed.match(/^\d+\./)) {
      // 保存上一个交易
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }

      // 开始新交易
      const title = trimmed.replace(/^\d+\.\s*/, '').trim();
      currentTransaction = {
        url_id: urlId,
        user_id: userId,
        project_name: title,
        detail_link: url,
        bidding_unit: null,
        winning_unit: null,
        total_price: null,
        quantity: null,
        unit_price: null,
        is_channel: null,
        cert_year: extractYear(title),
        bid_start_date: null,
        bid_end_date: null,
        award_date: null,
      };
      infoLines = [];
    }
    // 检测键值对
    else if (trimmed.includes('：') || trimmed.includes(':')) {
      if (currentTransaction) {
        const [key, ...valueParts] = trimmed.split(/：|:/);
        const value = valueParts.join('：').trim();

        if (key.includes('项目')) {
          currentTransaction.project_name = value;
        } else if (key.includes('招标单位') || key.includes('采购人')) {
          currentTransaction.bidding_unit = value;
        } else if (key.includes('中标单位')) {
          currentTransaction.winning_unit = value;
        } else if (key.includes('总价') || key.includes('金额')) {
          currentTransaction.total_price = extractPrice(value);
        } else if (key.includes('单价')) {
          currentTransaction.unit_price = extractPrice(value);
        } else if (key.includes('数量') || key.includes('张数')) {
          currentTransaction.quantity = extractNumber(value);
        } else if (key.includes('日期')) {
          currentTransaction.award_date = parseDate(value);
        }
      }
    }
  }

  // 保存最后一个交易
  if (currentTransaction && currentTransaction.project_name) {
    transactions.push(currentTransaction);
  }

  return transactions;
}

/**
 * 从表格单元格创建交易对象
 */
function createTransactionFromCells(headers: string[], cells: string[], urlId: string, userId: string, url: string): any | null {
  const transaction: any = {
    url_id: urlId,
    user_id: userId,
    project_name: '',
    detail_link: url,
    bidding_unit: null,
    winning_unit: null,
    total_price: null,
    quantity: null,
    unit_price: null,
    is_channel: null,
    cert_year: null,
    bid_start_date: null,
    bid_end_date: null,
    award_date: null,
  };

  // 尝试根据列名映射数据
  for (let i = 0; i < Math.min(headers.length, cells.length); i++) {
    const header = headers[i].toLowerCase();
    const cell = cells[i] || '';

    if (header.includes('项目') || header.includes('名称')) {
      transaction.project_name = cell;
    } else if (header.includes('招标') || header.includes('采购')) {
      transaction.bidding_unit = cell;
    } else if (header.includes('中标')) {
      transaction.winning_unit = cell;
    } else if (header.includes('总价') || header.includes('金额')) {
      transaction.total_price = extractPrice(cell);
    } else if (header.includes('单价')) {
      transaction.unit_price = extractPrice(cell);
    } else if (header.includes('数量') || header.includes('张数')) {
      transaction.quantity = extractNumber(cell);
    } else if (header.includes('日期')) {
      transaction.award_date = parseDate(cell);
    }
  }

  if (transaction.project_name) {
    transaction.cert_year = extractYear(transaction.project_name);
    return transaction;
  }

  return null;
}

/**
 * 从信息行中提取交易数据
 */
function extractTransactionFromInfo(title: string, infoLines: string[], urlId: string, userId: string, url: string): any | null {
  const transaction: any = {
    url_id: urlId,
    user_id: userId,
    project_name: title,
    detail_link: url,
    bidding_unit: null,
    winning_unit: null,
    total_price: null,
    quantity: null,
    unit_price: null,
    is_channel: null,
    cert_year: extractYear(title),
    bid_start_date: null,
    bid_end_date: null,
    award_date: null,
  };

  for (const line of infoLines) {
    if (line.includes('：') || line.includes(':')) {
      const [key, ...valueParts] = line.split(/：|:/);
      const value = valueParts.join('：').trim();

      if (key.includes('招标') || key.includes('采购')) {
        transaction.bidding_unit = value;
      } else if (key.includes('中标')) {
        transaction.winning_unit = value;
      } else if (key.includes('总价') || key.includes('金额')) {
        transaction.total_price = extractPrice(value);
      } else if (key.includes('单价')) {
        transaction.unit_price = extractPrice(value);
      } else if (key.includes('数量')) {
        transaction.quantity = extractNumber(value);
      } else if (key.includes('日期')) {
        transaction.award_date = parseDate(value);
      }
    }
  }

  // 确保至少有项目名称
  if (transaction.project_name) {
    return transaction;
  }

  return null;
}

// ==================== 辅助函数 ====================

/**
 * 提取价格数字
 */
function extractPrice(text: string): number | null {
  if (!text) return null;
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const price = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

/**
 * 提取普通数字
 */
function extractNumber(text: string): number | null {
  if (!text) return null;
  const match = text.match(/[\d,]+/);
  if (!match) return null;
  return parseInt(match[0].replace(/,/g, '')) || null;
}

/**
 * 解析日期
 */
function parseDate(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
  if (match) {
    return match[0].replace(/\//g, '-');
  }
  return null;
}

/**
 * 提取年份
 */
function extractYear(text: string): string | null {
  const match = text.match(/\d{4}/);
  return match || null;
}
