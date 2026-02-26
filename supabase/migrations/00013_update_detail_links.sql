-- 更新交易数据的详情链接
-- 将 urls 表中的 url 同步到 transactions 表的 detail_link 字段

UPDATE transactions t
SET detail_link = u.url
FROM urls u
WHERE t.url_id = u.id
  AND t.detail_link IS NULL;

-- 验证更新结果
SELECT
  t.id,
  t.project_name,
  t.detail_link,
  u.url as source_url
FROM transactions t
JOIN urls u ON t.url_id = u.id
LIMIT 10;
