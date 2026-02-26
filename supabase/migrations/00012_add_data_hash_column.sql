-- 添加缺失的列到 transactions 表
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS data_hash TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;

-- 为 data_hash 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_data_hash
ON transactions (user_id, url_id, data_hash);

-- 添加注释
COMMENT ON COLUMN transactions.data_hash IS '数据哈希值，用于识别重复记录';
COMMENT ON COLUMN transactions.first_seen_at IS '首次发现时间';
COMMENT ON COLUMN transactions.last_updated_at IS '最后更新时间';
