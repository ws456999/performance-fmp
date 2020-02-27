# performance-fmp


## Introduction

无埋点方式计算页面`PERFORMANCE TIMING`,包括
- PERFORMANCE
- FCP
- FMP
- TTI时间
- domNode meaningful paint timing

## install

```shell
  npm i performance-fmp --save
```

## usage
```
import Performance from 'performance-fmp';

// 获取performance数据
Performance.getTiming().then((data) => {
  /* data include performance fmp fcp tti etc. */
  console.log(data);
});

// 添加配置
Performance.getTiming({
  duration: 5000; // fmp tti 超时时间设置
}).then((data) => {
  /* data include performance fmp fcp tti etc. */
  console.log(data);
});

// 获取 node meaningful paint timing
Performance.getNodeMP({
  duration: 3000,
  node: document.querySelector('.app'),
}).then(({fmp}) => {
  console.log(fmp)
});

```

## Contribution

Please send pull requests improving the usage and fixing bugs, improving documentation and providing better examples, or providing some testing, because these things are important.

## License

performance-fmp is available under the [MIT license](https://tldrlegal.com/license/mit-license).