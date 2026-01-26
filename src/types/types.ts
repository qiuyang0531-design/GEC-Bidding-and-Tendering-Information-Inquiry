// 用户角色
export type UserRole = 'user' | 'admin';

// 用户Profile
export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// 查询网址
export interface Url {
  id: string;
  user_id: string;
  url: string;
  name?: string;
  created_at: string;
}

// 交易记录
export interface Transaction {
  id: string;
  url_id: string;
  user_id: string;
  project_name: string;
  bidding_unit?: string;
  bidder_unit?: string;
  winning_unit?: string;
  total_price?: number;
  unit_price?: number;
  detail_link?: string;
  is_channel?: boolean;
  cert_year?: string; // 支持单年份（"2025"）或多年份（"2024/2025"）
  bid_start_date?: string; // 招标开始日期
  bid_end_date?: string; // 招标结束日期
  award_date?: string; // 中标日期
  created_at: string;
  updated_at: string;
}
