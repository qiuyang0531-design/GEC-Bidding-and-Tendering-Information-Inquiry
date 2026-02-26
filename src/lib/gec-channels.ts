/**
 * GEC 频道配置
 * 定义要抓取的招标网站频道
 */

export interface GECChannel {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}

// 中国南方电网招标网站频道配置
export const CSG_CHANNELS: GECChannel[] = [
  {
    id: 'zbgg',
    name: '招标公告',
    url: 'http://www.bidding.csg.cn/zbgg/index.jhtml',
    description: '公开招标信息，可能包含绿证项目',
    enabled: true,
  },
  {
    id: 'cggg',
    name: '采购公告',
    url: 'http://www.bidding.csg.cn/cggg/index.jhtml',
    description: '采购公告信息，主要来源',
    enabled: true,
  },
  {
    id: 'zbhxr',
    name: '中标候选人',
    url: 'http://www.bidding.csg.cn/zbhxr/index.jhtml',
    description: '中标候选人公示，已成交项目',
    enabled: true,
  },
  {
    id: 'lxcggg',
    name: '零星采购',
    url: 'http://www.bidding.csg.cn/lxcggg/index.jhtml',
    description: '零星采购公告',
    enabled: true,
  },
];

/**
 * 获取已启用的频道
 */
export function getEnabledChannels(): GECChannel[] {
  return CSG_CHANNELS.filter(ch => ch.enabled);
}

/**
 * 根据频道ID获取频道信息
 */
export function getChannelById(id: string): GECChannel | undefined {
  return CSG_CHANNELS.find(ch => ch.id === id);
}
