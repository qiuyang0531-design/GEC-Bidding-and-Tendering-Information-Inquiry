/**
 * 临时脚本：更新交易数据的详情链接
 * 使用方法：在浏览器控制台执行此脚本
 */

async function updateDetailLinks() {
  // 获取当前用户
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('请先登录');
    return;
  }

  console.log('开始更新详情链接...');

  // 1. 获取所有URLs
  const { data: urls, error: urlsError } = await supabase
    .from('urls')
    .select('id, url')
    .eq('user_id', user.id);

  if (urlsError) {
    console.error('获取URLs失败:', urlsError);
    return;
  }

  console.log(`找到 ${urls.length} 个URL`);

  // 2. 创建URL映射
  const urlMap = {};
  urls.forEach(u => {
    urlMap[u.id] = u.url;
  });

  // 3. 获取所有没有detail_link的交易
  const { data: transactions, error: transError } = await supabase
    .from('transactions')
    .select('id, url_id')
    .eq('user_id', user.id)
    .is('detail_link', null);

  if (transError) {
    console.error('获取交易数据失败:', transError);
    return;
  }

  console.log(`找到 ${transactions.length} 条需要更新的交易`);

  if (transactions.length === 0) {
    console.log('没有需要更新的数据');
    return;
  }

  // 4. 批量更新
  let updatedCount = 0;
  for (const trans of transactions) {
    const url = urlMap[trans.url_id];
    if (!url) {
      console.warn(`URL ${trans.url_id} 不存在`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ detail_link: url })
      .eq('id', trans.id);

    if (updateError) {
      console.error(`更新交易 ${trans.id} 失败:`, updateError);
    } else {
      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`已更新 ${updatedCount} 条...`);
      }
    }
  }

  console.log(`✅ 完成！共更新 ${updatedCount} 条交易数据`);

  // 5. 验证结果
  const { data: sample } = await supabase
    .from('transactions')
    .select('id, project_name, detail_link')
    .eq('user_id', user.id)
    .limit(5);

  console.log('示例数据:', sample);
}

// 执行更新
updateDetailLinks();
