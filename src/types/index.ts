export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// 导出types.ts中的所有类型
export type { UserRole, Profile, Url, Transaction } from './types';
