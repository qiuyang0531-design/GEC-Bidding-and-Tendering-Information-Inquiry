# 开发工具

此目录包含用于开发和调试的工具脚本。

## 调试脚本

### check-db.mjs
检查数据库中的数据状态。

```bash
node tools/check-db.mjs
```

### check-url-data.mjs
检查特定URL的数据详情。

```bash
node tools/check-url-data.mjs
```

### check-all-tables.mjs
检查所有数据库表的数据情况。

```bash
node tools/check-all-tables.mjs
```

## 注意事项

- 这些脚本仅用于开发和调试
- 使用前确保已正确配置 .env 文件
- 调试脚本不应该在生产环境使用
