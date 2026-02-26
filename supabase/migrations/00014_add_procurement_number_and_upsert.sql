-- 添加招标编号字段作为唯一键
-- 用于增量更新，避免重复抓取相同项目

-- 1. 添加 procurement_number 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'procurement_number'
  ) THEN
    ALTER TABLE transactions ADD COLUMN procurement_number TEXT;
  END IF;
END $$;

-- 2. 创建唯一索引（基于 user_id + procurement_number）
-- 注意：允许 procurement_number 为 NULL 的记录
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_procurement_unique
ON transactions (user_id, procurement_number)
WHERE procurement_number IS NOT NULL;

-- 3. 创建唯一索引（基于 user_id + detail_link）
-- 作为备选唯一键
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_detail_unique
ON transactions (user_id, detail_link)
WHERE detail_link IS NOT NULL;

COMMENT ON COLUMN transactions.procurement_number IS '招标编号（用于唯一识别和增量更新）';

-- 4. 添加更新时间字段（记录数据最后更新时间）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
