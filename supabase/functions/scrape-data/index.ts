import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  urlId: string;
  url: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 创建Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 获取当前用户
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 解析请求体
    const { urlId, url }: RequestBody = await req.json();

    if (!urlId || !url) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 抓取网页数据
    console.log(`开始抓取: ${url}`);
    const response = await fetch(url);
    const html = await response.text();

    // 这里是一个简化的示例解析逻辑
    // 实际应用中需要根据具体网站的HTML结构进行解析
    // 可以使用正则表达式或HTML解析库来提取数据
    
    // 示例：提取一些模拟数据
    // 在实际应用中，您需要根据目标网站的HTML结构来编写具体的解析逻辑
    const transactions = parseHtmlData(html, urlId, user.id);

    // 如果有数据，插入到数据库
    if (transactions.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('transactions')
        .insert(transactions);

      if (insertError) {
        console.error('插入数据失败:', insertError);
        return new Response(
          JSON.stringify({ error: '保存数据失败', details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功抓取 ${transactions.length} 条数据`,
        count: transactions.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('抓取失败:', error);
    return new Response(
      JSON.stringify({ error: '抓取失败', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// 解析HTML数据的函数
// 这是一个示例实现，实际应用中需要根据目标网站的HTML结构进行定制
function parseHtmlData(html: string, urlId: string, userId: string): any[] {
  const transactions: any[] = [];

  // 示例：使用正则表达式提取数据
  // 实际应用中需要根据目标网站的HTML结构编写具体的解析逻辑
  
  // 需要提取的字段：
  // 1. project_name - 项目名称（必填）
  // 2. bidding_unit - 招标单位
  // 3. bidder_unit - 投标单位
  // 4. winning_unit - 中标单位
  // 5. total_price - 总价（数字）
  // 6. quantity - 成交量（数字，绿证数量）
  // 7. unit_price - 绿证单价（数字，2025年约7元）
  // 8. detail_link - 具体标的信息链接
  // 9. is_channel - 通道类型（布尔值或null）
  //    - true: 通道
  //    - false: 非通道
  //    - null: 未标注（显示为"-"）
  // 10. cert_year - 绿证年份（文本格式）
  //    - 单年份: "2025"
  //    - 多年份: "2024/2025" 或 "2024-2026"
  // 11. bid_start_date - 招标开始日期（格式：YYYY-MM-DD）
  // 12. bid_end_date - 招标结束日期（格式：YYYY-MM-DD）
  // 13. award_date - 中标日期（格式：YYYY-MM-DD）
  
  // 示例：查找表格行或列表项
  // const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  // const matches = html.matchAll(tableRowRegex);
  
  // for (const match of matches) {
  //   const rowHtml = match[1];
  //   // 从行中提取数据字段
  //   const transaction = {
  //     url_id: urlId,
  //     user_id: userId,
  //     project_name: extractField(rowHtml, 'project'),
  //     bidding_unit: extractField(rowHtml, 'bidding'),
  //     bidder_unit: extractField(rowHtml, 'bidder'),
  //     winning_unit: extractField(rowHtml, 'winning'),
  //     total_price: parseFloat(extractField(rowHtml, 'total_price')) || null,
  //     quantity: parseFloat(extractField(rowHtml, 'quantity')) || null, // 成交量（绿证数量）
  //     unit_price: parseFloat(extractField(rowHtml, 'unit_price')) || null,
  //     detail_link: extractField(rowHtml, 'link'),
  //     is_channel: parseChannelType(extractField(rowHtml, 'channel')),
  //     cert_year: extractField(rowHtml, 'year') || null, // 文本格式，支持"2025"或"2024/2025"
  //     bid_start_date: extractField(rowHtml, 'bid_start') || null, // 招标开始日期
  //     bid_end_date: extractField(rowHtml, 'bid_end') || null, // 招标结束日期
  //     award_date: extractField(rowHtml, 'award') || null, // 中标日期
  //   };
  //   transactions.push(transaction);
  // }
  
  // 通道类型解析辅助函数
  // function parseChannelType(text: string): boolean | null {
  //   if (!text || text === '-' || text.trim() === '') return null;
  //   if (text.includes('通道') && !text.includes('非')) return true;
  //   if (text.includes('非通道')) return false;
  //   return null;
  // }

  // 返回示例数据（实际应用中应该返回解析后的真实数据）
  console.log('HTML长度:', html.length);
  console.log('注意：这是示例实现，需要根据实际网站HTML结构编写解析逻辑');
  console.log('需要提取的字段：项目名称、招标单位、投标单位、中标单位、总价、成交量、绿证单价、详情链接、通道类型、绿证年份、招标开始日期、招标结束日期、中标日期');

  return transactions;
}

// 辅助函数：从HTML片段中提取字段
// function extractField(html: string, fieldType: string): string {
//   // 根据字段类型和HTML结构提取数据
//   // 这需要根据实际网站的HTML结构来实现
//   return '';
// }
