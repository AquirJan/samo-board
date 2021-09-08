"use strict";
import cloneDeep from './lodash.clonedeep.js'
export default class samoBoard {
  customRender = undefined;
  #wheelFn = undefined;
  #wrap;
  #ctx;
  #canvas;
  #dragOffset = {x:0,y:0};
  #dragOffsetOrigin = {x:0,y:0};
  #zoomSize = 1;
  #oldZoomSize = 1;
  #bgList = [];
  #peakGap = 5;
  #peaks = [];
  #peakRect = undefined;
  #lBtnPressing = false;
  #rBtnPressing = false;
  #renderTime = undefined;
  #spacebarPressed = false;
  #clickTimeLogs=[];
  #draws = [];
  #originSelectedDraws=undefined;
  #currentPeak = undefined;
  #drawType = 'pointer';
  #pencilDownFn = undefined;
  #pencilMoveFn = undefined;
  #pencilUpFn = undefined;
  #pencilOutFn = undefined;
  #maxZoomSize=2;
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
  #tmpDraw = undefined;
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
      lineDash: [],
      gco: 'source-cover',
      strokeStyle: '#333',
      fillStyle: 'transparent',
      lineWidth: 1
    }
  }
  constructor(options={}) {
    this.opts = this.constructor.mergeDeep({
      wrap: undefined,
      autoAppend: true, // 是否自动把canvas append到父级容器
      ctxStyle: {
        rotate: 0,
        translate: [0, 0],
        strokeStyle: '#333',
        fillStyle: 'transparent',
        lineWidth: 1, 
        lineDash: [],
        lineJoin: 'miter', // bevel, round, miter;
        lineCap: 'butt', // butt, round, square
        gco: 'source-cover'
      }
    }, options)
    this.#init();
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
    console.log('init')
    this.#setCtx(this.#ctx, this.opts.ctxStyle)
    this.#canvas.oncontextmenu = e => {
      e.preventDefault();
    };
    this.#wheelFn = e => this.#canvasWheel(e)
    this.#canvas.addEventListener('wheel', this.#wheelFn, false);
    this.#bindKeysEvents()

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
    const _configs = this.constructor.mergeDeep(this.opts.ctxStyle, configs)
    // console.log(_configs)
    for (let key in _configs) {
      if (key === 'gco') {
        ctx.globalCompositeOperation = _configs[key];
      } else if(key === 'rotate') {
        ctx.rotate(_configs[key] * Math.PI / 180)
      } else if(key==='translate') {
        ctx.translate(_configs[key][0], _configs[key][1]);
      } else if(key === 'lineDash') {
        ctx.setLineDash(_configs[key])
      } else {
        ctx[key] = _configs[key];
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
  selectDraw({useStroke=false, pointX=0, pointY=0, ctrlKey=false}) {
    let _focused = undefined;
    if (this.#draws && this.#draws.length) {
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
          _focused = i;
          break;
        }
      }
      if (ctrlKey) {
        // 按着ctrl键默认多选
        if (_focused !== undefined) {
          this.#draws[_focused]['selected'] = !this.#draws[_focused].selected;
        }
        this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected))
        this.#generatePeaks(this.#originSelectedDraws)
      } else {
        if (this.#peakRect) {
          let _flag = this.#ctx.isPointInPath(this.#peakRect, pointX, pointY)
          if (!_flag || !this.#draws[_focused].selected) {
            this.#draws.forEach(val => val.selected = false)
          }
          if (_focused !== undefined) {
            this.#draws[_focused]['selected'] = true;
          }
          this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected))
          this.#generatePeaks(this.#originSelectedDraws)
        } else {
          this.#draws.forEach(val => val.selected = false)
          if (_focused !== undefined) {
            this.#draws[_focused]['selected'] = true;
          }
          this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected))
          this.#generatePeaks(this.#originSelectedDraws)
        }
        
      }
    }
    return _focused
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
      this.#dragOffsetOrigin = this.constructor.cloneDeep(this.#dragOffset)
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
      this.#dragOffsetOrigin = this.constructor.cloneDeep(this.#dragOffset)
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
  #renderDraw(ctx, obj) {
    // const _center = this.#findOutCenter()
    // console.log('renderDraw')
    this.#setCtx(ctx, {
      gco: obj.gco,
      lineWidth: obj.lineWidth,
      strokeStyle: obj.strokeStyle,
      fillStyle: obj.fillStyle,
      rotate: obj.rotate
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
  #generatePeakRect() {
    if (this.#peaks && this.#peaks.length) {
      let _svg_path = [];
      this.#peaks.forEach((val,vindex) => {
        if (vindex === 0) {
          _svg_path.push(`M${val.x} ${val.y}`)
        } else {
          _svg_path.push(`L${val.x} ${val.y}`)
        }
      })
      _svg_path.push('Z')
      _svg_path = _svg_path.join(' ')
      this.#peakRect = new Path2D(_svg_path)
    }
  }
  #generatePeaks(draws) {
    if (!draws || draws.constructor !== Array || !draws.length) {
      this.#peaks = []
      this.#peakRect = undefined;
      return this.#peaks
    }
    let _pointsList = []
    draws.forEach(val=>{
      _pointsList.push({
        x: val.x,
        y: val.y
      })
      if (val.type === 'rect') {
        // console.log(val)
        _pointsList.push({
          x: val.x + val.width,
          y: val.y,
        },
        {
          x: val.x + val.width,
          y: val.y + val.height,
        },
        {
          x: val.x,
          y: val.y + val.height,
        })
      }
    })
    const _XList = _pointsList.map(val => val.x)
    const _YList = _pointsList.map(val => val.y)
    const _minX = Math.min(..._XList) - this.#peakGap;
    const _maxX = Math.max(..._XList) + this.#peakGap;
    const _minY = Math.min(..._YList) - this.#peakGap;
    const _maxY = Math.max(..._YList) + this.#peakGap;
    this.#peaks = [
      {
        cursor: 'nwse-resize',
        code: 'tl',
        x: _minX,
        y: _minY
      },
      {
        cursor: 'ns-resize',
        code: 'tm',
        x: _minX+Math.floor((_maxX-_minX)/2),
        y: _minY
      },
      {
        cursor: 'nesw-resize',
        code: 'tr',
        x: _maxX,
        y: _minY
      },
      {
        cursor: 'ew-resize',
        code: 'rm',
        x: _maxX,
        y: _minY+Math.floor((_maxY-_minY)/2),
      },
      {
        cursor: 'nwse-resize',
        code: 'br',
        x: _maxX,
        y: _maxY
      },
      {
        cursor: 'ns-resize',
        code: 'bm',
        x: _minX+Math.floor((_maxX-_minX)/2),
        y: _maxY,
      },
      {
        cursor: 'nesw-resize',
        code: 'bl',
        x: _minX,
        y: _maxY
      },
      {
        cursor: 'ew-resize',
        code: 'lm',
        x: _minX,
        y: _minY+Math.floor((_maxY-_minY)/2),
      },
    ]
    this.#generatePeakRect()
    return this.#peaks
  }
  #findOutCenter() {
    let _center = {
      x: 0,
      y: 0
    }
    const _peaks = this.#peaks;
    if (!_peaks) {
      return _center
    }
    let _peaksXList = []
    let _peaksYList = []
    _peaks.forEach(val => {
      _peaksXList.push(val.x)
      _peaksYList.push(val.y)
    })

    _center['x'] = (Math.max(..._peaksXList) - Math.min(..._peaksXList)) / 2
    _center['y'] = (Math.max(..._peaksYList) - Math.min(..._peaksYList)) / 2
    
    return _center
  }
  #modifyDraws({offsetX, offsetY}) {
    if (offsetX === undefined || offsetY === undefined || offsetX.constructor !== Number || offsetY.constructor !== Number) {
      return false;
    }
    const _selectedDraws = this.#draws.filter(val => val.selected)
    _selectedDraws.forEach((val,vindex) => {
      val['x'] = this.#originSelectedDraws[vindex].x + offsetX - this.#hoverPoint.x;
      val['y'] = this.#originSelectedDraws[vindex].y + offsetY - this.#hoverPoint.y;
    })
    this.#generatePeaks(_selectedDraws)
  }
  pointerDownFn(e) {
    if (e.button === 0) {
      // console.log(this.#peakRect)
      this.#currentPeak = undefined;
      this.#lBtnPressing = true;
      this.#hoverPoint = {
        x: e.offsetX,
        y: e.offsetY,
      }
      if (!this.#spacebarPressed) {
        
        
        // if (peak) {
        //   this.#currentPeak = peak;
        // }
        // console.log(peakRect)
        
        this.selectDraw({pointX: this.#hoverPoint.x, pointY: this.#hoverPoint.y, single: false, ctrlKey: e.ctrlKey})
        // const {peak, peakRect, cursor, draw } = this.#detectOverSomething({pointX: this.#hoverPoint.x, pointY: this.#hoverPoint.y})
      }
    }
    if (e.button === 2) {

    }
  }
  pointerMoveFn(e) {
    if (e.button === 0) {
      // 移动整个场景
      if (this.#spacebarPressed && this.#lBtnPressing) {
        this.#dragOffset['x'] = this.#dragOffsetOrigin.x + e.offsetX - this.#hoverPoint.x;
        this.#dragOffset['y'] = this.#dragOffsetOrigin.y + e.offsetY - this.#hoverPoint.y;
      }
      // 检测鼠标悬停到什么东西上
      if (!this.#spacebarPressed && !this.#lBtnPressing) {
        this.#detectOverSomething({pointX: e.offsetX, pointY: e.offsetY})
      }
      
      if (!this.#currentPeak && !this.#spacebarPressed && this.#lBtnPressing) {
        this.#modifyDraws({offsetX:e.offsetX, offsetY:e.offsetY})
      }
    }
    if (e.button === 2) {
      
    }
  }
  pointerUpFn(e) {
    if (e.button === 0) {
      if (!this.#spacebarPressed && !this.#currentPeak) {
        const _selectedDraws = this.#draws.filter(val => val.selected)
        // const _focused = this.selectDraw({pointX: this.#hoverPoint.x, pointY: this.#hoverPoint.y, single: e.ctrlKey?false:true})
        if (!_selectedDraws.length) {
          this.#originSelectedDraws = undefined;
        } else {
          this.#originSelectedDraws = this.constructor.cloneDeep(_selectedDraws)
        }
        this.#generatePeaks(this.#originSelectedDraws)
      }
      this.#lBtnPressing = false;
      this.#dragOffsetOrigin = this.constructor.cloneDeep(this.#dragOffset)
      
    }
    if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset()
      }
    }
  }
  pointerOutFn(e) {
    // this.pointerUpFn(e)
  }
  renderCursor(cursorName) {
    return new Path2D(this.#svgCursors[cursorName].path)
  }
  setDrawsData(draws) {
    console.log('set draws data')
    this.#draws = this.constructor.cloneDeep(draws)
    // console.dir(this.#draws.filter(val=>val.selected))
    this.#generatePeaks(this.#draws.filter(val=>val.selected));
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
  #modifyPeak({pointX, pointY}) {
    if (pointX === undefined || pointY === undefined || pointX.constructor !== Number || pointY.constructor !== Number) {
      return false;
    }

  }
  #detectOverSomething({pointX, pointY}) {
    if (pointX === undefined || pointY === undefined || pointX.constructor !== Number || pointY.constructor !== Number) {
      return {};
    }
    let _cursor = 'default';
    let _peak = undefined;
    let _peakRect = undefined;
    let _draw = undefined;
    if (_cursor === 'default' && this.#peaks && this.#peaks.length) {
      for (let i=(this.#peaks.length-1);i>=0;i--) {
        let val = this.#peaks[i]
        const _path = new Path2D()
        _path.arc(val.x, val.y, 3, 0, 2 * Math.PI);
        let _flag = this.#ctx.isPointInPath(_path, pointX, pointY)
        if (_flag) {
          _cursor = val.cursor
          _peak = val;
          break;
        }
      }
    }
    if (_cursor === 'default' && this.#peakRect) {
      let _flag = this.#ctx.isPointInPath(this.#peakRect, pointX, pointY)
      if (_flag) {
        _peakRect = this.#peakRect
        _cursor = 'move'
      }
    }
    if (_cursor === 'default' && this.#draws && this.#draws.length) {
      for (let i=(this.#draws.length-1);i>=0;i--) {
        let val = this.#draws[i]
        const _path = this.#drawToSvgPath(val)
        let _flag = this.#ctx.isPointInPath(_path, pointX, pointY)
        if (_flag) {
          _cursor = 'move'
          _draw = val;
          break;
        }
      }
    }
    document.documentElement.style.cursor = _cursor
    const _returnObj = {peak: _peak, cursor: _cursor, draw: _draw, peakReck: _peakRect }
    return _returnObj
  }
  #renderDraws() {
    if (this.#draws && this.#draws.length) {
      this.#draws.forEach((val,index) => {
        this.#renderDraw(this.#ctx, val)
      })
    }
  }
  #renderTmpDraw() {
    if (this.#tmpDraw) {
      this.#renderDraw(this.#ctx, this.#tmpDraw)  
    }
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
  
  #renderCustomAction() {
    if (this.customRender){
      this.customRender({ctx:this.#ctx, draws: this.#draws})
    }
  }
  #renderPeaks(){
    if (this.#peakRect) {
      this.#setCtx(this.#ctx, {
        strokeStyle: '#83c3fb',
        lineWidth: 1,
        lineDash: [5, 10]
      })
      this.#ctx.stroke(this.#peakRect)
    }
    if (this.#peaks && this.#peaks.length) {
      this.#setCtx(this.#ctx, {
        fillStyle: '#ff8787',
        strokeStyle: '#83c3fb',
        lineWidth: 1
      })
      this.#peaks.forEach((val,vindex) => {
        const _peak = new Path2D()
        _peak.arc(val.x, val.y, 3, 0, 2 * Math.PI);
        this.#ctx.fill(_peak)
        this.#ctx.stroke(_peak)
      })
    }
  }
  renderBoard() {
    if (!this.#renderTime) {
      this.#renderTime = new Date().getTime()
    }
    this.#ctx.clearRect(-this.#dragOffset.x, -this.#dragOffset.y, this.#wrap.clientWidth+Math.abs(this.#dragOffset.x)*2, this.#wrap.clientHeight+Math.abs(this.#dragOffset.y)*2)
    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.scale(this.#zoomSize, this.#zoomSize);
    this.#ctx.translate(this.#dragOffset.x / this.#zoomSize, this.#dragOffset.y / this.#zoomSize);
    // 默认状态
    this.#ctx.globalCompositeOperation = 'source-over';
    this.#renderDraws()
    this.#renderTmpDraw()
    this.#renderCustomAction()
    this.#renderPeaks()
    // if ((new Date().getTime() - this.#renderTime) < 10 ) {
      window.requestAnimationFrame(() => this.renderBoard());
    // }
  }
}
