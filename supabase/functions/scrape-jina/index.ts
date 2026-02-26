import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
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
    console.log('=== Jina Scraper Edge Function ===');

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing URL parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Fetching URL via Jina AI Reader:', url);

    // 使用 Jina AI Reader API
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/markdown',
      },
    });

    if (!response.ok) {
      console.error('Jina AI Reader failed:', response.status, response.statusText);

      // 如果是 429 错误，返回特殊信息
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Jina AI Reader rate limit exceeded',
            code: 'RATE_LIMIT',
            retryAfter: 60,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch URL: ${response.statusText}`,
          code: response.status,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const markdown = await response.text();
    console.log(`✅ Successfully fetched ${markdown.length} characters from Jina AI Reader`);

    // 返回前500个字符作为预览
    const preview = markdown.substring(0, 500);

    return new Response(
      JSON.stringify({
        success: true,
        url: url,
        markdown: markdown,
        preview: preview,
        length: markdown.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error.message, error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
