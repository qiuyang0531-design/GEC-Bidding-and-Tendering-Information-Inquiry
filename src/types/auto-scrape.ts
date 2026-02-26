// ==================== 自动抓取配置相关类型 ====================

/**
 * 自动抓取配置
 */
export interface ScrapingConfig {
  id: string;
  user_id: string;
  url_id: string;
  is_enabled: boolean;
  schedule_expression: string; // cron表达式
  last_scraped_at?: string;
  next_scraping_at?: string;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

/**
 * 抓取间隔选项
 */
export type ScrapeInterval = 6 | 12 | 24 | 48;

/**
 * 抓取状态
 */
export type ScrapeStatus = 'success' | 'error' | 'pending' | 'partial';

/**
 * 抓取日志状态
 */
export type ScrapingLogStatus = 'success' | 'error' | 'partial';

/**
 * 抓取日志
 */
export interface ScrapingLog {
  id: string;
  user_id: string;
  url_id: string;
  status: ScrapingLogStatus;
  message?: string;
  records_count: number;
  new_records_count: number;
  updated_records_count: number;
  duplicate_count: number;
  duration_ms?: number;
  error_details?: {
    name?: string;
    message?: string;
    stack?: string;
    context?: string;
  };
  created_at: string;
}

/**
 * 抓取结果
 */
export interface ScrapingResult {
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

/**
 * 启用自动抓取请求
 */
export interface EnableAutoScrapeRequest {
  urlId: string;
  intervalHours: ScrapeInterval;
}

// ==================== 通知相关类型 ====================

/**
 * 通知类型
 */
export type NotificationType = 'scraping_success' | 'scraping_error' | 'new_data';

/**
 * 通知
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  metadata?: {
    urlId?: string;
    url?: string;
    newRecordsCount?: number;
    errorCount?: number;
    scrapeDuration?: number;
    [key: string]: any;
  };
  created_at: string;
}

/**
 * 创建通知请求
 */
export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

// ==================== 数据源相关类型 ====================

/**
 * 数据源配置
 */
export interface DataSource {
  id: string;
  name: string;
  base_url: string;
  parser_config: ParserConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 解析器配置
 */
export interface ParserConfig {
  type: 'table' | 'list' | 'custom' | 'json';
  selectors?: {
    container?: string; // 数据容器选择器
    project?: string;   // 项目名称选择器
    bidding?: string;   // 招标单位选择器
    bidder?: string;    // 投标单位选择器
    winning?: string;   // 中标单位选择器
    price?: string;     // 价格选择器
    quantity?: string;  // 数量选择器
    unit_price?: string; // 单价选择器
    link?: string;      // 链接选择器
    channel?: string;   // 通道类型选择器
    year?: string;      // 年份选择器
    bid_start_date?: string; // 招标开始日期选择器
    bid_end_date?: string;   // 招标结束日期选择器
    award_date?: string;     // 中标日期选择器
  };
  fieldMapping?: {
    [key: string]: string; // 字段名映射
  };
  transformations?: {
    price?: 'extractNumber' | 'extractPrice';
    date?: 'parseDate';
    channel?: 'parseChannelType';
    year?: 'extractYear';
  };
  pagination?: {
    hasNext?: string;    // 下一页按钮选择器
    nextPage?: string;   // 下一页URL选择器
    maxPages?: number;   // 最大抓取页数
  };
  headers?: Record<string, string>; // 请求头
  encoding?: string; // 字符编码
  rateLimit?: number; // 请求间隔（毫秒）
}

/**
 * 创建数据源请求
 */
export interface CreateDataSourceRequest {
  name: string;
  base_url: string;
  parser_config: ParserConfig;
}

/**
 * 测试数据源结果
 */
export interface TestDataSourceResult {
  success: boolean;
  message: string;
  sampleData?: any[];
  error?: string;
}

// ==================== 扩展Url接口 ====================

import type { Url } from './types';

/**
 * 带自动抓取信息的Url
 */
export interface UrlWithAutoScrape extends Url {
  is_auto_scrape?: boolean;
  scrape_interval_hours?: number;
  last_scraped_at?: string;
  last_scrape_status?: ScrapeStatus;
  total_scrape_count?: number;
  last_error_message?: string;
  total_new_records_count?: number;
  scraping_config?: ScrapingConfig;
}

// ==================== Edge Function请求/响应类型 ====================

/**
 * 自动抓取Edge Function请求
 */
export interface AutoScrapeRequest {
  userId?: string; // 可选，用于系统定时任务
  urlId?: string;  // 可选，用于单URL抓取
}

/**
 * 发送通知Edge Function请求
 */
export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean; // 是否发送邮件通知
}

/**
 * 发送通知Edge Function响应
 */
export interface SendNotificationResponse {
  success: boolean;
  notificationId: string;
  emailSent?: boolean;
}
