-- 扩展 urls 表，添加自动抓取相关字段
ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS is_auto_scrape BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scrape_interval_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_scrape_status TEXT, -- 'success', 'error', 'pending'
  ADD COLUMN IF NOT EXISTS total_scrape_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS total_new_records_count INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN public.urls.is_auto_scrape IS '是否启用自动抓取';
COMMENT ON COLUMN public.urls.scrape_interval_hours IS '抓取间隔（小时）';
COMMENT ON COLUMN public.urls.last_scraped_at IS '最后一次抓取时间';
COMMENT ON COLUMN public.urls.last_scrape_status IS '最后一次抓取状态';
COMMENT ON COLUMN public.urls.total_scrape_count IS '总抓取次数';
COMMENT ON COLUMN public.urls.last_error_message IS '最后一次错误信息';
COMMENT ON COLUMN public.urls.total_new_records_count IS '累计新增记录数';

-- 扩展 transactions 表，添加去重和更新追踪字段
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS data_hash TEXT, -- MD5哈希，用于去重
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;

-- 创建唯一索引，防止重复插入（只对非空的hash创建）
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_hash
  ON public.transactions(data_hash, user_id)
  WHERE data_hash IS NOT NULL;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_first_seen ON public.transactions(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate ON public.transactions(is_duplicate);

-- 添加注释
COMMENT ON COLUMN public.transactions.data_hash IS '数据哈希（SHA-256），用于去重检测';
COMMENT ON COLUMN public.transactions.is_duplicate IS '是否为重复数据';
COMMENT ON COLUMN public.transactions.first_seen_at IS '首次发现时间';
COMMENT ON COLUMN public.transactions.last_updated_at IS '最后更新时间';

-- 创建触发器函数，自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 transactions 表创建触发器
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 scraping_configs 表创建触发器
DROP TRIGGER IF EXISTS update_scraping_configs_updated_at ON public.scraping_configs;
CREATE TRIGGER update_scraping_configs_updated_at
  BEFORE UPDATE ON public.scraping_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
