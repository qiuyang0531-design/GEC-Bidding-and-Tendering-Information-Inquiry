# 数据抓取实现指南

## 概述

本指南详细说明如何根据实际目标网站定制数据抓取逻辑，从网页中提取绿色电力证书交易数据。

## 前提条件

在开始之前，您需要：
1. 目标网站的URL
2. 了解目标网站的HTML结构
3. 确认网站允许数据抓取（遵守robots.txt和服务条款）

## 实施步骤

### 第一步：分析目标网站

#### 1.1 访问目标网站
```bash
# 使用curl获取网页内容
curl "https://目标网站URL" > page.html

# 或使用浏览器开发者工具
# 1. 打开浏览器
# 2. 访问目标网站
# 3. 按F12打开开发者工具
# 4. 切换到"Elements"或"元素"标签
# 5. 查看HTML结构
```

#### 1.2 识别数据结构

常见的数据结构类型：

**类型1：HTML表格**
```html
<table>
  <thead>
    <tr>
      <th>项目名称</th>
      <th>招标单位</th>
      <th>总价</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>风电项目</td>
      <td>国家电网</td>
      <td>700000</td>
      ...
    </tr>
  </tbody>
</table>
```

**类型2：列表结构**
```html
<div class="transaction-list">
  <div class="transaction-item">
    <h3 class="project-name">风电项目</h3>
    <p class="bidding-unit">国家电网</p>
    <p class="price">700000元</p>
    ...
  </div>
</div>
```

**类型3：JSON数据**
```html
<script>
  var transactionData = [
    {
      "projectName": "风电项目",
      "biddingUnit": "国家电网",
      "totalPrice": 700000,
      ...
    }
  ];
</script>
```

### 第二步：编写解析逻辑

#### 2.1 表格解析示例

```typescript
// supabase/functions/scrape-data/index.ts

function parseHtmlTable(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  // 提取表格行
  const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const rows = Array.from(html.matchAll(tableRowRegex));
  
  // 跳过表头，从第二行开始
  for (let i = 1; i < rows.length; i++) {
    const rowHtml = rows[i][1];
    
    // 提取单元格
    const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
    const cells = Array.from(rowHtml.matchAll(cellRegex));
    
    if (cells.length < 5) continue; // 确保有足够的列
    
    // 根据列的顺序提取数据
    const transaction = {
      url_id: urlId,
      user_id: userId,
      project_name: cleanText(cells[0][1]), // 第1列：项目名称
      bidding_unit: cleanText(cells[1][1]), // 第2列：招标单位
      bidder_unit: cleanText(cells[2][1]),  // 第3列：投标单位
      winning_unit: cleanText(cells[3][1]), // 第4列：中标单位
      total_price: extractPrice(cells[4][1]), // 第5列：总价
      quantity: extractNumber(cells[5][1]), // 第6列：成交量
      unit_price: extractPrice(cells[6][1]),  // 第7列：单价
      detail_link: extractLink(cells[0][1], url), // 从项目名称提取链接
      is_channel: parseChannelType(cells[7][1]), // 第8列：通道类型
      cert_year: extractYear(cells[8][1]), // 第9列：年份
      bid_start_date: parseDate(cells[9][1]), // 第10列：招标开始日期
      bid_end_date: parseDate(cells[10][1]), // 第11列：招标结束日期
      award_date: parseDate(cells[11][1]), // 第12列：中标日期
    };
    
    // 验证必填字段
    if (transaction.project_name) {
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

// 清理文本（去除HTML标签和多余空格）
function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // 去除HTML标签
    .replace(/&nbsp;/g, ' ') // 替换&nbsp;
    .replace(/&amp;/g, '&')  // 替换&amp;
    .replace(/&lt;/g, '<')   // 替换&lt;
    .replace(/&gt;/g, '>')   // 替换&gt;
    .trim();
}

// 提取价格（去除货币符号和逗号）
function extractPrice(html: string): number | null {
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const price = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(price) ? null : price;
}

// 提取数字
function extractNumber(html: string): number | null {
  const text = cleanText(html);
  const match = text.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

// 提取链接
function extractLink(html: string, baseUrl: string): string | null {
  const match = html.match(/href=["']([^"']+)["']/);
  if (!match) return null;
  
  let link = match[1];
  
  // 处理相对路径
  if (link.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    link = `${urlObj.protocol}//${urlObj.host}${link}`;
  } else if (!link.startsWith('http')) {
    const urlObj = new URL(baseUrl);
    const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
    link = `${urlObj.protocol}//${urlObj.host}${basePath}/${link}`;
  }
  
  return link;
}

// 解析通道类型
function parseChannelType(html: string): boolean | null {
  const text = cleanText(html);
  if (!text || text === '-' || text.trim() === '') return null;
  if (text.includes('通道') && !text.includes('非')) return true;
  if (text.includes('非通道')) return false;
  return null;
}

// 提取年份（支持单年份和多年份）
function extractYear(html: string): string | null {
  const text = cleanText(html);
  
  // 匹配多年份格式：2024/2025 或 2024-2025
  const multiYearMatch = text.match(/(\d{4})[\/\-](\d{4})/);
  if (multiYearMatch) {
    return `${multiYearMatch[1]}/${multiYearMatch[2]}`;
  }
  
  // 匹配单年份格式：2025
  const singleYearMatch = text.match(/\d{4}/);
  if (singleYearMatch) {
    return singleYearMatch[0];
  }
  
  return null;
}

// 解析日期
function parseDate(html: string): string | null {
  const text = cleanText(html);
  
  // 匹配日期格式：YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD
  const dateMatch = text.match(/(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}
```

#### 2.2 列表结构解析示例

```typescript
function parseHtmlList(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  // 提取列表项
  const itemRegex = /<div class="transaction-item"[^>]*>(.*?)<\/div>/gis;
  const items = Array.from(html.matchAll(itemRegex));
  
  for (const item of items) {
    const itemHtml = item[1];
    
    const transaction = {
      url_id: urlId,
      user_id: userId,
      project_name: extractByClass(itemHtml, 'project-name'),
      bidding_unit: extractByClass(itemHtml, 'bidding-unit'),
      bidder_unit: extractByClass(itemHtml, 'bidder-unit'),
      winning_unit: extractByClass(itemHtml, 'winning-unit'),
      total_price: extractPriceByClass(itemHtml, 'total-price'),
      quantity: extractNumberByClass(itemHtml, 'quantity'),
      unit_price: extractPriceByClass(itemHtml, 'unit-price'),
      detail_link: extractLinkByClass(itemHtml, 'detail-link'),
      is_channel: parseChannelType(extractByClass(itemHtml, 'channel-type')),
      cert_year: extractYear(extractByClass(itemHtml, 'cert-year')),
      bid_start_date: parseDate(extractByClass(itemHtml, 'bid-start-date')),
      bid_end_date: parseDate(extractByClass(itemHtml, 'bid-end-date')),
      award_date: parseDate(extractByClass(itemHtml, 'award-date')),
    };
    
    if (transaction.project_name) {
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

// 根据class提取内容
function extractByClass(html: string, className: string): string {
  const regex = new RegExp(`class=["']${className}["'][^>]*>(.*?)<`, 'is');
  const match = html.match(regex);
  return match ? cleanText(match[1]) : '';
}

// 根据class提取价格
function extractPriceByClass(html: string, className: string): number | null {
  const text = extractByClass(html, className);
  return extractPrice(text);
}

// 根据class提取数字
function extractNumberByClass(html: string, className: string): number | null {
  const text = extractByClass(html, className);
  return extractNumber(text);
}

// 根据class提取链接
function extractLinkByClass(html: string, className: string): string | null {
  const regex = new RegExp(`class=["']${className}["'][^>]*href=["']([^"']+)["']`, 'is');
  const match = html.match(regex);
  return match ? match[1] : null;
}
```

#### 2.3 JSON数据解析示例

```typescript
function parseJsonData(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  
  // 提取JSON数据
  const jsonMatch = html.match(/var transactionData = (\[.*?\]);/s);
  if (!jsonMatch) return transactions;
  
  try {
    const data = JSON.parse(jsonMatch[1]);
    
    for (const item of data) {
      const transaction = {
        url_id: urlId,
        user_id: userId,
        project_name: item.projectName || item.project_name,
        bidding_unit: item.biddingUnit || item.bidding_unit,
        bidder_unit: item.bidderUnit || item.bidder_unit,
        winning_unit: item.winningUnit || item.winning_unit,
        total_price: parseFloat(item.totalPrice || item.total_price) || null,
        quantity: parseFloat(item.quantity) || null,
        unit_price: parseFloat(item.unitPrice || item.unit_price) || null,
        detail_link: item.detailLink || item.detail_link,
        is_channel: item.isChannel === true ? true : item.isChannel === false ? false : null,
        cert_year: item.certYear || item.cert_year,
        bid_start_date: item.bidStartDate || item.bid_start_date,
        bid_end_date: item.bidEndDate || item.bid_end_date,
        award_date: item.awardDate || item.award_date,
      };
      
      if (transaction.project_name) {
        transactions.push(transaction);
      }
    }
  } catch (error) {
    console.error('JSON解析失败:', error);
  }
  
  return transactions;
}
```

### 第三步：更新Edge Function

将解析逻辑集成到Edge Function中：

```typescript
// supabase/functions/scrape-data/index.ts

function parseHtmlData(html: string, urlId: string, userId: string): any[] {
  // 尝试不同的解析方法
  
  // 方法1：尝试解析表格
  let transactions = parseHtmlTable(html, urlId, userId);
  if (transactions.length > 0) return transactions;
  
  // 方法2：尝试解析列表
  transactions = parseHtmlList(html, urlId, userId);
  if (transactions.length > 0) return transactions;
  
  // 方法3：尝试解析JSON
  transactions = parseJsonData(html, urlId, userId);
  if (transactions.length > 0) return transactions;
  
  // 如果都失败，返回空数组
  console.log('未能从HTML中提取数据，请检查解析逻辑');
  return [];
}
```

### 第四步：测试抓取功能

#### 4.1 添加测试网址

1. 登录应用
2. 在"网址管理"区域添加目标网站URL
3. 添加备注名称（如"北京交易中心"）

#### 4.2 执行查询

1. 点击"执行查询"按钮
2. 查看网址状态：
   - ✅ 绿色：抓取成功
   - ❌ 红色：抓取失败（查看错误信息）

#### 4.3 查看结果

1. 在"交易数据"表格中查看抓取的数据
2. 检查数据完整性：
   - 项目名称是否正确
   - 价格数据是否准确
   - 日期格式是否正确
   - 详情链接是否有效

#### 4.4 调试

如果抓取失败或数据不正确：

1. 查看Edge Function日志：
```bash
# 在Supabase Dashboard中查看
# Functions → scrape-data → Logs
```

2. 检查HTML结构是否变化
3. 调整解析逻辑
4. 重新部署Edge Function
5. 再次测试

## 常见问题

### Q1: 如何处理分页数据？

**方案1：抓取单页**
```typescript
// 只抓取当前页的数据
const transactions = parseHtmlData(html, urlId, userId);
```

**方案2：抓取多页**
```typescript
// 提取下一页链接
function extractNextPageLink(html: string, baseUrl: string): string | null {
  const match = html.match(/href=["']([^"']*next[^"']*)["']/i);
  if (!match) return null;
  
  let link = match[1];
  if (link.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    link = `${urlObj.protocol}//${urlObj.host}${link}`;
  }
  
  return link;
}

// 递归抓取多页
async function scrapeAllPages(url: string, urlId: string, userId: string): Promise<any[]> {
  let allTransactions: any[] = [];
  let currentUrl: string | null = url;
  let pageCount = 0;
  const maxPages = 10; // 限制最大页数
  
  while (currentUrl && pageCount < maxPages) {
    const response = await fetch(currentUrl);
    const html = await response.text();
    
    const transactions = parseHtmlData(html, urlId, userId);
    allTransactions = allTransactions.concat(transactions);
    
    currentUrl = extractNextPageLink(html, currentUrl);
    pageCount++;
  }
  
  return allTransactions;
}
```

### Q2: 如何处理动态加载的数据（AJAX）？

如果网站使用AJAX动态加载数据，需要：

1. 找到AJAX请求的URL
2. 直接请求该URL获取JSON数据
3. 解析JSON数据

```typescript
// 示例：抓取AJAX数据
async function scrapeAjaxData(baseUrl: string, urlId: string, userId: string): Promise<any[]> {
  // 构造AJAX请求URL
  const ajaxUrl = `${baseUrl}/api/transactions?page=1&size=100`;
  
  const response = await fetch(ajaxUrl, {
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  
  const data = await response.json();
  
  // 解析JSON数据
  return data.items.map((item: any) => ({
    url_id: urlId,
    user_id: userId,
    project_name: item.projectName,
    // ... 其他字段
  }));
}
```

### Q3: 如何处理需要登录的网站？

如果网站需要登录：

1. 获取登录凭证（Cookie或Token）
2. 在请求中携带凭证

```typescript
async function scrapeWithAuth(url: string, cookie: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 ...',
    },
  });
  
  return await response.text();
}
```

**注意**：需要在Supabase Secrets中存储登录凭证。

### Q4: 如何避免被网站封禁？

1. **添加延迟**
```typescript
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 在请求之间添加延迟
await sleep(1000); // 延迟1秒
```

2. **设置User-Agent**
```typescript
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});
```

3. **限制请求频率**
```typescript
// 限制每分钟最多10个请求
const requestQueue: number[] = [];
const maxRequestsPerMinute = 10;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // 清理1分钟前的请求记录
  while (requestQueue.length > 0 && requestQueue[0] < oneMinuteAgo) {
    requestQueue.shift();
  }
  
  // 如果达到限制，等待
  if (requestQueue.length >= maxRequestsPerMinute) {
    const waitTime = requestQueue[0] + 60000 - now;
    await sleep(waitTime);
  }
  
  requestQueue.push(now);
  return await fetch(url);
}
```

## 实际案例

### 案例1：抓取表格数据

**目标网站结构**：
```html
<table class="transaction-table">
  <tr>
    <td>2025年度风电绿证交易</td>
    <td>国家电网有限公司</td>
    <td>700,000.00</td>
    <td>97,222</td>
    <td>7.20</td>
    <td>通道</td>
    <td>2025</td>
    <td>2025-11-01</td>
    <td>2025-11-20</td>
  </tr>
</table>
```

**解析代码**：
```typescript
function parseTransactionTable(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];
  const tableRegex = /<table class="transaction-table"[^>]*>(.*?)<\/table>/is;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch) return transactions;
  
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const rows = Array.from(tableMatch[1].matchAll(rowRegex));
  
  for (let i = 1; i < rows.length; i++) { // 跳过表头
    const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
    const cells = Array.from(rows[i][1].matchAll(cellRegex));
    
    if (cells.length >= 9) {
      transactions.push({
        url_id: urlId,
        user_id: userId,
        project_name: cleanText(cells[0][1]),
        bidding_unit: cleanText(cells[1][1]),
        total_price: extractPrice(cells[2][1]),
        quantity: extractNumber(cells[3][1]),
        unit_price: extractPrice(cells[4][1]),
        is_channel: parseChannelType(cells[5][1]),
        cert_year: cleanText(cells[6][1]),
        bid_start_date: parseDate(cells[7][1]),
        award_date: parseDate(cells[8][1]),
        detail_link: null,
        bidder_unit: null,
        winning_unit: null,
        bid_end_date: null,
      });
    }
  }
  
  return transactions;
}
```

## 部署更新

修改Edge Function后，需要重新部署：

```bash
# 在项目根目录执行
supabase functions deploy scrape-data
```

或使用Supabase Dashboard：
1. 进入Functions页面
2. 选择scrape-data函数
3. 点击"Deploy"按钮

## 最佳实践

1. **先测试后部署**
   - 在本地测试解析逻辑
   - 使用小数据集验证
   - 确认数据准确性

2. **错误处理**
   - 添加try-catch块
   - 记录详细的错误日志
   - 提供友好的错误提示

3. **数据验证**
   - 验证必填字段
   - 检查数据格式
   - 过滤无效数据

4. **性能优化**
   - 使用正则表达式缓存
   - 避免重复解析
   - 批量插入数据

5. **遵守规则**
   - 检查robots.txt
   - 遵守服务条款
   - 尊重网站资源

## 技术支持

如果遇到问题：
1. 查看Edge Function日志
2. 检查HTML结构
3. 验证解析逻辑
4. 参考SCRAPING_GUIDE.md文档

## 相关文档

- [数据抓取指南](./SCRAPING_GUIDE.md) - 详细的抓取实现说明
- [使用指南](./USAGE.md) - 应用使用说明
- [更新日志](./CHANGELOG.md) - 版本更新记录
