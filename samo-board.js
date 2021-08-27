"use strict";
import cloneDeep from './lodash.clonedeep.js'
export default class samoBoard {
  #wrap;
  #ctx;
  #canvas;
  #dragOffset = {x:0,y:0};
  #zoomSize = 1;
  #oldZoomSize = 1;
  #bgList = [];
  #draws = [];
  #drawType = 'pointer';
  #pencilDownFn = undefined;
  #pencilMoveFn = undefined;
  #pencilUpFn = undefined;
  #pencilOutFn = undefined;
  #svgCursors = {
    location: {
      path: 'M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12 ,2Z',
      x: 0,
      y: 0,
      size: 1
    }
  }
  #hoverPoint = {
    x: 0,
    y: 0
  }
  #tmpDraw = {};
  #drawPrototype = {
    x: 0, // polygon, rect, arc, arcto use
    y: 0, // polygon, rect, arc, arcto use
    text: '', // text use
    lock: false, 
    width: 0, // rect use
    height: 0, // rect use
    radius: 0, // arc, arcto use
    startAngle: 0, // arc use
    endAngle: 0, // arc use
    ways:[ // polygon, arcto use
      // {
      //   x:0,
      //   y:0,
      // }
    ],
    type: 'rect', // polygon, arc, arcto, text
    drawType: 'rect', // 用户自定义
    rotate: 0,
    translate: [],
    gco: 'source-cover',
    strokeStyle: '#333',
    fillStyle: 'gray',
    lineWidth: 3
  };
  constructor(options={}) {
    this.opts = this.constructor.mergeDeep({
      wrap: undefined,
      autoAppend: true, // 是否自动把canvas append到父级容器
      ctxStyle: {
        strokeStyle: '#333',
        fillStyle: 'transparent',
        lineWidth: 3, 
        lineJoin: 'miter', // bevel, round, miter;
        lineCap: 'butt', // butt, round, square
        gco: 'source-cover'
      }
    }, options)
    this.#init();
  }
  #init() {
    if (this.opts.autoAppend) {
      if (!this.opts.wrap) {
        this.#wrap = document.createElement('div')
        this.#wrap.style.cssText = `width: 400px;height:300px;`
      } else {
        this.#wrap = this.opts.wrap;
      }
    }
    // console.log("初始化samo-board");
    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext('2d');
    if (this.#wrap) {
      this.#wrap.appendChild(this.#canvas);
      this.#canvas.height = this.#wrap.clientHeight
      this.#canvas.width = this.#wrap.clientWidth;
    }
    // this.#canvas.style.cssText = `display:grid;background-color: #fff;`
    this.#setCtx(this.#ctx, this.opts.ctxStyle)
    this.renderBoard()

    this.setDrawType()
    return this;
  }
  getCanvas() {
    return this.#canvas
  }
  setCanvasStyle(styles={}) {
    let _cStyleObj = {}
    if (this.#canvas.style.cssText.length) {
      let _stylesArray = this.#canvas.style.cssText.replace(/\;$/gi, '').split(';')
      for(let i=0;i<_stylesArray.length;i++) {
        const _obj = _stylesArray[i].split(':');
        _cStyleObj[_obj[0].trim()] = _obj[1].trim()
      }
    }
    
    for (let key in styles) {
      _cStyleObj[key] = styles[key]
    }
    let _style = []
    for(let key in _cStyleObj) {
      _style.push(`${key}:${_cStyleObj[key]}`)
    }
    return this.#canvas.style.cssText = _style.join(';');
  }
  static cloneDeep(params) {
    return cloneDeep(params)
  }
  static mergeDeep(...objects) {
    const isObject = (obj) => obj && obj.constructor === Object;
    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach((key) => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(...oVal);
        } else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = this.mergeDeep(pVal, oVal);
        } else {
          prev[key] = oVal;
        }
      });
      return prev;
    }, {});
  }
  #setCtx(ctx, configs={}){
    if (!ctx) {
      return;
    }
    for (let key in configs) {
      if (key === 'gco') {
        ctx.globalCompositeOperation = configs[key];
      } else {
        ctx[key] = configs[key];
      }
    }
  }
  #drawToSvgPath(polygon, svgout=false) {
    let _svg_path = [`M${polygon.x} ${polygon.y}`];
    polygon.ways.forEach(val => {
      _svg_path.push(`L${val.x} ${val.y}`);
    });
    _svg_path.push('Z');
    _svg_path = _svg_path.join(' ');
    // console.log(`_svg_path: ${_svg_path}`)
    if (svgout) {
      return _svg_path
    } else {
      return new Path2D(_svg_path);
    }
  }
  // 计算缩放后拖拉后的差值
  #calcZoomedDragoffsetDeltaSize(zoomin = true) {
    
    return this.#dragOffset;
  }
  // 计算当前缩放尺寸
  #calcCurrentZoomSize(size, plus = true, step = 0.01, min = 0.15, max = 2) {
    if (isNaN(size)) {
      console.warn('size param is not a number');
      return null;
    }
    this.#oldZoomSize = size;
    size = plus ? size + step : size - step;
    let _originScaled = 1;
    // if (this.bgObj.scaled) {
    //   _originScaled = this.bgObj.scaled
    // }
    // if (this.spliceBgList && this.spliceBgList.length) {
    //   _originScaled = this.spliceBgList[this.spliceBgList.length-1].scaled
    // }
    const _min = Math.min(_originScaled, 1);
    return Math.max(_min, Math.min(parseFloat(size.toFixed(3)), max));
  }
  // 还原缩放
  zoomReset() {
    // this.calcZoomedDragoffsetDeltaSize(false);
    if (this.bgObj && this.bgObj.data) {
      this.#dragOffset = {
        x: this.bgObj.offsetX,
        y: this.bgObj.offsetY
      };
      this.#zoomSize = this.bgObj.scaled;
    } else {
      this.#dragOffset = {
        x: 0,
        y: 0
      };
      this.#zoomSize = this.spliceBgList && this.spliceBgList.length ? this.spliceBgList[this.spliceBgList.length-1].scaled : 1;
    }
  }
  // 获取缩放倍数
  getZoomSize() {
    return {
      current: this.#zoomSize,
      default: this.bgObj ? this.bgObj.scaled : 1
    };
  }
  // 放大
  zoomIn(step = 0.05) {
    this.#zoomSize = this.#calcCurrentZoomSize(this.#zoomSize, true, step);
    if (this.#oldZoomSize !== this.#zoomSize) {
      this.#calcZoomedDragoffsetDeltaSize();
    }
  }
  // 缩小
  zoomOut(step = 0.05) {
    this.#zoomSize = this.#calcCurrentZoomSize(this.#zoomSize, false, step);
    if (this.#oldZoomSize !== this.#zoomSize) {
      this.#calcZoomedDragoffsetDeltaSize(false);
    }
  }
  // 设置画图类型
  setDrawType(type='pointer', options={}) {
    this.#drawType = type;
    this.#canvas.removeEventListener('mousedown', this.#pencilDownFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilMoveFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilUpFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilOutFn, false);
    if (this[`${this.#drawType}DownFn`]) {
      this.#pencilDownFn = e => this[`${this.#drawType}DownFn`](e, options);
      this.#canvas.addEventListener('mousedown', this.#pencilDownFn, false);
    }
    if (this[`${this.#drawType}MoveFn`]) {
      this.#pencilMoveFn = e => this[`${this.#drawType}MoveFn`](e, options);
      this.#canvas.addEventListener('mousemove', this.#pencilMoveFn, false);
    }
    if (this[`${this.#drawType}UpFn`]) {
      this.#pencilMoveFn = e => this[`${this.#drawType}UpFn`](e, options);
      this.#canvas.addEventListener('mouseup', this.#pencilUpFn, false);
    }
    if (this[`${this.#drawType}OutFn`]) {
      this.#pencilOutFn = e => this[`${this.#drawType}OutFn`](e, options);
      this.#canvas.addEventListener('mouseout', this.#pencilOutFn, false);
    }
  }
  #renderDraws() {
    // const _ctxStyle = this.constructor.mergeDeep(this.opts.ctxStyle, {
    //   strokeStyle: 'gray'
    // })
    // this.#setCtx(this.#ctx, _ctxStyle)
    this.#ctx.translate(100, 100);
    this.#ctx.stroke(this.renderCursor('location'))
  }
  renderCursor(cursorName) {
    return new Path2D(this.#svgCursors[cursorName].path)
  }
  setDrawsData(draws) {
    this.#draws = draws
  }
  setCustomDrawType({type, downFn, moveFn, upFn, outFn}) {
    this.#drawType = type;
    this.#canvas.removeEventListener('mousedown', this.#pencilDownFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilMoveFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilUpFn, false);
    this.#canvas.removeEventListener('mousedown', this.#pencilOutFn, false);
    let _params = {
      draws: cloneDeep(this.#draws),
      drawPrototype: cloneDeep(this.#drawPrototype)
    }
    if (downFn) {
      this.#pencilDownFn = (e) => downFn(e, _params)
      this.#canvas.addEventListener('mousedown', this.#pencilDownFn, false);
    }
    if (moveFn) {
      this.#pencilMoveFn = (e) => moveFn(e, _params)
      this.#canvas.addEventListener('mousemove', this.#pencilMoveFn, false);
    }
    if (upFn) {
      this.#pencilUpFn = (e) => upFn(e, _params)
      this.#canvas.addEventListener('mouseup', this.#pencilUpFn, false);
    }
    if (outFn) {
      this.#pencilOutFn = (e) => outFn(e, _params)
      this.#canvas.addEventListener('mouseout', this.#pencilOutFn, false);
    }
  }
  renderBoard() {
    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.scale(this.#zoomSize, this.#zoomSize);
    this.#ctx.translate(this.#dragOffset.x / this.#zoomSize, this.#dragOffset.y / this.#zoomSize);
    // 默认状态
    this.#ctx.globalCompositeOperation = 'source-over';
    this.#renderDraws()
    window.requestAnimationFrame(() => this.renderBoard());
  }
}
