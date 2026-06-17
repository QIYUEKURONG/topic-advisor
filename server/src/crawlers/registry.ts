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
} from './baidu-news-search.js';
import { ithome } from './ithome.js';
import { jiqizhixin } from './jiqizhixin.js';
import { qbitai } from './qbitai.js';

const ALL_CRAWLERS: CrawlerAdapter[] = [
  sinaSociety,
  neteaseNews,
  sohuEnt,
  tencentNews,
  ifengNews,
  thepaper,
  baiduHot,
  kr36,
  xiaohongshu,
  bilibiliHot,
  weiboHot,
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
  ithome,
  jiqizhixin,
  qbitai,
];

export function getEnabledCrawlers(enabledIds: string[]): CrawlerAdapter[] {
  return ALL_CRAWLERS.filter((c) => enabledIds.includes(c.id));
}

export function getAllCrawlers(): CrawlerAdapter[] {
  return ALL_CRAWLERS;
}
