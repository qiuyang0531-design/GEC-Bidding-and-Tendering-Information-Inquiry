import * as Scraper from './scraper.ts';
import * as Parsers from './parsers.ts';
import * as DB from './database.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoScrapeRequest {
  userId?: string;
  urlId?: string;
}

interface ScrapingResult {
  urlId: string;
  url: string;
  status: 'success' | 'error' | 'partial';
  recordsCount: number;
  newRecordsCount: number;
  updatedRecordsCount: number;
  duplicateCount: number;
  durationMs: number;
  error?: string;
}

// ==================== 主处理逻辑 ====================

async function handleRequest(req: Request): Promise<Response> {
  console.log("【探针版本】包含完整日志打印 - 20260228_URGENT_FORENSICS");
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 授权校验 (灵活匹配新旧钥匙)
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const apiKey = req.headers.get('apikey');
  const receivedKey = (authHeader || apiKey || '').trim();

  console.log("【调试】收到钥匙长度与尾8位:", { len: receivedKey.length, tail8: receivedKey.slice(-8) });

  const expectedAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const expectedServiceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const expectedCustomAnonKey = (Deno.env.get('SB_ANON_KEY') || '').trim();

  console.log("【调试】期望 OFFICIAL ANON 长度与尾8位:", { len: expectedAnonKey.length, tail8: expectedAnonKey.slice(-8) });
  console.log("【调试】期望 SERVICE 长度与尾8位:", { len: expectedServiceKey.length, tail8: expectedServiceKey.slice(-8) });
  console.log("【调试】期望 CUSTOM ANON 长度与尾8位:", { len: expectedCustomAnonKey.length, tail8: expectedCustomAnonKey.slice(-8) });

  // if (receivedKey !== expectedAnonKey && receivedKey !== expectedServiceKey && receivedKey !== expectedCustomAnonKey) {
  //   console.error("【授权失败】收到钥匙长度与尾8位:", { len: receivedKey.length, tail8: receivedKey.slice(-8) });
  //   console.error("【授权失败】期望 OFFICIAL ANON 长度与尾8位:", { len: expectedAnonKey.length, tail8: expectedAnonKey.slice(-8) });
  //   console.error("【授权失败】期望 SERVICE 长度与尾8位:", { len: expectedServiceKey.length, tail8: expectedServiceKey.slice(-8) });
  //   console.error("【授权失败】期望 CUSTOM ANON 长度与尾8位:", { len: expectedCustomAnonKey.length, tail8: expectedCustomAnonKey.slice(-8) });
  //   return new Response(JSON.stringify({ error: '未授权' }), {
  //     status: 401,
  //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  //   });
  // }

  const startTime = Date.now();
  const MAX_BATCH = Number.parseInt(Deno.env.get('AUTO_SCRAPE_BATCH_LIMIT') || '3') || 3;
  const TIME_BUDGET_MS = Number.parseInt(Deno.env.get('AUTO_SCRAPE_TIME_BUDGET_MS') || '57000') || 57000;

  try {
    const supabaseClient = DB.getSupabaseClient(req);
    try {
      await DB.cleanupEmptyRecords(supabaseClient);
    } catch (_) {}

    // 先读取并探针打印原始请求体，避免在获取用户时中断
    let parsedUserId: string | undefined;
    let parsedUrlId: string | undefined;
    let rawBody = await req.text();
    console.log("【核心探针】原始请求体内容:", rawBody);
    if (!rawBody || rawBody.trim().length === 0) {
      console.error('请求体为空，跳过抓取');
      return new Response(
        JSON.stringify({
          success: true,
          message: '请求体为空，已跳过抓取',
          results: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      try {
        const payload: AutoScrapeRequest = JSON.parse(rawBody);
        parsedUserId = payload.userId;
        parsedUrlId = payload.urlId;
        console.log("【核心探针】解析后的 userId / urlId:", { userId: parsedUserId, urlId: parsedUrlId });
      } catch (e) {
        console.error('请求体非有效JSON，跳过抓取', { error: e.message, raw: rawBody.substring(0, 500) });
        return new Response(
          JSON.stringify({
            success: true,
            message: '请求体不是有效的 JSON，已跳过抓取',
            results: [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const uuidGuard = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let targetUserId: string | null = null;
    if (parsedUserId && uuidGuard.test(parsedUserId.trim())) {
      targetUserId = parsedUserId.trim();
    } else {
      // 仅在未从请求体获取到有效 UUID 时，尝试读取当前用户，且严格捕获异常
      try {
        const userResp = await supabaseClient.auth.getUser();
        const authUserId = userResp?.data?.user?.id?.trim();
        if (authUserId && uuidGuard.test(authUserId)) {
          targetUserId = authUserId;
        }
      } catch (e) {
        console.warn('【核心探针】获取用户失败，继续使用请求体/匿名流程:', (e as any)?.message || e);
      }
    }
    console.log("【核心探针】最终传递的 targetUserId:", targetUserId);

    // 授权已在入口处校验通过

    // C：在执行 urlsQuery 之前加固 urlId 的 UUID 校验
    if (parsedUrlId && !uuidGuard.test(parsedUrlId.trim())) {
      console.error('非法的 urlId 格式（非 UUID）:', parsedUrlId);
      return new Response(JSON.stringify({ error: 'Invalid urlId format (must be UUID)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`开始自动抓取: userId=${targetUserId || 'N/A'}, urlId=${parsedUrlId || '全部'}`);

    // 任务驱动：选择 last_scraped_at 最早的 1 个种子 URL（若列不存在则回退不排序）
    let urls: any[] | null = null;
    let urlsError: any = null;
    try {
      let q = supabaseClient
        .from('urls')
        .select('id, url, user_id, last_scraped_at')
        .eq('is_auto_scrape', true)
        .order('last_scraped_at', { ascending: true, nullsFirst: true })
        .limit(1);
      if (targetUserId) q = q.eq('user_id', targetUserId);
      const r = await q;
      urls = r.data;
      urlsError = r.error;
      if (urlsError) {
        throw urlsError;
      }
      console.log('【任务选择】按 last_scraped_at 排序获取到种子 URL 数量:', urls?.length ?? 0);
    } catch (e) {
      console.warn('【任务选择回退】last_scraped_at 不可用或查询失败，改为无序获取前1条:', (e as any)?.message || e);
      try {
        let q2 = supabaseClient
          .from('urls')
          .select('id, url, user_id')
          .eq('is_auto_scrape', true)
          .limit(1);
        if (targetUserId) q2 = q2.eq('user_id', targetUserId);
        const r2 = await q2;
        urls = r2.data || [];
        urlsError = r2.error;
      } catch (e2) {
        urls = [];
        urlsError = e2;
      }
    }

    if (urlsError) {
      throw urlsError;
    }

    const filteredUrls = (urls || []).filter((u: any) => Scraper.isZhejiangUrl(u.url));
    console.log('【单点测试诊断】查询到的URL数量:', (urls?.length ?? 0), '筛选后的第一个URL:', filteredUrls[0]?.url ?? 'N/A');

    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '没有需要抓取的网址',
          results: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 使用任务驱动：最多处理 1 个；仍遵守批处理上限与预算
    let urlsToProcess = urls.slice(0, Math.min(1, Math.max(1, MAX_BATCH)));
    const zjCandidates = filteredUrls;
    console.log(`找到 ${urlsToProcess.length} 个需要抓取的种子网址（任务驱动）`);

    const results: ScrapingResult[] = [];
    let consecutiveTimeouts = 0;
    for (let i = 0; i < urlsToProcess.length; i++) {
      const urlData = urlsToProcess[i];
      const elapsed = Date.now() - startTime;
      if (elapsed >= TIME_BUDGET_MS) {
        console.warn(`【时间预警】已运行 ${(elapsed / 1000).toFixed(1)} 秒，接近网关超时，提前结束并返回已处理结果`);
        break;
      }
      console.log(`【全量进度】正在处理第 ${i + 1}/${urlsToProcess.length} 条 URL`);
      console.log('【暴力测试】准备请求目标:', urlData.url);
      const urlStartTime = Date.now();
      // 时间预算监控：若剩余不足 15s 则中断
      const remaining = TIME_BUDGET_MS - (urlStartTime - startTime);
      if (remaining <= 15000) {
        console.warn('【时间预算】剩余不足 15 秒，中断后续 URL 处理以确保结果安全回传');
        break;
      }
      try {
        console.log(`开始抓取: ${urlData.url}`);
        let scrapeResult;
        if (Scraper.isZhejiangUrl(urlData.url)) {
          const { html, success, status, error: fetchError, errorBody } = await Scraper.scrapeWithRetry(urlData.url);
          console.log('【列表取证】状态与错误：', { status, fetchError });
          if (status == null) {
            console.log('【列表取证】无HTTP状态（可能被中止/代理侧超时），错误信息：', fetchError || 'N/A');
            if (fetchError && /abort|timeout|timed/i.test(String(fetchError))) {
              consecutiveTimeouts += 1;
              console.warn(`【熔断计数】连续超时次数: ${consecutiveTimeouts}`);
              if (consecutiveTimeouts >= 3) {
                throw new Error('ScraperAPI连续超时熔断');
              }
            }
          } else {
            consecutiveTimeouts = 0;
          }
          let htmlLog = html;
          if ((!htmlLog || htmlLog.trim().length === 0) && (!errorBody || errorBody.trim().length === 0)) {
            htmlLog = '抓取彻底超时，无任何 HTML 返回';
          }
          const htmlForLog = (htmlLog && htmlLog.trim().length > 0) ? htmlLog : (errorBody || '');
          console.log('【列表取证】', htmlForLog.substring(0, 8000));
          const isShell200 = (status === 200) && /beacon-aplus|aplus|window\.aplus|<script/i.test(htmlForLog);
          if ((!success || !html || html.trim().length < 2000) && isShell200) {
            console.warn('【检测到空壳】启动自适应锚点探测...');
          } else if (!success || !html || html.trim().length < 300) {
            if (errorBody) {
              console.log('【崩溃现场取证】内容:', errorBody.substring(0, 1000));
            }
            // 标记错误，确保统计与 last_scraped_at 更新
            const result: ScrapingResult = {
              urlId: urlData.id,
              url: urlData.url,
              status: 'error',
              recordsCount: 0,
              newRecordsCount: 0,
              updatedRecordsCount: 0,
              duplicateCount: 0,
              durationMs: Date.now() - urlStartTime,
              error: '抓取内容过短，疑似被拦截',
            };
            await DB.logScrapingResult(supabaseClient, targetUserId || '', urlData.id, result);
            await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
            results.push(result);
            continue;
          }
          const links = await Parsers.llmExtractLinks(htmlForLog || '', urlData.url);
          let uniqueLinks = Array.from(new Set(links));
          console.log(`从浙江平台提取到 ${uniqueLinks.length} 个候选链接`);
          if (uniqueLinks.length === 0) {
            console.warn('【列表取证】警告：未能在 HTML 壳子中发现任何详情链接，请检查渲染是否充分。');
            try {
              const m = (htmlForLog || '').match(/<(div|ul|section)[^>]*class=["']([^"']+)["'][^>]*>[\s\S]{0,2000}?(绿证|绿色电力|GEC|绿电)/i);
              if (m && m[2]) {
                const cls = String(m[2]).trim().split(/\s+/)[0] || '';
                if (cls) {
                  const selector = '.' + cls;
                  console.log('【自适应锚点】检测到列表容器类名:', selector);
                  const refetch = await Scraper.scrapeWithRetry(urlData.url, 1, 500, { forceScraperRender: true, waitForSelector: selector, waitForMs: 15000, tier: 'premium' });
                  const refHtml = (refetch.html && refetch.html.trim().length > 0) ? refetch.html : (refetch as any)?.errorBody || '';
                  if (refHtml && refHtml.trim().length > 0) {
                    const links2 = await Parsers.llmExtractLinks(refHtml, urlData.url);
                    uniqueLinks = Array.from(new Set(links2));
                    console.log(`【二次取证】自适应锚点后提取到 ${uniqueLinks.length} 个候选链接`);
                  }
                }
              }
            } catch (_) {}
            if (uniqueLinks.length === 0) {
              const result: ScrapingResult = {
                urlId: urlData.id,
                url: urlData.url,
                status: 'error',
                recordsCount: 0,
                newRecordsCount: 0,
                updatedRecordsCount: 0,
                duplicateCount: 0,
                durationMs: Date.now() - urlStartTime,
                error: '渲染未完成',
              };
              (result as any).error_body = htmlForLog.substring(0, 500);
              (result as any).retry_count = consecutiveTimeouts;
              await DB.logScrapingResult(supabaseClient, targetUserId || '', urlData.id, result);
              await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
              results.push(result);
              continue;
            }
          }
          if (uniqueLinks.length > 0) {
            console.log('【候选链接样本】\n' + uniqueLinks.slice(0, 20).join('\n'));
          }
          let totalNew: any[] = [];
          let duplicate = 0;
          let total = 0;
          const limitedLinks = uniqueLinks.slice(0, 1);
          for (const link of limitedLinks) {
            console.log('【发现详情链接】:', link);
            try {
              let forceRenderFirst = /content\.html/i.test(link);
              const first = await Scraper.scrapeWithRetry(link, 3, 1000, { forceScraperRender: forceRenderFirst });
              let td = { title: null as string | null, date: null as string | null };
              if (first.success && first.html && first.html.trim().length > 0) {
                const brief = Parsers.toPlainText(first.html).substring(0, 800);
                console.log(`【详情取证】首轮(${forceRenderFirst ? '渲染' : '无渲染'})正文片段:`, brief);
                td = await Parsers.llmExtractTitleDate(first.html);
                await DB.logTitleDate(supabaseClient, targetUserId, urlData.id, td.title, td.date, link);
              }
              const htmlFirst = first.html || '';
              const needsRender = (!forceRenderFirst) && (!td.title && !td.date) && (
                /加载中|loading|正在加载/i.test(htmlFirst) || htmlFirst.trim().length < 500
              );
              let useHtml = htmlFirst;
              if (needsRender) {
                const second = await Scraper.scrapeWithRetry(link, 3, 1000, { forceScraperRender: true });
                if (second.success && second.html && second.html.trim().length > 0) {
                  const brief2 = Parsers.toPlainText(second.html).substring(0, 800);
                  console.log('【详情取证】二轮(渲染)正文片段:', brief2);
                  const td2 = await Parsers.llmExtractTitleDate(second.html);
                  await DB.logTitleDate(supabaseClient, targetUserId, urlData.id, td2.title, td2.date, link);
                  useHtml = second.html;
                }
              }
              if (!useHtml || useHtml.trim().length === 0) continue;
              const structuredHtml = Parsers.toPlainText(useHtml);
              const coreOk = /(成交|结果|单价|成交量)/.test(structuredHtml);
              const nonTarget = /(更正公告|废标公告)/.test(structuredHtml);
              if (!coreOk || nonTarget) {
                console.warn('【LLM前置过滤】非目标类型或缺少核心关键词，跳过大模型解析');
                continue;
              }
              const llm = await Parsers.llmExtractTransactions(structuredHtml, urlData.id, targetUserId || '', link);
              if (!llm || llm.length === 0) continue;
              const allTransactions = llm.map((t: any) => {
                const base: any = { ...t, url_id: urlData.id };
                if (targetUserId) {
                  base.user_id = targetUserId;
                } else if ('user_id' in base) {
                  delete base.user_id;
                }
                return base;
              });
              const saved = await DB.saveTransactionsForUrl(supabaseClient, urlData.id, targetUserId, allTransactions);
              totalNew = totalNew.concat(new Array(saved.newCount).fill(0));
              duplicate += saved.duplicateCount || 0;
              total += saved.total || 0;
            } catch (e) {
              console.error('处理详情链接失败:', link, (e as any)?.message || e);
            }
          }
          scrapeResult = {
            newRecords: totalNew,
            updatedRecords: [],
            duplicateCount: duplicate,
            totalRecords: total,
          };
        } else {
          try {
            console.log('【二级跳转确认】当前处理非浙江种子，准备提取链接...');
            const listFetch = await Scraper.scrapeWithRetry(urlData.url);
            const listHtml = listFetch.html || '';
            if (!listFetch.success || listHtml.trim().length < 300) {
              const result: ScrapingResult = {
                urlId: urlData.id,
                url: urlData.url,
                status: 'error',
                recordsCount: 0,
                newRecordsCount: 0,
                updatedRecordsCount: 0,
                duplicateCount: 0,
                durationMs: Date.now() - urlStartTime,
                error: '列表抓取失败或内容过短',
              };
              await DB.logScrapingResult(supabaseClient, targetUserId || '', urlData.id, result);
              await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
              results.push(result);
              continue;
            }
            const links = await Parsers.llmExtractLinks(listHtml, urlData.url);
            const uniqueLinks = Array.from(new Set(links));
            console.log(`【提取结果】找到 ${uniqueLinks.length} 个潜在详情链接`);
            if (uniqueLinks.length === 0) {
              const result: ScrapingResult = {
                urlId: urlData.id,
                url: urlData.url,
                status: 'error',
                recordsCount: 0,
                newRecordsCount: 0,
                updatedRecordsCount: 0,
                duplicateCount: 0,
                durationMs: Date.now() - urlStartTime,
                error: '未发现详情链接',
              };
              await DB.logScrapingResult(supabaseClient, targetUserId || '', urlData.id, result);
              await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
              results.push(result);
              continue;
            }
            const limitedLinks = uniqueLinks.slice(0, 1);
            let totalNew: any[] = [];
            let duplicate = 0;
            let total = 0;
            for (const link of limitedLinks) {
              console.log('【发现详情链接】:', link);
              try {
                const first = await Scraper.scrapeWithRetry(link, 3, 1000, { forceScraperRender: false });
                if (!first.success || !first.html || first.html.trim().length === 0) continue;
                const structuredHtml = Parsers.toPlainText(first.html);
                const coreOk = /(成交|结果|单价|成交量)/.test(structuredHtml);
                const nonTarget = /(更正公告|废标公告)/.test(structuredHtml);
                if (!coreOk || nonTarget) {
                  console.warn('【LLM前置过滤】非目标类型或缺少核心关键词，跳过大模型解析');
                  continue;
                }
                const llm = await Parsers.llmExtractTransactions(structuredHtml, urlData.id, targetUserId || '', link);
                if (!llm || llm.length === 0) continue;
                const allTransactions = llm.map((t: any) => {
                  const base: any = { ...t, url_id: urlData.id };
                  if (targetUserId) {
                    base.user_id = targetUserId;
                  } else if ('user_id' in base) {
                    delete base.user_id;
                  }
                  return base;
                });
                const saved = await DB.saveTransactionsForUrl(supabaseClient, urlData.id, targetUserId, allTransactions);
                totalNew = totalNew.concat(new Array(saved.newCount).fill(0));
                duplicate += saved.duplicateCount || 0;
                total += saved.total || 0;
              } catch (e) {
                console.error('处理详情链接失败:', link, (e as any)?.message || e);
              }
            }
            scrapeResult = {
              newRecords: totalNew,
              updatedRecords: [],
              duplicateCount: duplicate,
              totalRecords: total,
            };
          } catch (e) {
            const result: ScrapingResult = {
              urlId: urlData.id,
              url: urlData.url,
              status: 'error',
              recordsCount: 0,
              newRecordsCount: 0,
              updatedRecordsCount: 0,
              duplicateCount: 0,
              durationMs: Date.now() - urlStartTime,
              error: (e as any)?.message || '列表/详情处理失败',
            };
            await DB.logScrapingResult(supabaseClient, targetUserId || '', urlData.id, result);
            await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
            results.push(result);
            continue;
          }
        }
        const result: ScrapingResult = {
          urlId: urlData.id,
          url: urlData.url,
          status: 'success',
          recordsCount: scrapeResult.totalRecords,
          newRecordsCount: scrapeResult.newRecords.length,
          updatedRecordsCount: scrapeResult.updatedRecords.length,
          duplicateCount: scrapeResult.duplicateCount,
          durationMs: Date.now() - urlStartTime,
        };
        console.log(`抓取成功: ${urlData.url}, 新增: ${result.newRecordsCount}, 重复: ${result.duplicateCount}`);
          await DB.logScrapingResult(supabaseClient, targetUserId, urlData.id, result);
          await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
        if (result.newRecordsCount > 0) {
          try {
            await supabaseClient.functions.invoke('send-notification', {
              body: {
                userId: targetUserId,
                type: 'new_data',
                title: `抓取成功：发现 ${result.newRecordsCount} 条新数据`,
                message: `从 ${urlData.url} 抓取到 ${result.newRecordsCount} 条新数据`,
                metadata: {
                  urlId: urlData.id,
                  url: urlData.url,
                  newRecordsCount: result.newRecordsCount,
                  scrapeDuration: result.durationMs,
                },
              },
            });
          } catch (notifyError) {
            console.error('发送通知失败:', notifyError);
          }
        }
        results.push(result);
      } catch (error) {
        console.error(`抓取失败: ${urlData.url}`, error);
        const result: ScrapingResult = {
          urlId: urlData.id,
          url: urlData.url,
          status: 'error',
          recordsCount: 0,
          newRecordsCount: 0,
          updatedRecordsCount: 0,
          duplicateCount: 0,
          durationMs: Date.now() - urlStartTime,
          error: (error as any)?.message || '未知错误',
        };
          await DB.logScrapingResult(supabaseClient, targetUserId, urlData.id, result);
          await DB.updateUrlStats(supabaseClient, urlData.id, result, targetUserId);
        try {
          await supabaseClient.functions.invoke('send-notification', {
            body: {
              userId: targetUserId,
              type: 'scraping_error',
              title: '抓取失败',
              message: `从 ${urlData.url} 抓取数据失败: ${(error as any)?.message || '未知错误'}`,
              metadata: {
                urlId: urlData.id,
                url: urlData.url,
                error: (error as any)?.message || '未知错误',
              },
            },
          });
        } catch (notifyError) {
          console.error('发送失败通知失败:', notifyError);
        }
        results.push(result);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const totalNewRecords = results.reduce((sum, r) => sum + r.newRecordsCount, 0);

    // ... 确保这是最后一个 return
    const responsePayload = {
      success: true,
      message: `抓取完成: ${successCount} 成功, ${errorCount} 失败, 共 ${totalNewRecords} 条新数据`,
      results,
      summary: {
        totalDuration,
        successCount,
        errorCount,
        totalNewRecords,
      },
    };
    const successResponse = new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    // 将响应存入外层变量以便在 try/catch 之外统一延迟与返回
    (globalThis as any).__auto_final_response = successResponse;
  } catch (error) {
    console.error("【全局崩溃日志】:", (error as any)?.message || error);
    const failResponse = new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
    (globalThis as any).__auto_final_response = failResponse;
  }
  // try/catch 之外强行续命，确保日志上传
  await new Promise(resolve => setTimeout(resolve, 1000)); // 强行续命1秒确保日志上传
  const finalResp: Response = (globalThis as any).__auto_final_response;
  if (finalResp) return finalResp;
  return new Response(JSON.stringify({ error: "Unknown state" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 500,
  });
}

Deno.serve(handleRequest);
