-- 创建 data_sources 表（数据源配置）
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  parser_config JSONB NOT NULL, -- 解析器配置（选择器、字段映射等）
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_data_sources_active ON public.data_sources(is_active);

-- 添加注释
COMMENT ON TABLE public.data_sources IS '数据源配置表，用于管理可插拔的解析器';
COMMENT ON COLUMN public.data_sources.parser_config IS '解析器配置（JSON格式），包含选择器、字段映射、转换规则等';

-- 设置RLS策略
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以查看数据源
CREATE POLICY "所有用户可以查看数据源" ON public.data_sources
  FOR SELECT TO authenticated
  USING (true);

-- 只有管理员可以修改数据源
CREATE POLICY "只有管理员可以添加数据源" ON public.data_sources
  FOR INSERT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "只有管理员可以更新数据源" ON public.data_sources
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "只有管理员可以删除数据源" ON public.data_sources
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 创建触发器自动更新 updated_at
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
