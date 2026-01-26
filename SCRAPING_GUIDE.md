# 数据抓取定制指南

## 📋 概述

本应用的数据抓取功能通过Supabase Edge Function实现。当前提供的是完整的框架代码，需要根据实际目标网站的HTML结构进行定制。

## 🎯 为什么需要定制？

不同网站的HTML结构差异很大，数据的组织方式也各不相同。因此，无法提供一个通用的解析逻辑来适配所有网站。您需要：

1. **分析目标网站的HTML结构**
2. **编写针对性的数据提取逻辑**
3. **测试验证数据准确性**

## 📂 文件位置

```
supabase/functions/scrape-data/index.ts
```

## 🔧 需要定制的函数

### parseHtmlData() 函数

这是核心的数据解析函数，需要根据目标网站的HTML结构进行定制。

```typescript
function parseHtmlData(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  // 在这里编写您的解析逻辑
  
  return transactions;
}
```

## 📊 需要提取的数据字段

根据应用需求，需要提取以下10个字段：

| 字段名 | 数据库字段 | 类型 | 必填 | 说明 |
|--------|-----------|------|------|------|
| 项目名称 | project_name | TEXT | ✅ | 绿证交易项目的名称 |
| 招标单位 | bidding_unit | TEXT | ❌ | 发起招标的单位 |
| 投标单位 | bidder_unit | TEXT | ❌ | 参与投标的单位 |
| 中标单位 | winning_unit | TEXT | ❌ | 最终中标的单位 |
| 总价 | total_price | NUMERIC | ❌ | 交易总金额（元） |
| 绿证单价 | unit_price | NUMERIC | ❌ | 每张绿证的单价（元） |
| 详情链接 | detail_link | TEXT | ❌ | 查看详情的URL |
| 通道类型 | is_channel | BOOLEAN | ❌ | true=通道，false=非通道，null=未标注 |
| 绿证年份 | cert_year | INTEGER | ❌ | 绿证对应的年份 |
| 交易日期 | transaction_date | DATE | ❌ | 交易发生的日期（YYYY-MM-DD） |

## 🛠️ 定制步骤

### 步骤1：分析目标网站

使用浏览器开发者工具（F12）分析目标网站：

1. **打开目标网站**
2. **按F12打开开发者工具**
3. **切换到"Elements"或"元素"标签**
4. **找到交易数据所在的HTML元素**

#### 常见的HTML结构

**表格结构**：
```html
<table>
  <thead>
    <tr>
      <th>项目名称</th>
      <th>招标单位</th>
      <th>单价</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>风电项目</td>
      <td>国家电网</td>
      <td>7.20</td>
      ...
    </tr>
  </tbody>
</table>
```

**列表结构**：
```html
<div class="transaction-list">
  <div class="transaction-item">
    <div class="project-name">风电项目</div>
    <div class="unit-name">国家电网</div>
    <div class="price">7.20</div>
    ...
  </div>
</div>
```

### 步骤2：编写解析逻辑

根据HTML结构选择合适的解析方法：

#### 方法1：使用正则表达式（适合简单结构）

```typescript
function parseHtmlData(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  // 提取表格行
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const rows = html.matchAll(rowRegex);
  
  for (const row of rows) {
    const rowHtml = row[1];
    
    // 跳过表头
    if (rowHtml.includes('<th')) continue;
    
    // 提取单元格
    const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
    const cells = Array.from(rowHtml.matchAll(cellRegex));
    
    if (cells.length >= 3) {
      const transaction = {
        url_id: urlId,
        user_id: userId,
        project_name: cleanText(cells[0][1]),
        bidding_unit: cleanText(cells[1][1]),
        unit_price: parseFloat(cleanText(cells[2][1])) || null,
        // ... 其他字段
      };
      
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

// 清理HTML标签和空白字符
function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&nbsp;/g, ' ') // 替换&nbsp;
    .trim(); // 去除首尾空白
}
```

#### 方法2：使用HTML解析库（推荐，适合复杂结构）

由于Edge Function环境限制，推荐使用轻量级的解析方法或正则表达式。

### 步骤3：处理数据格式

#### 价格处理
```typescript
// 从文本中提取数字
function extractPrice(text: string): number | null {
  const match = text.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return null;
}

// 示例
extractPrice('¥7.20元') // 返回 7.20
extractPrice('总价：700,000.00') // 返回 700000.00
```

#### 日期处理
```typescript
// 解析日期
function parseDate(text: string): string | null {
  // 匹配 YYYY-MM-DD 格式
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[0];
  }
  
  // 匹配 YYYY年MM月DD日 格式
  const cnMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cnMatch) {
    const year = cnMatch[1];
    const month = cnMatch[2].padStart(2, '0');
    const day = cnMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// 示例
parseDate('2025-12-15') // 返回 '2025-12-15'
parseDate('2025年12月15日') // 返回 '2025-12-15'
```

#### 通道类型处理
```typescript
// 判断通道类型（支持三种状态）
function parseChannelType(text: string): boolean | null {
  if (!text || text === '-' || text.trim() === '') {
    return null; // 未标注
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

// 示例
parseChannelType('通道交易') // 返回 true
parseChannelType('非通道') // 返回 false
parseChannelType('-') // 返回 null
parseChannelType('') // 返回 null
parseChannelType('未标注') // 返回 null
```

**显示效果**：
- `true` → 显示蓝色徽章"通道"
- `false` → 显示灰色徽章"非通道"
- `null` → 显示"-"

#### 链接处理
```typescript
// 提取链接
function extractLink(html: string, baseUrl: string): string | null {
  const match = html.match(/href=["']([^"']+)["']/);
  if (match) {
    const link = match[1];
    // 处理相对路径
    if (link.startsWith('/')) {
      return new URL(link, baseUrl).href;
    }
    return link;
  }
  return null;
}

// 示例
extractLink('<a href="/detail/123">详情</a>', 'https://example.com')
// 返回 'https://example.com/detail/123'
```

### 步骤4：完整示例

```typescript
function parseHtmlData(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  try {
    // 1. 提取表格行
    const tableRegex = /<tbody[^>]*>(.*?)<\/tbody>/is;
    const tableMatch = html.match(tableRegex);
    
    if (!tableMatch) {
      console.log('未找到表格数据');
      return transactions;
    }
    
    const tbody = tableMatch[1];
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const rows = tbody.matchAll(rowRegex);
    
    // 2. 遍历每一行
    for (const row of rows) {
      const rowHtml = row[1];
      
      // 提取所有单元格
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = Array.from(rowHtml.matchAll(cellRegex));
      
      if (cells.length < 3) continue; // 跳过不完整的行
      
      // 3. 提取各个字段（根据实际列顺序调整索引）
      const transaction = {
        url_id: urlId,
        user_id: userId,
        project_name: cleanText(cells[0][1]), // 第1列：项目名称
        bidding_unit: cleanText(cells[1][1]), // 第2列：招标单位
        bidder_unit: cleanText(cells[2][1]),  // 第3列：投标单位
        winning_unit: cleanText(cells[3][1]), // 第4列：中标单位
        total_price: extractPrice(cells[4][1]), // 第5列：总价
        unit_price: extractPrice(cells[5][1]),  // 第6列：单价
        detail_link: extractLink(cells[0][1], 'https://example.com'), // 从项目名称提取链接
        is_channel: parseChannelType(cells[6][1]), // 第7列：通道类型（支持三种状态）
        cert_year: parseInt(cleanText(cells[7][1])) || null, // 第8列：年份
        transaction_date: parseDate(cells[8][1]), // 第9列：日期
      };
      
      // 4. 验证必填字段
      if (transaction.project_name) {
        transactions.push(transaction);
      }
    }
    
    console.log(`成功解析 ${transactions.length} 条交易记录`);
    
  } catch (error) {
    console.error('解析HTML失败:', error);
  }
  
  return transactions;
}

// 辅助函数
function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractPrice(text: string): number | null {
  const cleaned = cleanText(text);
  const match = cleaned.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : null;
}

function parseDate(text: string): string | null {
  const cleaned = cleanText(text);
  
  // YYYY-MM-DD
  let match = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  
  // YYYY年MM月DD日
  match = cleaned.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseChannelType(text: string): boolean | null {
  const cleaned = cleanText(text).toLowerCase();
  
  // 空值或"-"视为未标注
  if (!cleaned || cleaned === '-') return null;
  
  // 判断是否为"通道"
  if (cleaned.includes('通道') && !cleaned.includes('非')) return true;
  
  // 判断是否为"非通道"
  if (cleaned.includes('非通道')) return false;
  
  // 其他情况视为未标注
  return null;
}

function extractLink(html: string, baseUrl: string): string | null {
  const match = html.match(/href=["']([^"']+)["']/);
  if (!match) return null;
  
  const link = match[1];
  if (link.startsWith('http')) return link;
  if (link.startsWith('/')) return new URL(link, baseUrl).href;
  return new URL(link, baseUrl).href;
}
```

## 🧪 测试步骤

### 1. 本地测试（推荐）

在修改Edge Function之前，可以先在本地测试解析逻辑：

```typescript
// test-parser.ts
const testHtml = `
<table>
  <tbody>
    <tr>
      <td><a href="/detail/123">风电项目</a></td>
      <td>国家电网</td>
      <td>华能新能源</td>
      <td>华能新能源</td>
      <td>700,000.00</td>
      <td>7.20</td>
      <td>通道</td>
      <td>2025</td>
      <td>2025-12-15</td>
    </tr>
  </tbody>
</table>
`;

const result = parseHtmlData(testHtml, 'test-url-id', 'test-user-id');
console.log(JSON.stringify(result, null, 2));
```

### 2. 部署测试

修改完成后，重新部署Edge Function：

```bash
# 应用会自动部署，或者手动触发部署
```

### 3. 功能测试

1. 在应用中添加目标网址
2. 点击"执行查询"
3. 检查数据是否正确提取
4. 验证所有字段是否完整

## ⚠️ 常见问题

### Q1: 为什么提取的数据为空？

**可能原因**：
- HTML结构与解析逻辑不匹配
- 目标网站使用JavaScript动态加载数据
- 网站有反爬虫机制

**解决方法**：
- 使用浏览器开发者工具查看实际的HTML结构
- 检查是否需要处理JavaScript渲染的内容
- 添加适当的请求头（User-Agent等）

### Q2: 价格数据不准确？

**可能原因**：
- 价格格式多样（¥7.20、7.20元、7.2等）
- 包含千位分隔符（700,000.00）

**解决方法**：
- 使用更健壮的价格提取函数
- 处理各种可能的格式

### Q3: 日期格式转换失败？

**可能原因**：
- 日期格式多样（2025-12-15、2025年12月15日等）

**解决方法**：
- 支持多种日期格式
- 统一转换为YYYY-MM-DD格式

### Q4: 详情链接是相对路径？

**可能原因**：
- 网站使用相对路径（/detail/123）

**解决方法**：
- 使用URL对象拼接完整路径
- 保存网站的基础URL

## 📝 实际案例参考

### 案例1：表格结构网站

```typescript
// 目标网站HTML结构
<table class="data-table">
  <tr>
    <td class="project">风电项目</td>
    <td class="company">国家电网</td>
    <td class="price">7.20</td>
  </tr>
</table>

// 解析代码
const rowRegex = /<tr[^>]*>.*?<td class="project">(.*?)<\/td>.*?<td class="company">(.*?)<\/td>.*?<td class="price">(.*?)<\/td>.*?<\/tr>/gis;
```

### 案例2：列表结构网站

```typescript
// 目标网站HTML结构
<div class="item">
  <h3>风电项目</h3>
  <p>招标单位：国家电网</p>
  <p>单价：7.20元</p>
</div>

// 解析代码
const itemRegex = /<div class="item">(.*?)<\/div>/gis;
const titleRegex = /<h3>(.*?)<\/h3>/;
const companyRegex = /招标单位：(.*?)<\/p>/;
const priceRegex = /单价：(.*?)元/;
```

## 🎓 学习资源

- **正则表达式教程**：https://regexr.com/
- **HTML解析技巧**：MDN Web Docs
- **Edge Function文档**：https://supabase.com/docs/guides/functions

## 💡 最佳实践

1. **先分析，后编码**：充分了解目标网站结构
2. **增量开发**：先提取一个字段，逐步完善
3. **错误处理**：添加try-catch和日志输出
4. **数据验证**：检查必填字段是否存在
5. **测试充分**：使用多个样本数据测试

## 📞 需要帮助？

如果在定制过程中遇到问题，可以：

1. 查看Edge Function的日志输出
2. 使用浏览器开发者工具分析HTML结构
3. 参考本文档的示例代码
4. 测试正则表达式的匹配效果

---

**提示**：数据抓取定制是本应用的核心环节，需要根据实际目标网站进行调整。建议先在小范围测试，确认无误后再大规模使用。
