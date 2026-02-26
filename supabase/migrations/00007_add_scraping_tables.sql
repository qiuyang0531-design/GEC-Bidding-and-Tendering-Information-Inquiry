-- 创建 scraping_configs 表（自动抓取配置）
CREATE TABLE public.scraping_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  schedule_expression TEXT DEFAULT '0 9 * * *', -- cron表达式，默认每天9点
  last_scraped_at TIMESTAMPTZ,
  next_scraping_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, url_id)
);

-- 创建索引
CREATE INDEX idx_scraping_configs_user_enabled ON public.scraping_configs(user_id, is_enabled);
CREATE INDEX idx_scraping_configs_next_scraping ON public.scraping_configs(next_scraping_at);

-- 设置RLS策略
ALTER TABLE public.scraping_configs ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的抓取配置
CREATE POLICY "用户可以查看自己的抓取配置" ON public.scraping_configs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以插入自己的抓取配置
CREATE POLICY "用户可以插入自己的抓取配置" ON public.scraping_configs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的抓取配置
CREATE POLICY "用户可以更新自己的抓取配置" ON public.scraping_configs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以删除自己的抓取配置
CREATE POLICY "用户可以删除自己的抓取配置" ON public.scraping_configs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 管理员可以访问所有抓取配置
CREATE POLICY "管理员可以访问所有抓取配置" ON public.scraping_configs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 添加注释
COMMENT ON TABLE public.scraping_configs IS '自动抓取配置表';
COMMENT ON COLUMN public.scraping_configs.schedule_expression IS 'Cron表达式，例如: 0 9 * * * (每天9点), 0 */6 * * * (每6小时)';
COMMENT ON COLUMN public.scraping_configs.consecutive_failures IS '连续失败次数，用于判断是否需要暂停自动抓取';
