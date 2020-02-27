import 'mutationobserver-shim';
import { getPerformanceTiming, PerformanceData } from "./getPerformanceTiming";

/**
 * 参考 https://github.com/xingqiao/fmp-tti
 */

/** 渲染统计点 */
interface SpdPoint {
  /** 距离 起始时间 | navigationStart 时间 */
  t: number;
  /** 和上一个点相比增加得分 */
  s: number;
  /** FMP得分 */
  m: number;
  /** 用链表的方式记录上一个渲染点 */
  p: SpdPoint | undefined;
}

/** 测速结果 */
export interface SpdResult {
  /** fcp时间 */
  fcp: number;
  /** fmp时间 */
  fmp: number;
  /** tti时间 */
  tti: number;
}

export interface FTprops {
  duration?: number;
  FMP_DURATION?:number;
  getNow?: () => number;
}

/**
 * 是否是有内容的文本标签
 * @param {Node} node 元素节点
 */
export function isContentText(node: Node): boolean {
  const haveText = !!getText(node)

  const isTextNode = node &&
  node.nodeType === 3 && haveText

  const isElementTextNode = (
    node &&
    node.nodeType === 1 &&
    haveText &&
    isContentElement(node.parentElement)
  )


  // nodeType可能是1或者3
  return (isTextNode || isElementTextNode);
}

/**
 * 是否是有效的内容标签
 * @param {HTMLElement} node 元素节点
 */
export function isContentElement(node: HTMLElement | null): boolean {
  let tagName = node && node.tagName;
  return !!tagName && !/^(?:HEAD|META|LINK|STYLE|SCRIPT)$/.test(tagName);
}

/**
 * 获取节点文本内容
 * @param {Node} node 元素节点
 * @returns {string} 文本内容
 */
export function getText(node: Node): string {
  let text = node.textContent;
  return text && text.trim() || '';
}

const {
  innerHeight: windowHeight,
  performance,
  setTimeout,
  MutationObserver,
} = window;

class FT {
  /** 页面周期，超过x秒强制上报 */
  public duration: number;
  public result: SpdResult | undefined;
  /** 是否开启统计 */
  public enabled: boolean;
  /** 是否已经完成检测 */
  public ended: boolean;

  /** FCP（首次内容渲染） */
  public fcp: SpdPoint | undefined;
  /** FMP（首次有意义渲染） */
  public fmp: SpdPoint | undefined;
  /** 获取从 navigationStart 到当前的时间 */
  public getNow: () => number;
  /** FMP计算区间 */
  private FMP_DURATION: number;
  private currentPaintPoint: SpdPoint | undefined;
  // private lastResult: string;
  private timer = 0;
  private ttiDuration = 1;

  constructor(props: FTprops) {
    const timing = performance && performance.timing;
    /** 开始时间 */
    const START_TIME: number = timing && timing.navigationStart;
    this.duration = props.duration || 10000;
    this.FMP_DURATION = props.FMP_DURATION || 50;
    this.enabled = !!(START_TIME && MutationObserver);
    this.ended = !this.enabled;
    this.getNow =
      props.getNow ||
      (() => {
        return Date.now() - START_TIME;
      });
    this.checkTTI();
  }

  // /**
  //  * 获取从 navigationStart 到当前的时间
  //  * @returns {number}
  //  */
  // public getNow = (): number => {
  //   return Date.now() - START_TIME;
  // };

  /**
   * 提取检测结果
   * @param {number} tti tti时间
   */
  public setResult = (tti: number) => {
    this.result = {
      fcp: this.fcp ? this.fcp.t : tti,
      fmp: this.fmp ? this.fmp.t : tti,
      tti,
    };
  };
  /**
   * 测试节点列表得分
   * @param {NodeList} nodes 节点列表
   * @returns {number} 得分
   */
  public checkNodeList = (nodes: NodeList): number => {
    let score = 0;
    for (let i = 0, l = nodes.length; i < l; i++) {
      const node = nodes[i];
      if ((node as HTMLElement).tagName === 'IMG') {
        node.addEventListener('load', this.addImgScore);
      } else if (isContentElement(node as HTMLElement)) {
        score += this.checkNodeScore(node as HTMLElement);
      } else if (isContentText(node)) {
        score += 1;
      }
    }
    return score;
  };
  /**
   * 记录每阶段得分变化
   * @param {number} score 本次得分
   */
  public addScore = (score: number) => {
    const { getNow, FMP_DURATION, checkTTI } = this;
    if (score > 0) {
      const time = getNow();
      let paintPoint: SpdPoint = {
        t: getNow(),
        s: score,
        m: 0,
        p: this.currentPaintPoint,
      };
      this.currentPaintPoint = paintPoint;
      if (!this.fcp) {
        this.fcp = paintPoint;
      }
      // 选取得分变化最大的区间中得分变化最大的点作为FMP
      let targetFmp = paintPoint;
      // tslint:disable-next-line:no-conditional-assignment
      while ((paintPoint = paintPoint.p as SpdPoint)) {
        if (time - paintPoint.t > FMP_DURATION) {
          // 超过判断区间，中断链表遍历
          delete paintPoint.p;
        } else {
          score += paintPoint.s;
          if (paintPoint.s > targetFmp.s) {
            targetFmp = paintPoint;
          }
        }
      }
      const fmpScore = this.fmp ? this.fmp.m : 0;
      if (score >= fmpScore) {
        targetFmp.m = score;
        if (this.fmp !== targetFmp) {
          this.fmp = targetFmp;
          checkTTI();
        }
      }
    }
  };
  /**
   * 测试节点得分
   * @param {HTMLElement} node 待检测节点
   * @returns {number} 得分
   */
  private checkNodeScore = (node: HTMLElement): number => {
    let score = 0;
    let domReac: DOMRect;
    let childNodes: NodeList;
    if (node !== document.body) {
      // 只看一屏内的标签
      domReac = node.getBoundingClientRect() as DOMRect;
      if (domReac.top < windowHeight) {
        if (domReac.width > 0 && domReac.height > 0) {
          if (node.tagName !== 'IMG') {
            if (
              getText(node) ||
              getComputedStyle(node).backgroundImage !== 'none'
            ) {
              // 只统计首屏内元素，不再需要根据top值来计算得分
              // score += top > windowHeight ? (windowHeight / top) * (windowHeight / top) : 1;
              score = 1;
              // 加上子元素得分
              childNodes = node.childNodes;
              if (childNodes && childNodes.length) {
                score += this.checkNodeList(childNodes);
              }
            }
          } else if (!!(node as HTMLImageElement).src) {
            score = 1;
          }
        }
      }
    }
    return score;
  };

  /**
   * 检测可交互时间
   */
  private checkTTI = () => {
    const { enabled, ended, getNow, duration, setResult } = this;
    clearTimeout(this.timer);
    // 标记开始计算TTI
    let startTime: number;
    let lastLongTaskTime: number;
    let lastFrameTime: number;
    let currentFrameTime: number;
    let taskTime: number;
    const checkLongTask = () => {
      if (enabled && !ended) {
        lastFrameTime = getNow();
        if (!startTime) {
          startTime = lastLongTaskTime = lastFrameTime;
        }
        // ios 不支持 requestIdleCallback，所以都使用 setTimeout
        this.timer = setTimeout(() => {
          currentFrameTime = getNow();
          taskTime = currentFrameTime - lastFrameTime;
          // 模仿tcp拥塞控制方式，根据耗时变化动态调整检测间隔，减少CPU消耗
          if (taskTime - this.ttiDuration < 10) {
            if (this.ttiDuration < 16) {
              this.ttiDuration = this.ttiDuration * 2;
            } else if (this.ttiDuration < 25) {
              this.ttiDuration = this.ttiDuration + 1;
            } else {
              this.ttiDuration = 25;
            }
          } else if (taskTime > 50) {
            this.ttiDuration = Math.max(1, this.ttiDuration / 2);
          }
          if (currentFrameTime - lastFrameTime > 50) {
            lastLongTaskTime = currentFrameTime;
          }
          if (
            currentFrameTime - lastLongTaskTime > 1000 ||
            currentFrameTime > duration
          ) {
            setResult(lastLongTaskTime);
          } else {
            checkLongTask();
          }
        }, this.ttiDuration);
      }
    };
    checkLongTask();
  };

  /**
   * 计算并记录图片节点得分
   * @param {Event} event
   */
  private addImgScore = (node: any) => {
    this.addScore(this.checkNodeScore(node.target));
    node.target.removeEventListener('load', this.addImgScore);
  };
}

/**
 * 获取首次渲染FCP, FMP, TTI, performanceTiming
 */
export const getTiming = (props: FTprops = {}): Promise<SpdResult & PerformanceData> => {
  return new Promise((resolve) => {
    const ft = new FT(props);
    const observer = new MutationObserver((records: MutationRecord[]) => {
      // 等到body标签初始化完才开始计算
      if (ft.enabled && document.body) {
        let score = 0;
        records.forEach((record) => {
          score += ft.checkNodeList(record.addedNodes);
        });
        ft.addScore(score);
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
    });
    // 上报统计结果
    setTimeout(() => {
      if (!ft.ended) {
        ft.ended = true;
        if (!ft.result) {
          ft.setResult(ft.getNow());
        }
        observer.disconnect();
        if (ft.enabled) {
          const PerformanceData = getPerformanceTiming()
          resolve({...PerformanceData, ...(ft.result as SpdResult) });
        }
      }
    }, ft.duration);
  });
};

/**
 * 计算node的MP
 */
export const getNodeMP = (props: FTprops & {
  node: HTMLElement
}): Promise<SpdResult> => {
  const { duration = 5000, node } = props;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const ft = new FT({
      duration,
      getNow: () => {
        return Date.now() - startTime;
      },
    });
    const observer = new MutationObserver((records: MutationRecord[]) => {
      // 等到body标签初始化完才开始计算
      let score = 0;
      records.forEach((record) => {
        score += ft.checkNodeList(record.addedNodes);
      });
      ft.addScore(score);
    });
    observer.observe(node, {
      childList: true,
      subtree: true,
    });

    // 上报统计结果
    setTimeout(() => {
      observer.disconnect();
      // 如果页面没更新的话，reject
      if (!ft.fcp && !ft.fmp) {
        reject()
        return
      };
      ft.setResult(ft.getNow());
      resolve(ft.result);
    }, duration);
  });
};
