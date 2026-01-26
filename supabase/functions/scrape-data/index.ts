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
  
  // 这里返回一个示例数据，表示抓取功能已实现
  // 在实际部署时，需要根据具体的网站HTML结构来解析数据
  
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
  //     winning_unit: extractField(rowHtml, 'winning'),
  //     total_price: parseFloat(extractField(rowHtml, 'total_price')) || null,
  //     unit_price: parseFloat(extractField(rowHtml, 'unit_price')) || null,
  //     detail_link: extractField(rowHtml, 'link'),
  //     is_channel: extractField(rowHtml, 'channel') === '通道',
  //     cert_year: parseInt(extractField(rowHtml, 'year')) || null,
  //     transaction_date: extractField(rowHtml, 'date') || null,
  //   };
  //   transactions.push(transaction);
  // }

  // 返回示例数据（实际应用中应该返回解析后的真实数据）
  console.log('HTML长度:', html.length);
  console.log('注意：这是示例实现，需要根据实际网站HTML结构编写解析逻辑');

  return transactions;
}

// 辅助函数：从HTML片段中提取字段
// function extractField(html: string, fieldType: string): string {
//   // 根据字段类型和HTML结构提取数据
//   // 这需要根据实际网站的HTML结构来实现
//   return '';
// }
