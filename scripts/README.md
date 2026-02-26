# 数据库脚本

此目录包含数据库相关的SQL脚本。

## 可用脚本

### setup-complete.sql
完整的数据库设置脚本，包含所有表和RLS策略。

### clear-all-data.sql
清空所有数据（保留表结构）。

## 使用方法

```bash
# 通过 Supabase CLI
supabase db execute --file scripts/setup-complete.sql

# 或通过 psql
psql $DATABASE_URL -f scripts/setup-complete.sql
```

## 注意事项

- ⚠️ 清空数据脚本不可逆，请谨慎使用
- 🔒 始终使用 service_role_key 进行数据库管理操作
