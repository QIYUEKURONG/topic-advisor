import type { CrawlerAdapter } from '../types.js';
import { sinaSociety } from './sina.js';
import { neteaseNews } from './netease.js';
import { sohuEnt } from './sohu.js';
import { bilibiliHot } from './bilibili.js';
import { weiboHot } from './weibo.js';
import { tencentNews } from './tencent.js';
import { ifengNews } from './ifeng.js';
import { thepaper } from './thepaper.js';
import { baiduHot } from './baidu.js';
import { kr36 } from './kr36.js';
import { xiaohongshu } from './xiaohongshu.js';
import {
  baiduAISearch, baiduInvestSearch,
  baiduEntSearch, baiduSportsSearch, baiduHealthSearch,
  baiduTechSearch, baiduCarSearch, baiduEduSearch,
  baiduFoodSearch, baiduHouseSearch, baiduPsychSearch,
  baiduSideHustleSearch,
} from './baidu-news-search.js';
import { v2exSideHustle } from './v2ex.js';
import { zhihuSideHustleSearch, xhsSideHustleSearch } from './bing-site-search.js';
import { wechatHot } from './sogou-wechat.js';
import { ithome } from './ithome.js';
import { jiqizhixin } from './jiqizhixin.js';
import { qbitai } from './qbitai.js';
import { toutiaoHot } from './toutiao-hot.js';
import { zhihuHot } from './zhihu.js';
import { huxiu } from './huxiu.js';
import { guancha } from './guancha.js';
import { clsFinance } from './cls.js';
import { douyinHot } from './douyin-hot.js';
import { peopleDaily, bbc_zh, infzm, jiemian, wallstreetcn, caixin } from './rss.js';

const ALL_CRAWLERS: CrawlerAdapter[] = [
  // Core news sites
  sinaSociety,
  neteaseNews,
  sohuEnt,
  tencentNews,
  ifengNews,
  thepaper,
  baiduHot,
  kr36,
  ithome,
  // Social & hot lists
  xiaohongshu,
  bilibiliHot,
  weiboHot,
  toutiaoHot,
  zhihuHot,
  douyinHot,
  // Deep content
  huxiu,
  guancha,
  clsFinance,
  jiqizhixin,
  qbitai,
  // Baidu topic searches
  baiduAISearch,
  baiduInvestSearch,
  baiduEntSearch,
  baiduSportsSearch,
  baiduHealthSearch,
  baiduTechSearch,
  baiduCarSearch,
  baiduEduSearch,
  baiduFoodSearch,
  baiduHouseSearch,
  baiduPsychSearch,
  baiduSideHustleSearch,
  // WeChat trend monitoring
  wechatHot,
  // Side-hustle sources
  v2exSideHustle,
  zhihuSideHustleSearch,
  xhsSideHustleSearch,
  // RSS feeds
  peopleDaily,
  bbc_zh,
  infzm,
  jiemian,
  wallstreetcn,
  caixin,
];

export function getEnabledCrawlers(enabledIds: string[]): CrawlerAdapter[] {
  return ALL_CRAWLERS.filter((c) => enabledIds.includes(c.id));
}

export function getAllCrawlers(): CrawlerAdapter[] {
  return ALL_CRAWLERS;
}
