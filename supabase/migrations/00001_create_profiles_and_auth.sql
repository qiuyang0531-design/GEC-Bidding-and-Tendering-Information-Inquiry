-- 创建用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 创建profiles表
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- 创建is_admin辅助函数
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- 创建自动同步用户的触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  extracted_username TEXT;
BEGIN
  -- 统计现有用户数
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- 从邮箱中提取用户名（去掉@miaoda.com）
  extracted_username := SPLIT_PART(NEW.email, '@', 1);
  
  -- 插入profile，第一个用户为admin
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    extracted_username,
    CASE WHEN user_count = 0 THEN 'admin'::user_role ELSE 'user'::user_role END
  );
  
  RETURN NEW;
END;
$$;

-- 创建触发器（仅在用户确认时触发）
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- 设置RLS策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 管理员可以访问所有profiles
CREATE POLICY "管理员可以访问所有profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 用户可以查看自己的profile
CREATE POLICY "用户可以查看自己的profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 用户可以更新自己的profile（但不能修改role）
CREATE POLICY "用户可以更新自己的profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- 创建公开视图
CREATE VIEW public.public_profiles AS
  SELECT id, username, role FROM public.profiles;