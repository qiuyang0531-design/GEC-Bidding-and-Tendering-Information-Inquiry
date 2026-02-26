import { supabase } from './supabase';
import type { Url, Transaction } from '@/types/types.ts';
import type {
  ScrapingConfig,
  ScrapingLog,
  Notification,
  DataSource,
  UrlWithAutoScrape,
  ScrapeInterval,
  ScrapingResult,
} from '@/types/auto-scrape';

// ==================== 飞书推送 ====================

/**
 * 飞书 Webhook URL
 */
const FEISHU_WEBHOOK_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/83c13475-a06e-4a11-b231-5c8a2e41f40a';

/**
 * 发送飞书通知
 *
 * @param feishuData 飞书消息数据数组
 * @throws {Error} 当推送失败时抛出错误
 */
async function sendFeishuNotification(feishuData: any[]): Promise<void> {
  if (!feishuData || feishuData.length === 0) {
    console.log('ℹ️ 没有新数据需要通知');
    return;
  }

  // 构建飞书富文本消息
  const cardContent = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `🌱 发现 ${feishuData.length} 条新绿证交易项目`,
        },
        template: 'blue',
      },
      elements: [
        ...feishuData.flatMap((item) => [
          {
            tag: 'div',
            text: {
              tag: 'lmd_md',
              content: `### ${item.title}\n\n${item.content.join('\n')}\n\n${item.url ? `[📄 查看详情](${item.url})` : ''}`,
            },
          },
          {
            tag: 'hr',
          },
        ]),
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: `📅 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
          },
        },
      ],
    },
  };

  console.log('📤 发送飞书通知:', JSON.stringify(cardContent, null, 2));

  const response = await fetch(FEISHU_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardContent),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`飞书推送失败: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ 飞书响应:', result);

  // 检查飞书返回的状态码
  if (result.code !== 0) {
    throw new Error(`飞书推送失败: ${result.msg}`);
  }
}

// ==================== URLs管理 ====================

// 获取用户的所有URLs
export async function getUserUrls(userId: string): Promise<Url[]> {
  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取URLs失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// 添加新URL
export async function addUrl(userId: string, url: string, name?: string): Promise<Url> {
  const { data, error } = await supabase
    .from('urls')
    .insert({ user_id: userId, url, name })
    .select()
    .single();

  if (error) {
    console.error('添加URL失败:', error);
    throw error;
  }

  return data;
}

// 更新URL
export async function updateUrl(urlId: string, url: string, name?: string): Promise<Url> {
  const { data, error } = await supabase
    .from('urls')
    .update({ url, name: name || null })
    .eq('id', urlId)
    .select()
    .single();

  if (error) {
    console.error('更新URL失败:', error);
    throw error;
  }

  return data;
}

// 删除URL
export async function deleteUrl(urlId: string): Promise<void> {
  const { error } = await supabase
    .from('urls')
    .delete()
    .eq('id', urlId);

  if (error) {
    console.error('删除URL失败:', error);
    throw error;
  }
}

// ==================== 交易数据管理 ====================

// 获取用户的交易数据（支持日期筛选）
export async function getTransactions(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId);

  // 日期筛选：优先使用中标日期，如果没有则使用招标开始日期
  if (startDate || endDate) {
    // 使用or条件：中标日期在范围内 或 招标开始日期在范围内
    const conditions: string[] = [];
    
    if (startDate && endDate) {
      conditions.push(`award_date.gte.${startDate},award_date.lte.${endDate}`);
      conditions.push(`bid_start_date.gte.${startDate},bid_start_date.lte.${endDate}`);
    } else if (startDate) {
      conditions.push(`award_date.gte.${startDate}`);
      conditions.push(`bid_start_date.gte.${startDate}`);
    } else if (endDate) {
      conditions.push(`award_date.lte.${endDate}`);
      conditions.push(`bid_start_date.lte.${endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }
  }

  // 排序：优先按中标日期降序，如果没有中标日期则按招标开始日期降序
  const { data, error } = await query.order('award_date', { ascending: false, nullsFirst: false })
                                     .order('bid_start_date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('获取交易数据失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// 批量插入交易数据
export async function insertTransactions(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) {
    console.error('插入交易数据失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// 删除交易数据
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (error) {
    console.error('删除交易数据失败:', error);
    throw error;
  }
}

// ==================== 数据抓取 ====================

// 导入 Jina scraper
import { fetchWithJinaReader, parseGECTransactions } from '@/lib/jina-scraper';

// 调用 Jina AI Reader API 抓取并解析数据
export async function scrapeUrlData(urlId: string, url: string): Promise<any> {
  console.log('=== 开始使用 Jina AI Reader 抓取数据 ===');
  console.log('URL ID:', urlId);
  console.log('URL:', url);

  try {
    // 1. 使用 Jina AI Reader 获取网页内容（markdown 格式）
    const markdown = await fetchWithJinaReader(url);

    // 2. 解析 markdown 内容，提取交易数据
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('用户未登录，请先登录');
    }
    const userId = user.data.user.id;

    const transactions = parseGECTransactions(markdown, urlId, userId, url);

    if (transactions.length === 0) {
      return {
        success: true,
        message: '抓取完成，但未能从网页中提取交易数据',
        count: 0,
        newCount: 0,
        duplicateCount: 0,
        rawContent: markdown.substring(0, 500) + '...',
      };
    }

    // 3. 保存到数据库（使用 upsert 实现增量更新）
    // 使用招标编号或详情链接作为唯一键，避免重复插入
    console.log('📤 准备 upsert 数据，条数:', transactions.length);
    console.log('📤 数据示例:', JSON.stringify(transactions[0], null, 2));

    const { data: upsertedData, error: upsertError } = await supabase
      .from('transactions')
      .upsert(transactions, {
        onConflict: 'user_id,procurement_number',
      })
      .select();

    // 处理唯一约束冲突（说明数据已存在）
    if (upsertError) {
      console.log('⚠️ Upsert 遇到冲突:', upsertError.message);

      // 检查是否是唯一约束冲突（数据已存在）
      if (upsertError.code === '23505' || upsertError.code === 'PGRST116' || upsertError.message?.includes('duplicate')) {
        console.log('ℹ️ 数据已存在（重复），跳过插入');

        // 查询现有记录
        const { data: existingData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('procurement_number', transactions[0]?.procurement_number)
          .limit(1);

        return {
          success: true,
          message: `抓取完成：共 ${transactions.length} 条记录，新增 0 条，跳过 ${transactions.length} 条重复`,
          count: transactions.length,
          newCount: 0,
          duplicateCount: transactions.length,
          data: existingData || transactions,
          feishuData: [],
        };
      }

      // 其他错误则抛出
      console.error('❌ Upsert 数据失败:', upsertError);
      console.error('错误详情:', {
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        code: upsertError.code,
      });
      throw upsertError;
    }

    // 统计新增和更新的记录数
    // 注意：Supabase upsert 返回的数据包括插入和更新的记录
    // 我们需要检查哪些是新增的
    let newCount = 0;
    let duplicateCount = 0;

    // 查询当前URL已有的记录数，以估算重复数量
    const { count: existingCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('url_id', urlId);

    // 如果 upsert 返回的数据条数 = transactions.length，说明全部成功
    // 通过比较 total returned 和 previous count 来判断新增数量
    newCount = Math.max(0, transactions.length - (existingCount || 0));
    duplicateCount = transactions.length - newCount;

    console.log(`✅ Upsert 成功：新增 ${newCount} 条，更新/跳过 ${duplicateCount} 条`);

    // 准备飞书推送的 JSON 格式（仅新增的数据）
    const feishuData = newCount > 0 ? transactions.slice(0, newCount).map(prepareFeishuJson) : [];

    // 如果有新数据，发送飞书通知
    if (newCount > 0 && feishuData.length > 0) {
      console.log(`📤 准备发送飞书通知，共 ${feishuData.length} 条新数据`);
      try {
        await sendFeishuNotification(feishuData);
        console.log('✅ 飞书通知发送成功');
      } catch (feishuError) {
        // 飞书推送失败不影响主流程
        console.error('⚠️ 飞书通知发送失败:', feishuError);
        // 不抛出错误，继续返回成功结果
      }
    }

    return {
      success: true,
      message: `抓取完成：共 ${transactions.length} 条记录，新增 ${newCount} 条，跳过 ${duplicateCount} 条重复`,
      count: transactions.length,
      newCount,
      duplicateCount,
      data: transactions,
      feishuData,
    };

  } catch (error: any) {
    console.error('❌ 抓取数据失败:', error);

    if (error.message?.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接');
    }

    throw error;
  }
}

// ==================== 自动抓取配置管理 ====================

// 获取用户的URLs（包含自动抓取信息）
export async function getUserUrlsWithAutoScrape(userId: string): Promise<UrlWithAutoScrape[]> {
  const { data, error } = await supabase
    .from('urls')
    .select(`
      *,
      scraping_configs (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取URLs失败:', error);
    throw error;
  }

  return (Array.isArray(data) ? data : []).map((url: any) => ({
    ...url,
    scraping_config: url.scraping_configs?.[0] || null,
  }));
}

// 获取自动抓取配置
export async function getScrapingConfigs(userId: string): Promise<ScrapingConfig[]> {
  const { data, error } = await supabase
    .from('scraping_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取抓取配置失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// 启用自动抓取
export async function enableAutoScrape(
  urlId: string,
  intervalHours: ScrapeInterval
): Promise<ScrapingConfig> {
  const cronMap: Record<ScrapeInterval, string> = {
    6: '0 */6 * * *',
    12: '0 */12 * * *',
    24: '0 0 * * *',
    48: '0 0 */2 * *',
  };

  const { error: urlError } = await supabase
    .from('urls')
    .update({
      is_auto_scrape: true,
      scrape_interval_hours: intervalHours,
    })
    .eq('id', urlId);

  if (urlError) {
    console.error('更新URL失败:', urlError);
    throw urlError;
  }

  const { data, error } = await supabase
    .from('scraping_configs')
    .upsert({
      url_id: urlId,
      is_enabled: true,
      schedule_expression: cronMap[intervalHours],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('启用自动抓取失败:', error);
    throw error;
  }

  return data;
}

// 禁用自动抓取
export async function disableAutoScrape(urlId: string): Promise<void> {
  const { error: urlError } = await supabase
    .from('urls')
    .update({ is_auto_scrape: false })
    .eq('id', urlId);

  if (urlError) {
    console.error('更新URL失败:', urlError);
    throw urlError;
  }

  const { error } = await supabase
    .from('scraping_configs')
    .update({ is_enabled: false })
    .eq('url_id', urlId);

  if (error) {
    console.error('禁用自动抓取失败:', error);
    throw error;
  }
}

// 更新抓取间隔
export async function updateScrapeInterval(
  urlId: string,
  intervalHours: ScrapeInterval
): Promise<void> {
  const cronMap: Record<ScrapeInterval, string> = {
    6: '0 */6 * * *',
    12: '0 */12 * * *',
    24: '0 0 * * *',
    48: '0 0 */2 * *',
  };

  const { error: urlError } = await supabase
    .from('urls')
    .update({ scrape_interval_hours: intervalHours })
    .eq('id', urlId);

  if (urlError) {
    console.error('更新URL失败:', urlError);
    throw urlError;
  }

  const { error } = await supabase
    .from('scraping_configs')
    .update({ schedule_expression: cronMap[intervalHours] })
    .eq('url_id', urlId);

  if (error) {
    console.error('更新抓取间隔失败:', error);
    throw error;
  }
}

// ==================== 抓取日志 ====================

export async function getScrapingLogs(
  userId: string,
  urlId?: string,
  status?: string,
  limit: number = 50
): Promise<ScrapingLog[]> {
  let query = supabase
    .from('scraping_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (urlId) {
    query = query.eq('url_id', urlId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取抓取日志失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

// ==================== 通知管理 ====================

export async function getNotifications(
  userId: string,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取通知失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('获取未读通知数量失败:', error);
    return 0;
  }

  return count || 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('标记通知已读失败:', error);
    throw error;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('标记所有通知已读失败:', error);
    throw error;
  }
}

export async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      link,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('创建通知失败:', error);
    throw error;
  }

  return data;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('删除通知失败:', error);
    throw error;
  }
}

// ==================== 数据源管理（仅管理员）====================

export async function getDataSources(): Promise<DataSource[]> {
  const { data, error } = await supabase
    .from('data_sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取数据源失败:', error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function addDataSource(
  name: string,
  baseUrl: string,
  parserConfig: DataSource['parser_config']
): Promise<DataSource> {
  const { data, error } = await supabase
    .from('data_sources')
    .insert({
      name,
      base_url: baseUrl,
      parser_config: parserConfig,
    })
    .select()
    .single();

  if (error) {
    console.error('添加数据源失败:', error);
    throw error;
  }

  return data;
}

export async function updateDataSource(
  id: string,
  updates: Partial<Pick<DataSource, 'name' | 'base_url' | 'parser_config' | 'is_active'>>
): Promise<DataSource> {
  const { data, error } = await supabase
    .from('data_sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新数据源失败:', error);
    throw error;
  }

  return data;
}

export async function deleteDataSource(id: string): Promise<void> {
  const { error } = await supabase
    .from('data_sources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除数据源失败:', error);
    throw error;
  }
}

// ==================== 飞书推送格式化 ====================

/**
 * 将交易数据转换为飞书推送的格式
 *
 * @param transaction 交易数据对象
 * @returns 飞书消息格式
 */
export function prepareFeishuJson(transaction: any): {
  title: string;
  content: string[];
  url?: string;
} {
  // 构建消息内容行
  const lines: string[] = [];

  // 项目名称（必填）
  if (transaction.project_name) {
    lines.push(`**项目名称**：${transaction.project_name}`);
  }

  // 招标编号（如果有）
  if (transaction.procurement_number) {
    lines.push(`**招标编号**：${transaction.procurement_number}`);
  }

  // 招标单位（如果有）
  if (transaction.bidding_unit) {
    lines.push(`**招标单位**：${transaction.bidding_unit}`);
  }

  // 中标单位（如果有）
  if (transaction.winning_unit) {
    lines.push(`**中标单位**：${transaction.winning_unit}`);
  }

  // 价格信息
  const priceParts: string[] = [];
  if (transaction.total_price) {
    priceParts.push(`总价：${transaction.total_price.toLocaleString()} 元`);
  }
  if (transaction.quantity) {
    priceParts.push(`数量：${transaction.quantity.toLocaleString()} 张`);
  }
  if (transaction.unit_price) {
    priceParts.push(`单价：${transaction.unit_price.toFixed(2)} 元`);
  }
  if (priceParts.length > 0) {
    lines.push(`**价格信息**：${priceParts.join(' | ')}`);
  }

  // 通道类型
  if (transaction.is_channel === true) {
    lines.push(`**通道类型**：通道绿证（跨省）`);
  } else if (transaction.is_channel === false) {
    lines.push(`**通道类型**：非通道绿证（不跨省）`);
  }

  // 绿证年份
  if (transaction.cert_year) {
    lines.push(`**绿证年份**：${transaction.cert_year}`);
  }

  // 日期信息
  const dateParts: string[] = [];
  if (transaction.bid_start_date) {
    dateParts.push(`招标开始：${transaction.bid_start_date}`);
  }
  if (transaction.bid_end_date) {
    dateParts.push(`招标结束：${transaction.bid_end_date}`);
  }
  if (transaction.award_date) {
    dateParts.push(`中标日期：${transaction.award_date}`);
  }
  if (transaction.publish_date) {
    dateParts.push(`发布时间：${transaction.publish_date}`);
  }
  if (dateParts.length > 0) {
    lines.push(`**时间信息**：\n${dateParts.join('\n')}`);
  }

  // 返回简化的格式
  return {
    title: '🌱 新发现绿证交易项目',
    content: lines,
    url: transaction.detail_link,
  };
}

/**
 * 批量准备飞书推送数据
 *
 * @param transactions 交易数据数组
 * @returns 飞书推送消息数组
 */
export function prepareBatchFeishuJson(transactions: any[]): any[] {
  return transactions.map(prepareFeishuJson);
}

// ==================== 多频道抓取 ====================

/**
 * 多频道批量抓取
 *
 * @param userId 用户ID
 * @param channelId 频道ID（可选，不传则抓取所有已启用频道）
 * @param options 配置选项
 */
export async function multiChannelScrape(
  userId: string,
  channelId?: string,
  options?: {
    maxPages?: number;
    delay?: number;
    onProgress?: (update: {
      channelName: string;
      current: number;
      total: number;
      message: string;
    }) => void;
  }
): Promise<{
  success: boolean;
  results: {
    channelName: string;
    links: number;
    success: number;
    failed: number;
    irrelevant: number;
  }[];
  total: {
    channels: number;
    links: number;
    success: number;
    failed: number;
    irrelevant: number;
  };
}> {
  // 导入频道配置
  const { CSG_CHANNELS, getChannelById } = await import('@/lib/gec-channels');

  // 确定要抓取的频道
  let channels = CSG_CHANNELS.filter(ch => ch.enabled);
  if (channelId) {
    const channel = getChannelById(channelId);
    if (!channel) {
      return {
        success: false,
        results: [],
        total: { channels: 0, links: 0, success: 0, failed: 0, irrelevant: 0 }
      };
    }
    channels = [channel];
  }

  console.log(`🎯 开始多频道抓取，共 ${channels.length} 个频道`);

  const results = [];
  const totalStats = {
    channels: channels.length,
    links: 0,
    success: 0,
    failed: 0,
    irrelevant: 0,
  };

  for (const channel of channels) {
    console.log(`\n📢 开始抓取频道: ${channel.name}`);

    // 通知进度
    options?.onProgress?.({
      channelName: channel.name,
      current: 0,
      total: 0,
      message: '正在获取列表页...',
    });

    try {
      // 1. 抓取列表页链接
      const listResult = await scrapeListPage(channel.url, options?.maxPages ?? 5);

      if (!listResult.success || !listResult.data) {
        console.error(`❌ ${channel.name} 列表页抓取失败: ${listResult.error}`);
        results.push({
          channelName: channel.name,
          links: 0,
          success: 0,
          failed: 0,
          irrelevant: 0,
        });
        continue;
      }

      const { totalPages, totalLinks, links } = listResult.data;
      console.log(`✅ ${channel.name} 找到 ${totalLinks} 个链接（${totalPages} 页）`);

      totalStats.links += totalLinks;

      // 2. 批量抓取详情页（需要为每个频道创建一个新的URL记录）
      // 暂时使用第一个已存在的URL作为关联，或者创建临时关联
      const { data: urls } = await supabase
        .from('urls')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      const urlId = urls?.[0]?.id || 'temp';

      const batchResult = await batchScrapeDetails(
        userId,
        urlId,
        links,
        { delay: options?.delay ?? 2000 }
      );

      // 统计无关内容
      const irrelevantCount = batchResult.results.filter((r: any) => r.irrelevant).length;

      results.push({
        channelName: channel.name,
        links: totalLinks,
        success: batchResult.success,
        failed: batchResult.failed,
        irrelevant: irrelevantCount,
      });

      totalStats.success += batchResult.success;
      totalStats.failed += batchResult.failed;
      totalStats.irrelevant += irrelevantCount;

      console.log(`✅ ${channel.name} 完成: 成功 ${batchResult.success}, 跳过 ${irrelevantCount}, 失败 ${batchResult.failed}`);

    } catch (error: any) {
      console.error(`❌ ${channel.name} 抓取异常:`, error);
      results.push({
        channelName: channel.name,
        links: 0,
        success: 0,
        failed: 0,
        irrelevant: 0,
      });
    }
  }

  console.log('\n=== 多频道抓取完成 ===');
  console.log(`总频道: ${totalStats.channels}`);
  console.log(`总链接: ${totalStats.links}`);
  console.log(`成功: ${totalStats.success}, 跳过: ${totalStats.irrelevant}, 失败: ${totalStats.failed}`);

  return {
    success: true,
    results,
    total: totalStats,
  };
}

// ==================== 自动抓取触发 ====================

/**
 * 抓取列表页的所有链接（使用 Jina AI Reader）
 */
export async function scrapeListPage(url: string, maxPages: number = 10): Promise<{
  success: boolean;
  data?: {
    totalPages: number;
    totalLinks: number;
    links: string[];
  };
  error?: string;
}> {
  try {
    // 导入 Jina scraper
    const { fetchWithJinaReader } = await import('@/lib/jina-scraper');

    const allLinks: string[] = [];
    let currentPage = 1;

    // 循环抓取多页
    while (currentPage <= maxPages) {
      console.log(`📖 正在抓取第 ${currentPage} 页...`);

      // 构造当前页URL（处理简单的分页参数）
      let pageUrl = url;
      if (currentPage > 1) {
        // 尝试常见的分页参数格式
        const urlObj = new URL(url);
        urlObj.searchParams.set('page', String(currentPage));
        urlObj.searchParams.set('pageNum', String(currentPage));
        urlObj.searchParams.set('p', String(currentPage));
        pageUrl = urlObj.toString();
      }

      // 使用 Jina AI Reader 获取内容
      const markdown = await fetchWithJinaReader(pageUrl);

      // 调试：输出内容前500字符
      console.log('📄 内容预览:', markdown.substring(0, 500));

      // 从 HTML/Markdown 中提取链接
      const pageLinks = extractLinksFromContent(markdown, url);

      console.log(`  → 提取到 ${pageLinks.length} 个链接`);
      console.log('  → 链接示例:', pageLinks.slice(0, 3));

      if (pageLinks.length === 0) {
        console.log(`  → 第 ${currentPage} 页没有找到链接，停止翻页`);
        break;
      }

      console.log(`  ✓ 第 ${currentPage} 页找到 ${pageLinks.length} 个链接`);
      allLinks.push(...pageLinks);

      // 检查是否应该继续（简单的启发式：如果这一页的链接数量明显减少，可能到了最后一页）
      if (currentPage > 1 && pageLinks.length < allLinks.length / currentPage / 2) {
        console.log(`  → 链接数量减少，可能到了最后一页`);
        break;
      }

      currentPage++;
    }

    // 去重
    const uniqueLinks = [...new Set(allLinks)];

    console.log(`=== 抓取完成，共 ${uniqueLinks.length} 个唯一链接 ===`);

    return {
      success: true,
      data: {
        totalPages: currentPage - 1,
        totalLinks: uniqueLinks.length,
        links: uniqueLinks,
      },
    };
  } catch (error: any) {
    console.error('抓取列表页失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 从内容中提取详情页链接
 */
function extractLinksFromContent(content: string, baseUrl: string): string[] {
  const links: string[] = [];

  // 1. 提取 Markdown 格式的链接：[文字](URL)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const link = match[2];

    // 只保留详情页链接（包含特定路径或 .jhtml）
    if (isDetailPageLink(link)) {
      // 处理相对路径
      const fullLink = resolveUrl(link, baseUrl);
      if (!links.includes(fullLink)) {
        links.push(fullLink);
      }
    }
  }

  // 2. 提取 HTML 格式的链接：href="..."
  const htmlPatterns = [
    /href=["']([^"']*\/lxcggg\/[^"']+)["']/gi,
    /href=["']([^"']*\/cggg\/[^"']+)["']/gi,
    /href=["']([^"']*\/zbgg\/[^"']+)["']/gi,
    /href=["']([^"']*\.jhtml(?:\?[^"']*)?)["']/gi,
  ];

  for (const pattern of htmlPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      const link = match[1];
      const fullLink = resolveUrl(link, baseUrl);
      if (!links.includes(fullLink)) {
        links.push(fullLink);
      }
    }
  }

  // 3. 提取纯 HTTP/HTTPS URL
  const urlRegex = /(https?:\/\/[^\s\])\>"']+)/g;
  while ((match = urlRegex.exec(content)) !== null) {
    const link = match[1];
    if (isDetailPageLink(link)) {
      if (!links.includes(link)) {
        links.push(link);
      }
    }
  }

  return links;
}

/**
 * 判断是否为详情页链接（只提取可能包含GEC数据的公告类型）
 */
function isDetailPageLink(url: string): boolean {
  // 必须包含：
  // - 数字ID（如 1200422855）
  // - .jhtml 结尾
  // - 不包含 index.jhtml（列表页）
  const hasNumberId = /\d{7,}/.test(url);
  const isJhtml = /\.jhtml/.test(url);
  const isNotIndex = !url.includes('index.jhtml');

  if (!hasNumberId || !isJhtml || !isNotIndex) {
    return false;
  }

  // 只提取可能包含GEC数据的公告类型
  const allowedPatterns = [
    /\/lxcggg\//,      // 零星采购公告 ✓ 最可能
    /\/cggg\//,        // 采购公告 ✓ 很可能
    /\/zbcg\//,        // 招标采购 ✓ 可能
    /\/zbgg\//,        // 招标公告 ✓ 可能
    /\/zbwgg\//,       // 招标结果公告 ✓ 可能
    /\/cgbgg\//,       // 采购结果公告 ✓ 可能
  ];

  const isAllowedType = allowedPatterns.some(pattern => pattern.test(url));

  // 排除明显不相关的类型
  const excludedPatterns = [
    /\/xtgg\//,        // 系统公告 ✗
    /\/tzgg\//,        // 通知公告 ✗
    /\/zcfg\//,        // 政策法规 ✗
    /\/down\//,        // 下载中心 ✗
    /\/about\//,       // 关于我们 ✗
    /\/contact\//,     // 联系我们 ✗
    /\/help\//,        // 帮助 ✗
    /\/login\//,       // 登录 ✗
  ];

  const isExcluded = excludedPatterns.some(pattern => pattern.test(url));

  return isAllowedType && !isExcluded;
}

/**
 * 解析相对路径为完整URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    return `${urlObj.protocol}//${urlObj.host}${url}`;
  }

  return url;
}

/**
 * 批量抓取详情页
 */
export async function batchScrapeDetails(
  userId: string,
  urlId: string,  // 使用实际的 urlId
  links: string[],
  options?: { delay?: number; concurrent?: boolean }
): Promise<{ success: number; failed: number; results: any[] }> {
  const results = [];
  let successCount = 0;
  let failedCount = 0;
  const delay = options?.delay ?? 500; // 默认500ms间隔

  if (options?.concurrent) {
    // 并发抓取模式
    const batchSize = 5; // 每次并发5个
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      const promises = batch.map(async (link) => {
        try {
          const result = await scrapeUrlData(urlId, link);
          if (result.success) {
            console.log(`✅ [${i + batch.indexOf(link) + 1}/${links.length}] ${link}`);
            return { link, success: true, count: result.newCount || result.count };
          } else {
            console.log(`❌ [${i + batch.indexOf(link) + 1}/${links.length}] ${link}: ${result.message}`);
            return { link, error: result.message };
          }
        } catch (error: any) {
          console.log(`❌ [${i + batch.indexOf(link) + 1}/${links.length}] ${link}: ${error.message}`);
          return { link, error: error.message };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(r => {
        if (r.success) successCount++;
        else failedCount++;
        results.push(r);
      });

      console.log(`进度: ${Math.min(i + batchSize, links.length)}/${links.length}, 成功: ${successCount}, 失败: ${failedCount}`);
    }
  } else {
    // 顺序抓取模式
    let irrelevantCount = 0;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const result = await scrapeUrlData(urlId, link);

          if (result.success) {
            // 检查是否实际有数据
            const hasData = result.newCount > 0 || result.count > 0;
            if (hasData) {
              successCount++;
              results.push({ link, success: true, count: result.newCount || result.count });
              console.log(`✅ [${i + 1}/${links.length}] ${link} (+${result.newCount || result.count}条)`);
              break; // 成功，跳出重试循环
            } else {
              // 可能是无关内容
              irrelevantCount++;
              results.push({ link, irrelevant: true, message: '与GEC无关' });
              console.log(`⏭️ [${i + 1}/${links.length}] ${link} (无关内容)`);
              break; // 无关内容，跳出重试循环
            }
          } else {
            // 检查是否是 429 错误（限流）
            if (result.message?.includes('429') || result.message?.includes('Too Many Requests')) {
              retryCount++;
              if (retryCount < maxRetries) {
                const waitTime = Math.pow(2, retryCount) * 5000; // 指数退避：5s, 10s, 20s
                console.log(`⏳ [${i + 1}/${links.length}] ${link} 遇到限流，等待 ${waitTime / 1000}秒后重试 (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
            }
            failedCount++;
            results.push({ link, error: result.message });
            console.log(`❌ [${i + 1}/${links.length}] ${link}`);
            console.log(`   错误: ${result.message}`);
            break;
          }
        } catch (error: any) {
          retryCount++;
          if (retryCount < maxRetries && error.message?.includes('429')) {
            const waitTime = Math.pow(2, retryCount) * 5000;
            console.log(`⏳ [${i + 1}/${links.length}] ${link} 遇到限流，等待 ${waitTime / 1000}秒后重试 (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          failedCount++;
          results.push({ link, error: error.message });
          console.log(`❌ [${i + 1}/${links.length}] ${link}`);
          console.log(`   异常: ${error.message}`);
          break;
        }
      }

      // 基础延迟（避免限流）
      if (i < links.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (irrelevantCount > 0) {
      console.log(`ℹ️ 其中 ${irrelevantCount} 个链接与GEC无关，已跳过`);
    }
  }

  console.log(`=== 批量抓取完成: 成功 ${successCount}, 失败 ${failedCount} ===`);

  return {
    success: successCount,
    failed: failedCount,
    results
  };
}

export async function triggerAutoScrape(userId: string, urlId?: string): Promise<ScrapingResult[]> {
  const { data, error } = await supabase.functions.invoke('scrape-automated', {
    body: { userId, urlId }
  });

  if (error) {
    console.error('触发自动抓取失败:', error);
    throw error;
  }

  return data.results || [];
}

export async function triggerImmediateScrape(urlId: string): Promise<ScrapingResult> {
  const { data, error } = await supabase.functions.invoke('scrape-automated', {
    body: { urlId }
  });

  if (error) {
    console.error('立即抓取失败:', error);
    throw error;
  }

  const results = data.results || [];
  const result = results.find((r: ScrapingResult) => r.urlId === urlId);

  if (!result) {
    throw new Error('抓取结果未找到');
  }

  return result;
}
