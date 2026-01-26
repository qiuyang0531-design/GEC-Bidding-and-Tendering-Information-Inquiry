-- 修改cert_year字段类型从INTEGER改为TEXT，以支持多年份格式（如"2024/2025"）
ALTER TABLE transactions 
ALTER COLUMN cert_year TYPE TEXT USING cert_year::TEXT;