-- 创建 scraping_logs 表（抓取日志）
CREATE TABLE public.scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  message TEXT,
  records_count INTEGER DEFAULT 0,
  new_records_count INTEGER DEFAULT 0,
  updated_records_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_scraping_logs_user_created ON public.scraping_logs(user_id, created_at DESC);
CREATE INDEX idx_scraping_logs_url_created ON public.scraping_logs(url_id, created_at DESC);
CREATE INDEX idx_scraping_logs_status ON public.scraping_logs(status);

-- 设置RLS策略
ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的抓取日志
CREATE POLICY "用户可以查看自己的抓取日志" ON public.scraping_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以插入自己的抓取日志
CREATE POLICY "用户可以插入自己的抓取日志" ON public.scraping_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 管理员可以访问所有抓取日志
CREATE POLICY "管理员可以访问所有抓取日志" ON public.scraping_logs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 添加注释
COMMENT ON TABLE public.scraping_logs IS '抓取日志表';
COMMENT ON COLUMN public.scraping_logs.status IS '抓取状态: success（成功）, error（失败）, partial（部分成功）';
COMMENT ON COLUMN public.scraping_logs.records_count IS '总记录数';
COMMENT ON COLUMN public.scraping_logs.new_records_count IS '新增记录数';
COMMENT ON COLUMN public.scraping_logs.updated_records_count IS '更新记录数';
COMMENT ON COLUMN public.scraping_logs.duplicate_count IS '重复记录数';
COMMENT ON COLUMN public.scraping_logs.duration_ms IS '抓取耗时（毫秒）';
COMMENT ON COLUMN public.scraping_logs.error_details IS '错误详情（JSON格式）';
