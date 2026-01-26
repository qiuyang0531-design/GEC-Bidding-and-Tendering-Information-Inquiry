-- 将transaction_date拆分为三个日期字段
-- 招标开始日期、招标结束日期、中标日期

-- 1. 添加新字段
ALTER TABLE transactions 
ADD COLUMN bid_start_date DATE,
ADD COLUMN bid_end_date DATE,
ADD COLUMN award_date DATE;

-- 2. 将现有的transaction_date数据迁移到award_date（假设现有数据是中标日期）
UPDATE transactions 
SET award_date = transaction_date 
WHERE transaction_date IS NOT NULL;

-- 3. 删除旧字段
ALTER TABLE transactions 
DROP COLUMN transaction_date;

-- 添加注释
COMMENT ON COLUMN transactions.bid_start_date IS '招标开始日期';
COMMENT ON COLUMN transactions.bid_end_date IS '招标结束日期';
COMMENT ON COLUMN transactions.award_date IS '中标日期';