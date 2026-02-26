# 通道类型字段说明

## 📋 概述

在绿色电力证书交易中，"通道类型"是一个重要的分类字段。本应用支持三种通道类型状态，以适应实际业务场景中的不同情况。

## 🎯 三种状态

### 1. 通道（is_channel = true）
- **含义**：明确标注为通道交易
- **显示**：蓝色徽章"通道"
- **数据库值**：`true`

### 2. 非通道（is_channel = false）
- **含义**：明确标注为非通道交易
- **显示**：灰色徽章"非通道"
- **数据库值**：`false`

### 3. 未标注（is_channel = null）
- **含义**：项目未标注通道类型信息
- **显示**："-"（横线）
- **数据库值**：`NULL`

## 💡 为什么需要三种状态？

在实际的绿色电力证书交易中：

1. **有些项目明确标注为"通道"交易**
   - 这类项目会在公告中明确说明是通道交易
   - 应用将其记录为 `true`

2. **有些项目明确标注为"非通道"交易**
   - 这类项目会在公告中明确说明是非通道交易
   - 应用将其记录为 `false`

3. **有些项目没有标注通道类型**
   - 部分交易公告中不包含通道类型信息
   - 或者该字段不适用于某些特定类型的交易
   - 应用将其记录为 `null`，显示为"-"

## 🗄️ 数据库设计

### 字段定义
```sql
is_channel BOOLEAN
```

### 特点
- 类型：布尔值（BOOLEAN）
- 可空：是（允许NULL）
- 默认值：NULL

### 三种可能的值
```sql
-- 通道
is_channel = true

-- 非通道
is_channel = false

-- 未标注
is_channel = NULL
```

## 🎨 UI显示

### TransactionTable组件实现

```typescript
{transaction.is_channel !== null && transaction.is_channel !== undefined ? (
  <Badge variant={transaction.is_channel ? 'default' : 'secondary'}>
    {transaction.is_channel ? '通道' : '非通道'}
  </Badge>
) : (
  '-'
)}
```

### 显示效果

| 数据库值 | UI显示 | 样式 |
|---------|--------|------|
| `true` | 通道 | 蓝色徽章 |
| `false` | 非通道 | 灰色徽章 |
| `null` | - | 普通文本 |

## 🔧 数据抓取处理

### 解析函数

在Edge Function中，使用以下函数解析通道类型：

```typescript
function parseChannelType(text: string): boolean | null {
  // 空值或"-"视为未标注
  if (!text || text === '-' || text.trim() === '') {
    return null;
  }
  
  const lowerText = text.toLowerCase();
  
  // 判断是否为"通道"
  if (lowerText.includes('通道') && !lowerText.includes('非')) {
    return true;
  }
  
  // 判断是否为"非通道"
  if (lowerText.includes('非通道')) {
    return false;
  }
  
  // 其他情况视为未标注
  return null;
}
```

### 使用示例

```typescript
parseChannelType('通道交易')     // 返回 true
parseChannelType('通道')         // 返回 true
parseChannelType('非通道交易')   // 返回 false
parseChannelType('非通道')       // 返回 false
parseChannelType('-')           // 返回 null
parseChannelType('')            // 返回 null
parseChannelType('未标注')       // 返回 null
parseChannelType('其他文本')     // 返回 null
```

## 📊 示例数据

应用中的示例数据展示了三种状态：

### 通道交易示例
```
项目：2025年度风电绿色电力证书交易项目
通道类型：通道 (is_channel = true)
```

```
项目：分布式光伏绿证交易项目
通道类型：通道 (is_channel = true)
```

### 未标注示例
```
项目：光伏绿证采购项目（第一批）
通道类型：- (is_channel = null)
```

```
项目：集中式风电绿证交易（第二批）
通道类型：- (is_channel = null)
```

## 🔍 查询和筛选

### SQL查询示例

```sql
-- 查询所有通道交易
SELECT * FROM transactions WHERE is_channel = true;

-- 查询所有非通道交易
SELECT * FROM transactions WHERE is_channel = false;

-- 查询所有未标注的交易
SELECT * FROM transactions WHERE is_channel IS NULL;

-- 查询已标注的交易（通道或非通道）
SELECT * FROM transactions WHERE is_channel IS NOT NULL;

-- 统计各类型数量
SELECT 
  CASE 
    WHEN is_channel = true THEN '通道'
    WHEN is_channel = false THEN '非通道'
    WHEN is_channel IS NULL THEN '未标注'
  END as 通道类型,
  COUNT(*) as 数量
FROM transactions
GROUP BY is_channel;
```

## ⚠️ 注意事项

### 1. 数据完整性
- 通道类型字段允许为NULL
- 这不是数据缺失，而是业务上的"未标注"状态
- 在数据验证时，NULL是合法的值

### 2. 数据抓取
- 如果目标网站没有通道类型信息，应设置为NULL
- 不要将空字符串或其他占位符存入数据库
- 使用parseChannelType函数统一处理

### 3. UI显示
- NULL值显示为"-"，而不是空白
- 这样用户可以明确知道该字段存在但未标注
- 与其他可选字段（如招标单位）的显示方式保持一致

### 4. 数据分析
- 在统计分析时，需要考虑NULL值
- 可以单独统计"未标注"的数量
- 或者在分析时排除未标注的记录

## 📈 实际应用场景

### 场景1：完整信息的交易
```
项目名称：某风电项目绿证交易
招标单位：国家电网
通道类型：通道 ✅
单价：7.20元
```
→ 所有信息完整，用户可以全面了解交易详情

### 场景2：部分信息缺失的交易
```
项目名称：某光伏项目绿证交易
招标单位：南方电网
通道类型：- ⚠️
单价：6.80元
```
→ 通道类型未标注，但不影响其他信息的展示和使用

### 场景3：数据筛选
用户可以根据需要筛选：
- 只看通道交易
- 只看非通道交易
- 只看已标注的交易
- 查看所有交易（包括未标注的）

## 🎓 最佳实践

### 1. 数据抓取时
```typescript
// ✅ 正确：使用parseChannelType函数
is_channel: parseChannelType(extractedText)

// ❌ 错误：直接判断
is_channel: extractedText === '通道'
```

### 2. 数据验证时
```typescript
// ✅ 正确：允许NULL值
if (transaction.is_channel !== undefined) {
  // 处理数据
}

// ❌ 错误：将NULL视为错误
if (transaction.is_channel === null) {
  throw new Error('通道类型不能为空');
}
```

### 3. UI显示时
```typescript
// ✅ 正确：区分NULL和false
{transaction.is_channel !== null ? (
  <Badge>{transaction.is_channel ? '通道' : '非通道'}</Badge>
) : (
  '-'
)}

// ❌ 错误：将NULL和false混为一谈
{transaction.is_channel ? '通道' : '非通道'}
```

## 📚 相关文档

- [数据抓取定制指南](SCRAPING_GUIDE.md) - 详细的parseChannelType实现
- [数据修正说明](DATA_CORRECTION.md) - 通道类型字段的更新历史
- [快速开始指南](QUICKSTART.md) - 包含三种状态的示例数据

## 🔄 版本历史

### v1.2.0 (2026-01-26)
- ✅ 新增：支持通道类型的三种状态
- ✅ 更新：示例数据包含未标注的情况
- ✅ 优化：parseChannelType函数处理更多边界情况
- ✅ 文档：完善通道类型字段说明

### v1.1.0 (2026-01-26)
- ✅ 修正：价格数据符合实际市场情况
- ✅ 优化：详情链接显示

### v1.0.0 (2026-01-26)
- ✅ 初始版本：基础功能实现

---

**最后更新**：2026-01-26
**版本**：v1.2.0
