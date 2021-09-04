"use strict";
import cloneDeep from './lodash.clonedeep.js'
export default class samoBoard {
  customRender = undefined;
  #wheelFn = undefined;
  #wrap;
  #ctx;
  #canvas;
  #dragOffset = {x:0,y:0};
  #zoomSize = 1;
  #oldZoomSize = 1;
  #bgList = [];
  #spacebarPressed = false;
  #clickTimeLogs=[];
  #draws = [];
  #drawType = 'pointer';
  #pencilDownFn = undefined;
  #pencilMoveFn = undefined;
  #pencilUpFn = undefined;
  #pencilOutFn = undefined;
  #maxZoomSize=1.5;
  #minZoomSize=0.5;
  #zoomStep = 0.05;
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
  #drawPrototype = () => {
    return {
      id: this.constructor.uuidv4Short(),
      x: 0, // polygon, rect, arc, arcto use
      y: 0, // polygon, rect, arc, arcto use
      text: '', // text use
      lock: false, 
      width: 0, // rect use
      height: 0, // rect use
      radius: 0, // arc, arcto use
      startAngle: 0, // arc use
      endAngle: 0, // arc use
      selected: false,
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
      fillStyle: 'translate',
      lineWidth: 1
    }
  }
  #tmpDraw = {};
  constructor(options={}) {
    this.opts = this.constructor.mergeDeep({
      wrap: undefined,
      autoAppend: true, // 是否自动把canvas append到父级容器
      ctxStyle: {
        strokeStyle: '#333',
        fillStyle: 'transparent',
        lineWidth: 1, 
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

    this.#wheelFn = e => this.#canvasWheel(e)
    this.#canvas.oncontextmenu = e => {
      e.preventDefault();
    };
    this.#canvas.addEventListener('wheel', this.#wheelFn, false);
    this.#bindKeysEvents()

    this.#draws = new Proxy(this.#draws, {
      get: function(target, propKey, receiver){
        console.log(`getting ${target}!`);
        
      },
      set: function(target, propKey, receiver) {
        console.log(target)
      }
    })

    this.renderBoard()
    this.setDrawType()
    return this;
  }
  #bindKeysEvents() {
    window.addEventListener('keydown', (e)=>this.#windowKeyDown(e), false);
    window.addEventListener('keyup', (e)=>this.#windowKeyUp(e), false);
  }
  #revokeKeysEvents() {
    window.removeEventListener('keydown', this.#windowKeyDown, false);
    window.removeEventListener('keyup', this.#windowKeyUp, false);
  }
  #windowKeyDown(e) {
    // console.log(e.keyCode)
    const _keyCode = e.keyCode
    switch(_keyCode) {
      case 32:
        if (!this.#spacebarPressed) {
          document.documentElement.style.cursor = 'grab'
          this.#spacebarPressed = true;
        }
        break;
    }
  }
  #windowKeyUp(e) {
    // console.log(e.keyCode)
    const _keyCode = e.keyCode
    switch(_keyCode) {
      case 32:
        if (this.#spacebarPressed) {
          document.documentElement.style.cursor = 'default'
          this.#spacebarPressed = false;
        }
        break;
    }
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
  #drawToSvgPath(draw, origin=false) {
    try {
      let _svg_path = [`M${draw.x} ${draw.y}`];
      switch(draw.type) {
        case "rect":
          _svg_path.push(`L${draw.x+draw.width} ${draw.y}`);
          _svg_path.push(`L${draw.x+draw.width} ${draw.y+draw.height}`);
          _svg_path.push(`L${draw.x} ${draw.y+draw.height}`);
          break;
        case "polygon":
          draw.ways.forEach(val => {
            _svg_path.push(`L${val.x} ${val.y}`);
          });
          break;
      }
      _svg_path.push('Z');
      _svg_path = _svg_path.join(' ');
      if (origin) {
        return _svg_path
      } else {
        return new Path2D(_svg_path);
      }
    } catch(err) {
      throw err
    }
  }
  // 产生短id
  static uuidv4Short() {
    return 'xxxx-4xxxyx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  // 产生id
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
  selectDraw({useStroke=false, pointX=0, pointY=0, single=false}) {
    if (this.#draws && this.#draws.length) {
      if (single) {
        this.#draws.forEach(val => val.selected = false)
      }
      for (let i=(this.#draws.length-1);i>=0;i--) {
        let val = this.#draws[i]
        const _path = this.#drawToSvgPath(val)
        let _flag = false;
        if (useStroke) {
          _flag = this.#ctx.isPointInStroke(_path, pointX, pointY)
        } else {
          _flag = this.#ctx.isPointInPath(_path, pointX, pointY)
        }
        if (_flag) {
          val.selected = true;
          break;
        }
      }
    }
  }
  exportDrawsData() {
    this.#draws.forEach(val => {
      val['x'] = Math.round(val.x)
      val['y'] = Math.round(val.y)
      val['width'] = Math.round(val.width)
      val['height'] = Math.round(val.height)
      if (val.ways && val.ways.length) {
        val.ways.forEach(wal=>{
          wal['x'] = Math.round(wal.x)
          wal['y'] = Math.round(wal.y)
        })
      }
    })
    return this.constructor.cloneDeep(this.#draws)
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
  // 还原缩放
  zoomReset() {
    this.#dragOffset = {
      x: 0,
      y: 0
    };
    this.#zoomSize = 1;
  }
  // 获取缩放倍数
  getZoomSize() {
    return {
      current: this.#zoomSize,
      default: this.bgObj ? this.bgObj.scaled : 1
    };
  }
  // 检验是否双击
  detectIsDBClick(ctime) {
    this.#clickTimeLogs.unshift(ctime);
    if (this.#clickTimeLogs.length > 2) {
      this.#clickTimeLogs = this.#clickTimeLogs.slice(0, 2);
    }
    if (this.#clickTimeLogs.length !== 2) {
      return false;
    }
    const _deltaTime = Math.abs(this.#clickTimeLogs[0] - this.#clickTimeLogs[1]);

    if (_deltaTime <= 200) {
      return true;
    } else {
      return false;
    }
  }
  // 放大
  zoomIn({offsetX, offsetY}) {
    const _offsetX = offsetX === undefined ? Math.floor(this.#canvas.clientWidth/2) : offsetX;
    const _offsetY = offsetY === undefined ? Math.floor(this.#canvas.clientHeight/2) : offsetY;
    this.#zoomSize = Number((this.#zoomSize + this.#zoomStep).toFixed(2))
    this.#zoomSize = Math.min(this.#maxZoomSize, this.#zoomSize)
    if (this.#oldZoomSize !== this.#zoomSize) {
      this.#dragOffset = {
        x: this.#dragOffset.x-_offsetX*this.#zoomStep,
        y: this.#dragOffset.y-_offsetY*this.#zoomStep
      }
    }
    this.#oldZoomSize = this.#zoomSize
  }
  // 缩小
  zoomOut({offsetX, offsetY}) {
    const _offsetX = offsetX === undefined ? Math.floor(this.#canvas.clientWidth/2) : offsetX;
    const _offsetY = offsetY === undefined ? Math.floor(this.#canvas.clientHeight/2) : offsetY;
    this.#zoomSize = Number((this.#zoomSize - this.#zoomStep).toFixed(2))
    this.#zoomSize = Math.max(this.#minZoomSize, this.#zoomSize)
    if (this.#oldZoomSize !== this.#zoomSize) {
      this.#dragOffset = {
        x: this.#dragOffset.x+_offsetX*this.#zoomStep,
        y: this.#dragOffset.y+_offsetY*this.#zoomStep
      }
    }
    this.#oldZoomSize = this.#zoomSize
  }
  // 设置画图类型
  setDrawType(type='pointer', options={}) {
    this.#drawType = type;
    // console.log(this.#drawType)
    this.#canvas.removeEventListener('mousedown', this.#pencilDownFn, false);
    this.#canvas.removeEventListener('mousemove', this.#pencilMoveFn, false);
    this.#canvas.removeEventListener('mouseup', this.#pencilUpFn, false);
    this.#canvas.removeEventListener('mouseout', this.#pencilOutFn, false);
    if (this[`${this.#drawType}DownFn`]) {
      this.#pencilDownFn = e => this[`${this.#drawType}DownFn`](e, options);
      this.#canvas.addEventListener('mousedown', this.#pencilDownFn, false);
    }
    if (this[`${this.#drawType}MoveFn`]) {
      this.#pencilMoveFn = e => this[`${this.#drawType}MoveFn`](e, options);
      this.#canvas.addEventListener('mousemove', this.#pencilMoveFn, false);
    }
    if (this[`${this.#drawType}UpFn`]) {
      this.#pencilUpFn = e => this[`${this.#drawType}UpFn`](e, options);
      this.#canvas.addEventListener('mouseup', this.#pencilUpFn, false);
    }
    if (this[`${this.#drawType}OutFn`]) {
      this.#pencilOutFn = e => this[`${this.#drawType}OutFn`](e, options);
      this.#canvas.addEventListener('mouseout', this.#pencilOutFn, false);
    }
  }
  #renderDarw(ctx, obj) {
    this.#setCtx(ctx, {
      gco: obj.gco,
      lineWidth: obj.lineWidth,
      strokeStyle: obj.strokeStyle,
      fillStyle: obj.fillStyle,
    })
    switch(obj.type) {
      case "rect":
        let _path2d = new Path2D();
        _path2d.rect(obj.x, obj.y, obj.width, obj.height);
        ctx.stroke(_path2d)
        ctx.fill(_path2d)
        break;
    }
  }
  pointerDownFn(e) {
    if (e.button === 0) {
      this.#hoverPoint = {
        x: e.offsetX,
        y: e.offsetY,
      }
      // console.log(this.#hoverPoint)
    }
  }
  pointerMoveFn(e) {
  }
  pointerUpFn(e) {
  }
  pointerOutFn(e) {
    
  }
  #renderDraws() {
    if (this.#draws && this.#draws.length) {
      this.#draws.forEach((val,index) => {
        this.#renderDarw(this.#ctx, val)
      })
    }
    
    // const _ctxStyle = this.constructor.mergeDeep(this.opts.ctxStyle, {
    //   strokeStyle: 'gray'
    // })
    // this.#setCtx(this.#ctx, _ctxStyle)
    // this.#ctx.translate(100, 100);
    // this.#ctx.stroke(this.renderCursor('location'))
  }
  #renderTmpDraw() {
    this.#renderDarw(this.#ctx, this.#tmpDraw)
  }
  // 滚动缩放
  #canvasWheel(e) {
    const _wheelDelta = e.wheelDelta;
    if (e.ctrlKey && Math.abs(_wheelDelta) > 0) {
      if (_wheelDelta > 0) {
        
        this.zoomIn({
          offsetX:e.offsetX, 
          offsetY:e.offsetY
        });
      } else {
        this.zoomOut({
          offsetX:e.offsetX, 
          offsetY:e.offsetY
        });
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }
  renderCursor(cursorName) {
    return new Path2D(this.#svgCursors[cursorName].path)
  }
  setDrawsData(draws) {
    console.log('set draws data')
    this.#draws = this.constructor.cloneDeep(draws)
  }
  setCustomDrawType({type, downFn, moveFn, upFn, outFn}) {
    this.#drawType = type;
    this.#canvas.removeEventListener('mousedown', this.#pencilDownFn, false);
    this.#canvas.removeEventListener('mousemove', this.#pencilMoveFn, false);
    this.#canvas.removeEventListener('mouseup', this.#pencilUpFn, false);
    this.#canvas.removeEventListener('mouseout', this.#pencilOutFn, false);
    let _params = {
      draws: this.#draws,
      tmpDraw: this.#tmpDraw,
      spccebarPressed: this.#spacebarPressed,
      drawPrototype: this.#drawPrototype
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
  #renderCustomAction() {
    if (this.customRender){
      this.customRender({ctx:this.#ctx, draws: this.#draws})
    }
  }
  renderBoard() {
    this.#ctx.clearRect(0, 0, this.#wrap.clientWidth, this.#wrap.clientHeight)
    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.scale(this.#zoomSize, this.#zoomSize);
    this.#ctx.translate(this.#dragOffset.x / this.#zoomSize, this.#dragOffset.y / this.#zoomSize);
    // 默认状态
    this.#ctx.globalCompositeOperation = 'source-over';
    this.#renderDraws()
    this.#renderTmpDraw()
    this.#renderCustomAction()
    window.requestAnimationFrame(() => this.renderBoard());
  }
}
