-- 创建urls表（用户添加的查询网址）
CREATE TABLE public.urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, url)
);

CREATE INDEX idx_urls_user_id ON public.urls(user_id);

-- 创建transactions表（交易数据）
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id UUID NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  bidding_unit TEXT,
  winning_unit TEXT,
  total_price NUMERIC,
  unit_price NUMERIC,
  detail_link TEXT,
  is_channel BOOLEAN,
  cert_year INTEGER,
  transaction_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_url_id ON public.transactions(url_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_project_name ON public.transactions(project_name);

-- 设置RLS策略 - urls表
ALTER TABLE public.urls ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的urls
CREATE POLICY "用户可以查看自己的urls" ON public.urls
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以插入自己的urls
CREATE POLICY "用户可以插入自己的urls" ON public.urls
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以删除自己的urls
CREATE POLICY "用户可以删除自己的urls" ON public.urls
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 管理员可以访问所有urls
CREATE POLICY "管理员可以访问所有urls" ON public.urls
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 设置RLS策略 - transactions表
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的transactions
CREATE POLICY "用户可以查看自己的transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以插入自己的transactions
CREATE POLICY "用户可以插入自己的transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的transactions
CREATE POLICY "用户可以更新自己的transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以删除自己的transactions
CREATE POLICY "用户可以删除自己的transactions" ON public.transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 管理员可以访问所有transactions
CREATE POLICY "管理员可以访问所有transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));