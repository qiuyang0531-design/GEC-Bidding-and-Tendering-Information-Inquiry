-- 添加成交量字段
ALTER TABLE transactions 
ADD COLUMN quantity NUMERIC;

-- 添加字段注释
COMMENT ON COLUMN transactions.quantity IS '成交量（绿证数量）';