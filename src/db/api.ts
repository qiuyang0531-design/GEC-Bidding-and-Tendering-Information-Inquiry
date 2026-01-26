import { supabase } from './supabase';
import type { Url, Transaction } from '@/types/types.ts';

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

// 调用Edge Function抓取数据
export async function scrapeUrlData(urlId: string, url: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('scrape-data', {
    body: { urlId, url }
  });

  if (error) {
    console.error('抓取数据失败:', error);
    throw error;
  }

  return data;
}
