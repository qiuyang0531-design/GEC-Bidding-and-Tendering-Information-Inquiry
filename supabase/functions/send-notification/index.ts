import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendNotificationRequest {
  userId: string;
  type: 'scraping_success' | 'scraping_error' | 'new_data';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // 使用service role key以绕过RLS
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 解析请求体
    const { userId, type, title, message, link, metadata, sendEmail = false }: SendNotificationRequest = await req.json();

    if (!userId || !type || !title || !message) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`创建通知: userId=${userId}, type=${type}, title=${title}`);

    // 1. 创建站内通知记录
    const { data: notification, error: insertError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error('创建通知失败:', insertError);
      throw insertError;
    }

    console.log('站内通知创建成功:', notification.id);

    // 2. 如果需要发送邮件通知
    let emailSent = false;
    if (sendEmail) {
      try {
        // 获取用户邮箱
        const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

        if (userError) {
          console.error('获取用户信息失败:', userError);
        } else if (user?.email) {
          // 发送邮件（使用Supabase Auth的邮件功能）
          // 注意：这里使用简单的邮件发送，实际生产环境可能需要使用专门的邮件服务
          console.log(`准备发送邮件到: ${user.email}`);

          // 构建邮件内容
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${title}</h2>
              <p style="color: #666; line-height: 1.6;">${message}</p>
              ${metadata ? `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px;">
                  <h3 style="margin-top: 0;">详细信息</h3>
                  <ul style="list-style: none; padding: 0;">
                    ${Object.entries(metadata).map(([key, value]) =>
                      `<li><strong>${key}:</strong> ${value}</li>`
                    ).join('')}
                  </ul>
                </div>
              ` : ''}
              ${link ? `
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${link}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">查看详情</a>
                </div>
              ` : ''}
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                这是一封自动发送的邮件，请勿回复。
              </p>
            </div>
          `;

          // 使用Supabase的邮件发送功能
          // 注意：这里需要配置邮件服务，例如使用Resend、SendGrid等
          // Supabase本身不提供直接的邮件发送API，需要集成第三方服务
          console.log('邮件发送功能需要配置第三方邮件服务（Resend、SendGrid等）');

          // 临时方案：记录到日志
          console.log('邮件内容:', emailHtml);
        }
      } catch (emailError) {
        console.error('发送邮件失败:', emailError);
        // 邮件发送失败不影响通知创建
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationId: notification.id,
        emailSent,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('发送通知失败:', error);
    return new Response(
      JSON.stringify({
        error: '发送通知失败',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
