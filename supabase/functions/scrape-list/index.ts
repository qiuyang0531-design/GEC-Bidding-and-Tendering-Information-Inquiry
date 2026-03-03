/**
 * 使用 Playwright 抓取列表页的所有标讯链接
 *
 * 功能：
 * 1. 访问列表页
 * 2. 循环点击"下一页"直到没有更多页面
 * 3. 收集所有详情页链接
 * 4. 返回链接列表供后续批量抓取
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const apiKey = req.headers.get('apikey');
  const receivedKey = (authHeader || apiKey || '').trim();
  const expectedAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const expectedServiceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const expectedCustomAnonKey = (Deno.env.get('SB_ANON_KEY') || '').trim();
  if (receivedKey !== expectedAnonKey && receivedKey !== expectedServiceKey && receivedKey !== expectedCustomAnonKey) {
    console.error('【授权失败】收到钥匙长度与尾8位:', { len: receivedKey.length, tail8: receivedKey.slice(-8) });
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const startTime = Date.now();
    const MAX_BATCH = Number.parseInt(Deno.env.get('AUTO_SCRAPE_BATCH_LIMIT') || '3') || 3;
    const TIME_BUDGET_MS = Number.parseInt(Deno.env.get('AUTO_SCRAPE_TIME_BUDGET_MS') || '50000') || 50000;
    const { urlId, url, maxPages = 10 } = await req.json();

    if (!url) {
      throw new Error('缺少 URL 参数');
    }

    console.log('=== 开始使用 Playwright 抓取列表页 ===');
    console.log('URL:', url);
    console.log('最大页数:', maxPages);

    // 引入 Playwright (Deno 原生支持)
    const { chromium } = await import('https://deno.land/x/playwright@1.40.0/mod.ts');

    // 启动浏览器
    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // 访问列表页
    console.log('📄 访问列表页:', url);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 等待页面加载
    await page.waitForTimeout(2000);

    const links: string[] = [];
    let pageNum = 1;
    let hasNextPage = true;
    const maxPagesCapped = Math.min(maxPages, Math.max(1, MAX_BATCH));

    // 循环翻页抓取
    while (hasNextPage && pageNum <= maxPagesCapped) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= TIME_BUDGET_MS) {
        console.warn(`【时间预警】列表抓取已运行 ${(elapsed / 1000).toFixed(1)} 秒，提前结束翻页`);
        break;
      }
      console.log(`📖 正在抓取第 ${pageNum}/${maxPagesCapped} 页...`);

      // 提取当前页的所有详情页链接
      const pageLinks = await page.evaluate(() => {
        const links: string[] = [];

        // 策略1: 查找所有指向详情页的链接
        // GEC 网站的详情页链接通常在特定的容器中
        const selectors = [
          'a[href*="/lxcggg/"]',      // 零星采购公告
          'a[href*="/cggg/"]',         // 采购公告
          'a[href*="/zbgg/"]',         // 招标公告
          'a[href*=".jhtml"]',         // 所有 jhtml 页面
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const href = (el as HTMLAnchorElement).href;
            if (href && !links.includes(href)) {
              links.push(href);
            }
          });
        }

        return links;
      });

      console.log(`  ✓ 找到 ${pageLinks.length} 个链接`);
      links.push(...pageLinks);

      // 尝试查找并点击"下一页"按钮
      const nextButtonFound = await page.evaluate(() => {
        // 常见的"下一页"按钮选择器
        const nextSelectors = [
          'a.next',
          'a:contains("下一页")',
          'a:contains("下一页")',
          'li.next a',
          '.pagination a:contains("下一页")',
          'a[aria-label="Next"]',
          'button:contains("下一页")',
        ];

        for (const selector of nextSelectors) {
          const button = document.querySelector(selector);
          if (button && !(button as HTMLAnchorElement).classList.contains('disabled')) {
            (button as HTMLElement).click();
            return true;
          }
        }

        return false;
      });

      if (nextButtonFound) {
        // 等待页面加载
        await page.waitForTimeout(2000);
        pageNum++;
        console.log(`  → 点击下一页，继续第 ${pageNum} 页`);
      } else {
        hasNextPage = false;
        console.log(`  → 没有下一页了，停止翻页`);
      }
    }

    // 关闭浏览器
    await browser.close();

    // 去重
    const uniqueLinks = [...new Set(links)];

    console.log('=== 抓取完成 ===');
    console.log(`总共找到 ${uniqueLinks.length} 个唯一链接`);

    // 返回结果
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totalPages: pageNum,
          totalLinks: uniqueLinks.length,
          links: uniqueLinks,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ 抓取失败:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
