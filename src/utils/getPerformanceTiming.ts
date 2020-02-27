export type PerformanceData =  {
  loadPage: number;
  domReady: number;
  redirect: number;
  lookupDomain: number;
  ttfb: number;
  request: number;
  loadEvent: number;
  appcache: number;
  unloadEvent: number;
  connect: number;
  fp: number;
} | {}

export function getPerformanceTiming(): PerformanceData {
  const performance = window.performance;
  if (!performance) {
    // 当前浏览器不支持
    console.log('你的浏览器不支持 performance 接口');
    return {};
  }
  const timing = performance.timing;
  const times = {
    // 【重要】页面加载完成的时间
    // 【原因】这几乎代表了用户等待页面可用的时间
    loadPage: timing.loadEventEnd - timing.navigationStart,
    // 【重要】解析 DOM 树结构的时间
    // 【原因】反省下你的 DOM 树嵌套是不是太多了！
    domReady: timing.domComplete - timing.responseEnd,
    // 【重要】重定向的时间
    // 【原因】拒绝重定向！比如，http://example.com/ 就不该写成 http://example.com
    redirect: timing.redirectEnd - timing.redirectStart,
    // 【重要】DNS 查询时间
    // 【原因】DNS 预加载做了么？页面内是不是使用了太多不同的域名导致域名查询的时间太长？
    // 可使用 HTML5 Prefetch 预查询 DNS ，见：[HTML5 prefetch](http://segmentfault.com/a/1190000000633364)
    lookupDomain: timing.domainLookupEnd - timing.domainLookupStart,
    // 【重要】读取页面第一个字节的时间
    // 【原因】这可以理解为用户拿到你的资源占用的时间，加异地机房了么，加CDN 处理了么？加带宽了么？加 CPU 运算速度了么？
    // TTFB 即 Time To First Byte 的意思
    // 维基百科：https://en.wikipedia.org/wiki/Time_To_First_Byte
    ttfb: timing.responseStart - timing.navigationStart,
    // 【重要】内容加载完成的时间
    // 【原因】页面内容经过 gzip 压缩了么，静态资源 css/js 等压缩了么？
    request: timing.responseEnd - timing.requestStart,
    // 【重要】执行 onload 回调函数的时间
    // 【原因】是否太多不必要的操作都放到 onload 回调函数里执行了，考虑过延迟加载、按需加载的策略么？
    loadEvent: timing.loadEventEnd - timing.loadEventStart,
    // DNS 缓存时间
    appcache: timing.domainLookupStart - timing.fetchStart,
    // 卸载页面的时间
    unloadEvent: timing.unloadEventEnd - timing.unloadEventStart,
    // TCP 建立连接完成握手的时间
    connect: timing.connectEnd - timing.connectStart,
    fp: 0,
  };

  if (performance.getEntriesByType) {
    if (
      performance.getEntriesByType('paint') &&
      performance.getEntriesByType('paint')[0]
    ) {
      times.fp = performance.getEntriesByType('paint')[0].startTime;
    }
  }

  return times;
}