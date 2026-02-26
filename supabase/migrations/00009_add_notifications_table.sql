-- 创建 notifications 表（站内通知）
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'scraping_success', 'scraping_error', 'new_data'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB, -- 额外的元数据（如新数据数量、抓取URL等）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- 设置RLS策略
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的通知
CREATE POLICY "用户可以查看自己的通知" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以插入自己的通知
CREATE POLICY "用户可以插入自己的通知" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的通知
CREATE POLICY "用户可以更新自己的通知" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以删除自己的通知
CREATE POLICY "用户可以删除自己的通知" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 管理员可以访问所有通知
CREATE POLICY "管理员可以访问所有通知" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 添加注释
COMMENT ON TABLE public.notifications IS '站内通知表';
COMMENT ON COLUMN public.notifications.type IS '通知类型: scraping_success（抓取成功）, scraping_error（抓取失败）, new_data（新数据提醒）';
COMMENT ON COLUMN public.notifications.link IS '相关链接，点击通知可跳转';
COMMENT ON COLUMN public.notifications.metadata IS '额外的元数据（JSON格式）';
