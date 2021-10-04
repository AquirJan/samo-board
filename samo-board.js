"use strict";
import cloneDeep from './lodash.clonedeep.js'
// x=(x1-x2)*Math.cos(Math.pi/180.0*旋转角度)-(y1-y2)*Math.sin(pi/180.0*旋转角度)+x2
// y=(x1-x2)*Math.sin(Math.pi/180.0*旋转角度)+(y1-y2)*Math.cos(pi/180.0*旋转角度)+y2
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
  #stageDegree = 0;
  #peakGap = 5;
  #peaks = [];
  #peakRect = undefined;
  #lBtnPressing = false;
  #rBtnPressing = false;
  #renderTime = undefined;
  #currentCursor = undefined;
  #spacebarPressed = false;
  #clickTimeLogs=[];
  #intervalHandler = undefined;
  #resizing = false;
  #draws = [];
  #background = {
    degree: 0,
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
    viewHeight:0,
    viewWidth: 0
  };
  #originSelectedDraws=undefined;
  #currentPeak = undefined;
  #drawType = 'pointer';
  #pencilDownFn = undefined;
  #pencilMoveFn = undefined;
  #pencilUpFn = undefined;
  #pencilOutFn = undefined;
  #rotateStartPoint = undefined;
  #maxZoomSize=2;
  #minZoomSize=0.5;
  #zoomStep = 0.05;
  #windowResizeFn=undefined;
  #svgCursors = {
    location: {
      path: 'M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12 ,2Z',
      x: 0,
      y: 0,
      size: 1
    },
    rotate: {
      path: 'M8.016 15.984h12v2.016h-2.016v2.016h-2.016v-2.016h-7.969q-0.844 0-1.43-0.586t-0.586-1.43v-7.969h-2.016v-2.016h2.016v-2.016h2.016v12zM15.984 14.016v-6h-6v-2.016h6q0.844 0 1.43 0.586t0.586 1.43v6h-2.016zM12.047 0q4.688 0 8.133 3.188t3.82 7.828h-1.5q-0.281-2.813-1.875-5.063t-4.078-3.422l-1.359 1.313-3.797-3.797q0.141 0 0.328-0.023t0.328-0.023zM7.453 21.469l1.359-1.313 3.797 3.797q-0.141 0-0.328 0.023t-0.328 0.023q-4.688 0-8.133-3.188t-3.82-7.828h1.5q0.281 2.813 1.875 5.063t4.078 3.422z',
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
      drawName: 'rect', // 用户自定义
      rotate: 0,
      // translate: [],
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
        // rotate: 0,
        // translate: [0, 0],
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
  // 规范小数
  normalFloat(floatNumber = 0, fixed = 0) {
    return parseFloat(floatNumber.toFixed(fixed));
  }
  // 计算图片显示宽高
  
  
  #calcImageSize(width, height) {
    let _obj = {
      viewWidth: 0,
      viewHeight: 0,
      offsetX: 0,
      offsetY: 0,
      scaled: 1
    };
    if (width && height) {
      const _container = {
        width: this.#wrap.clientWidth,
        height: this.#wrap.clientHeight
      }
      _obj.scaled = Math.min((_container.width/width), (_container.height/height), 1)
      _obj.viewWidth = Math.floor(width * _obj.scaled);
      _obj.viewHeight = Math.floor(height * _obj.scaled);
      // console.log('calc image size')
      // console.log(`_obj.scaled: ${_obj.scaled}`)
      // console.log(_container.width, _obj.viewWidth)
      // console.log(_container.height, _obj.viewHeight)
      _obj.offsetX = _container.width > _obj.viewWidth ? Math.floor((_container.width - _obj.viewWidth) /2) : 0
      _obj.offsetY = _container.height > _obj.viewHeight ? Math.floor((_container.height - _obj.viewHeight) /2) : 0
    }
    return _obj;
  }
  // 加载图promise
  asyncLoadImage(src, calcScaled = true) {
    return new Promise(resolve => {
      if (!src) {
        resolve({
          success: false,
          msg: 'no src'
        });
      }
      const image = new Image();
      image.crossOrigin = 'Anonymous';
      image.src = src;
      image.onload = () => {
        if (calcScaled) {
          const { viewHeight, viewWidth, scaled, offsetX, offsetY } = this.#calcImageSize(image.naturalWidth, image.naturalHeight);
          resolve({
            src,
            success: true,
            message: 'load image complite',
            data: image,
            scaled,
            offsetX,
            offsetY,
            viewWidth,
            viewHeight,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        } else {
          resolve({
            src,
            success: true,
            message: 'load image complite',
            data: image,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        }
      };
      image.onerror = () => {
        resolve({
          success: false,
          message: 'load image error',
          src
        });
      };
    });
  }
  updateBackground({index=0, degree=0}) {
    if (this.#bgList && this.#bgList.length && this.#bgList[index]) {
      this.#bgList[index]['rotate'] = degree
    } else {
      console.warn(`[samo-board warning]: bgList miss index of ${index} background`)
    }
  }
  appendBackground(obj={}) {
    return new Promise(async resolve => {
      const {src, reverse, direction} = obj;
      let _direction = !direction ? 'vertical' : 'horizontal'
      if (!src) {
        resolve({
          success: false,
          message: 'miss src param'
        })
      }
      let _bgSection = await this.asyncLoadImage(src);
      _bgSection['direction'] = _direction
      if (this.#bgList && this.#bgList.length) {
        this.#dragOffset ={
          x: 0,
          y: 0
        } 
        let _totalHeight = 0;
        let _totalWidth = 0;
        if (reverse) {
          // if (_direction === 'vertical') {
          //   this.#bgList.forEach(val=>{
          //     _totalHeight += val.height
          //   })
          //   _bgSection['offsetX'] = 0;
          //   _bgSection['offsetY'] = _totalHeight;
          // }
          // this.#bgList.unshift(_bgSection)
        } else {
          if (_direction === 'vertical') {
            
            this.#bgList.forEach(val=>{
              _totalHeight += val.height
            })
            _bgSection['offsetX'] = 0;
            _bgSection['offsetY'] = _totalHeight;
            
            this.#bgList.push(_bgSection)

            _totalHeight += _bgSection.height
            let _maxWidth = Math.max(...this.#bgList.map(val => val.width))
            
            const _res = this.#calcImageSize(_maxWidth, _totalHeight)
            this.#zoomSize = Math.min(...this.#bgList.map(val => val.scaled));
            this.#dragOffset ={
              x: _res.offsetX,
              y: _res.offsetY
            } 
            this.#background['width'] = _maxWidth
            this.#background['height'] = _totalHeight
            this.#background['viewWidth'] = _res.viewWidth
            this.#background['viewHeight'] = _res.viewHeight
            this.#background['centerX'] = Math.floor(_maxWidth/2)
            this.#background['centerY'] = Math.floor(_totalHeight/2)
          }
          
        }
        resolve()
      } else {
        this.#dragOffset = {
          x: _bgSection.offsetX,
          y: _bgSection.offsetY
        }
        _bgSection['offsetX'] = 0;
        _bgSection['offsetY'] = 0;
        this.#bgList = [_bgSection]
        this.#background['width'] = _bgSection.width
        this.#background['height'] = _bgSection.height
        this.#background['viewWidth'] = _bgSection.viewWidth
        this.#background['viewHeight'] = _bgSection.viewHeight
        this.#background['centerX'] = Math.floor(_bgSection.width/2)
        this.#background['centerY'] = Math.floor(_bgSection.height/2)
        console.log(`#background`)
        console.log(this.#background)
        this.#zoomSize = _bgSection.scaled;
        resolve()
      }
    })
  }
  setBackground(obj={}){
    return new Promise(async resolve=>{
      const _obj = this.constructor.mergeDeep({
        src: '',
        reverse: false,
      }, obj)
      if (_obj.src) {
        let _bgSection = await this.asyncLoadImage(_obj.src);
        if (_obj.rotate !== undefined) {
          _bgSection['rotate'] = _obj.rotate
        }
        let prevScaled = 1
        if (_bgSection.success) {
          if (_obj.reverse) {
            // 倒序插入
            this.#bgList.unshift(_bgSection)
            if(this.#bgList.length && this.#bgList.length > 1) {
              for(let i=1;i<this.#bgList.length;i++) {
                const _prevItem = this.#bgList[i-1];
                this.#bgList[i].offsetY = _prevItem.height+_prevItem.offsetY
              }
            }
            if (this.#bgList.length) {
              prevScaled = this.#bgList[0].scaled
            }
          } else {
            // 顺序插入
            this.#bgList.push(_bgSection)
            if (this.#bgList.length) {
              prevScaled = this.#bgList[this.#bgList.length-1].scaled
            }
          }
          this.#zoomSize = Math.min(prevScaled, _bgSection.scaled);
        }
        resolve()
      } else {
        resolve()
      }
    })
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
        const pVal = prev[key]; // 新值
        const oVal = obj[key]; // 默认值
        if (pVal !== undefined && oVal !== undefined) {
          if (pVal.constructor === Array && oVal.constructor === Array) {
            // prev[key] = pVal.concat(...oVal); // 正常情况是合并数组
            prev[key] = oVal; // 根据业务需求修改成覆盖
          } else if (pVal.constructor === Object && oVal.constructor === Object) {
            prev[key] = this.mergeDeep(pVal, oVal);
          } else {
            prev[key] = oVal === undefined ? pVal : oVal;
          }
        } else {
          prev[key] = oVal === undefined ? pVal : oVal
        }
      });
      return prev;
    }, {});
  }
  #init() {
    if (this.opts.autoAppend) {
      if (!this.opts.wrap) {
        this.#wrap = document.createElement('div')
        this.#wrap.style.cssText = `width: 400px;height: 300px;`
      } else {
        this.#wrap = this.opts.wrap;
      }
    }
    console.log("初始化samo-board");
    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext('2d');
    console.dir(this.#wrap)
    if (this.#wrap) {
      this.#wrap.appendChild(this.#canvas);
      this.#canvas.height = this.#wrap.clientHeight
      this.#canvas.width = this.#wrap.clientWidth;
    }
    // this.#canvas.style.cssText = `display:grid;background-color: #fff;`
    // 渲染
    this.#renderBoard()
    this.setDrawType()

    this.#canvas.oncontextmenu = e => {
      e.preventDefault();
    };
    this.#wheelFn = e => this.#canvasWheel(e)
    this.#canvas.addEventListener('wheel', this.#wheelFn, false);
    this.#bindKeysEvents()

    this.#windowResizeFn = e => this.#windowResize(e);
    window.addEventListener('resize', this.#windowResizeFn, false);
    this.#wrapSizeObserver()

    return this;
  }
  #wrapSizeObserver() {
    if (!this.#wrap) {
      console.warn('没有#wrap');
      return;
    }
    const resizeObserver = new ResizeObserver(async entries => {
      this.#windowResize();
    });
    resizeObserver.observe(this.#wrap);
  }
  async #windowResize($event) {
    if (!this.#resizing) {
      this.#resizing = setTimeout(() => {
        this.#canvas.width = 0;
        this.#canvas.height = 0;
        const _wrapRect = this.#wrap;
        this.#canvas.width = _wrapRect.clientWidth;
        this.#canvas.height = _wrapRect.clientHeight;

        if (this.#bgList && this.#bgList.length) {
          if (this.#bgList.length === 1) {
            let _bgSection = this.#calcImageSize(this.#bgList[0].data.naturalWidth, this.#bgList[0].data.naturalHeight);
            this.#dragOffset = {
              x: _bgSection.offsetX,
              y: _bgSection.offsetY
            }
            val['offsetX'] = 0;
            val['offsetY'] = 0;
            val['scaled'] = _bgSection.scaled
            this.#zoomSize = _bgSection.scaled;
          } else {
            let _totalHeight = 0;
            let _totalWidth = 0;
            let _zoomSize = 1
            this.#bgList.forEach(val => {
              const {scaled, offsetX, offsetY, viewHeight, viewWidth} = this.#calcImageSize(val.data.naturalWidth, val.data.naturalHeight);
              val['scaled'] = scaled
              // val['offsetX'] = offsetX
              // val['offsetY'] = offsetY
              // val['viewHeight'] = viewHeight
              // val['viewWidth'] = viewWidth
              _zoomSize = Math.min(_zoomSize, val.scaled)
              if (val.direction === 'vertical') {
                _totalHeight += val.height;
                _totalWidth = Math.max(val.width, _totalWidth)
              } else if (val.direction === 'horizontal') {
                _totalWidth += val.width
                _totalHeight = Math.max(val.height, _totalHeight)
              }
            })
            this.#zoomSize = _zoomSize
            let _res = this.#calcImageSize(_totalWidth, _totalHeight);
            this.#dragOffset = {
              x: _res.offsetX,
              y: _res.offsetY
            }
            this.#background['width'] = _totalWidth
            this.#background['height'] = _totalHeight
            this.#background['centerX'] = Math.floor(_totalWidth/2)
            this.#background['centerY'] = Math.floor(_totalHeight/2)
          }
        }
        
        clearTimeout(this.#resizing)
        this.#resizing = undefined;
      }, 500)
    }
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
  #setCtx(ctx, obj={}){
    if (!ctx) {
      return;
    }
    const _configs = this.constructor.mergeDeep(this.opts.ctxStyle, obj)
    for (let key in _configs) {
      if (key === 'gco') {
        ctx.globalCompositeOperation = _configs[key];
      } 
      else if(key==='lineWidth') {
        ctx[key] = _configs[key]/this.#zoomSize;
      } 
      else if(key === 'lineDash') {
        // console.log(_configs[key])
        ctx.setLineDash(_configs[key])
      } else if (!['rotate', 'translate'].includes(key)) {
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
  #renderBackground() {
    if (this.#bgList && this.#bgList.length) {
      this.#setCtx(this.#ctx, {gco: 'destination-over'})
      // if (this.#background.degree) {
      //   const _center = {
      //     x: Math.floor(this.#background.width/2) + this.#dragOffset.x,
      //     y: Math.floor(this.#background.height/2) + this.#dragOffset.y
      //   }
      //   this.#ctx.translate(_center.x, _center.y)
      //   this.#ctx.rotate(this.#background.degree * Math.PI /180)
      //   this.#ctx.translate(-_center.x, -_center.y)
      // }
      this.#bgList.forEach(val => {
        if (val.success && val.data) {
          this.#ctx.drawImage(val.data, val.offsetX, val.offsetY);
        }
      })
      this.#ctx.restore()
    }
  }
  setStageDegree(degree=0){
    if (!isNaN(degree) && degree.constructor === Number && degree && !this.#intervalHandler) {
      this.#intervalHandler = setInterval(()=>{
        if (degree > 0) {
          if (this.#stageDegree < degree) {
            this.#stageDegree+=1;
          } else {
            clearInterval(this.#intervalHandler)
          }
        } else if (degree < 0) {
          if (this.#stageDegree > degree) {
            this.#stageDegree-=1;
          } else {
            clearInterval(this.#intervalHandler)
          }
        }
      })
    }
  }
  selectDraw({pointX=0, pointY=0, ctrlKey=false}) {
    let _focused = undefined;
    if (this.#draws && this.#draws.length) {
      const {drawIndex: _focused} = this.#detectOverSomething({pointX, pointY})
      console.log(_focused)
      if (ctrlKey) {
        // 按着ctrl键默认多选
        if (_focused !== undefined) {
          this.#draws[_focused]['selected'] = !this.#draws[_focused].selected;
        }
        this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected && !val.lock))
        // this.#generatePeaks(this.#originSelectedDraws)
      } else {
        if (this.#peakRect) {
          let _path2d = new Path2D()
          _path2d.rect(this.#peakRect.x, this.#peakRect.y, this.#peakRect.width, this.#peakRect.height)
          let _flag = this.#ctx.isPointInPath(_path2d, pointX, pointY)
          if (!_flag || (this.#draws[_focused] && !this.#draws[_focused].selected)) {
            this.#draws.forEach(val => val.selected = false)
          }
          if (_focused !== undefined) {
            this.#draws[_focused]['selected'] = true;
          }
          this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected && !val.lock))
          // this.#generatePeaks(this.#originSelectedDraws)
        } else {
          this.#draws.forEach(val => val.selected = false)
          if (_focused !== undefined) {
            this.#draws[_focused]['selected'] = true;
          }
          this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val => val.selected && !val.lock))
          // this.#generatePeaks(this.#originSelectedDraws)
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
    if (this.#bgList && this.#bgList.length) {
      const _scaledList = this.#bgList.map(val => val.scaled)
      this.#dragOffset = {
        x: this.#bgList[0].offsetX,
        y: this.#bgList[0].offsetY,
      }
      console.log(_scaledList, this.#dragOffset)
      this.#zoomSize = Math.min(..._scaledList)
    } else {
      this.#zoomSize = 1;
      this.#dragOffset = {
        x: 0,
        y: 0
      };
    }
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
    // console.log('render draw')
    // ctx.restore()
    this.#setCtx(ctx, obj)
    // console.log(obj.drawName)
    switch(obj.type) {
      case "rect":
        ctx.save()
        let _path2d = new Path2D();
        let _bgOffset = {
          x: 0,
          y: 0
        }
        if (this.#bgList && this.#bgList.length) {
          _bgOffset = {
            x: this.#bgList[0].offsetX,
            y: this.#bgList[0].offsetY
          }
        }
        _path2d.rect(obj.x+_bgOffset.x, obj.y+_bgOffset.y, obj.width, obj.height);
        if (obj.rotate !== undefined) {
          const _center = this.#findOutCenter(obj)
          ctx.translate(_center.x, _center.y)
          ctx.rotate(obj.rotate * Math.PI /180)
          ctx.translate(-_center.x, -_center.y)
        }
        ctx.stroke(_path2d)
        ctx.fill(_path2d)
        ctx.restore()
        break;
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
          x: (val.x + val.width),
          y: val.y,
        },
        {
          x: (val.x + val.width),
          y: (val.y + val.height),
        },
        {
          x: val.x,
          y: (val.y + val.height),
        })
      }
      if (val.ways && val.ways.length) {
        val.ways.forEach(wal => {
          _pointsList.push({
            x: wal.x,
            y: wal.y,
          })
        })
      }
    })
    const _XList = _pointsList.map(val => val.x)
    const _YList = _pointsList.map(val => val.y)
    const _minX = Math.min(..._XList) - this.#peakGap;
    const _maxX = Math.max(..._XList) + this.#peakGap;
    const _minY = Math.min(..._YList) - this.#peakGap;
    const _maxY = Math.max(..._YList) + this.#peakGap;
    this.#peakRect = {
      type: 'rect',
      drawName: 'peakRect',
      x: _minX,
      y: _minY,
      strokeStyle: '#83c3fb',
      lineWidth: 1,
      lineDash: [8, 6],
      width: (_maxX-_minX),
      height: (_maxY-_minY),
      rotate: draws.length === 1 ? draws[0].rotate : 0,
    }
    // console.log(this.#peakRect)
    this.#peaks = [
      {
        cursor: 'grabbing',
        code: 'all-rotate',
        startAngle: 0,
        endAngle: 2 * Math.PI,
        radius: 5,
        x: this.#peakRect.x + (this.#peakRect.width/2),
        y: this.#peakRect.y - 20
      },
      {
        cursor: 'nwse-resize',
        code: 'tl',
        radius: 3,
        x: this.#peakRect.x,
        y: this.#peakRect.y
      },
      // {
      //   cursor: 'rotate',
      //   code: 'tl-rotate',
      //   startAngle: Math.PI/2,
      //   endAngle: 2 * Math.PI,
      //   radius: 20,
      //   x: this.#peakRect.x,
      //   y: this.#peakRect.y
      // },
      {
        cursor: 'nesw-resize',
        code: 'tr',
        radius: 3,
        x: this.#peakRect.x + this.#peakRect.width,
        y: this.#peakRect.y
      },
      // {
      //   cursor: 'rotate',
      //   code: 'tr-rotate',
      //   startAngle: Math.PI * 3,
      //   endAngle: 2.5 * Math.PI,
      //   radius: 20,
      //   x: this.#peakRect.x+this.#peakRect.width,
      //   y: this.#peakRect.y
      // },
      {
        cursor: 'nwse-resize',
        code: 'br',
        radius: 3,
        x: this.#peakRect.x+this.#peakRect.width,
        y: this.#peakRect.y+this.#peakRect.height
      },
      // {
      //   cursor: 'rotate',
      //   code: 'br-rotate',
      //   startAngle: Math.PI * 3.5,
      //   endAngle: Math.PI * 5,
      //   radius: 20,
      //   x: this.#peakRect.x+this.#peakRect.width,
      //   y: this.#peakRect.y+this.#peakRect.height
      // },
      {
        cursor: 'nesw-resize',
        code: 'bl',
        radius: 3,
        x: this.#peakRect.x,
        y: this.#peakRect.y+this.#peakRect.height
      },
      // {
      //   cursor: 'rotate',
      //   code: 'bl-rotate',
      //   startAngle: Math.PI * 2,
      //   endAngle: Math.PI * 3.5,
      //   radius: 20,
      //   x: this.#peakRect.x,
      //   y: this.#peakRect.y+this.#peakRect.height
      // }
    ]
    if (draws.length === 1) {
      if (this.#peakRect.width >= 20) {
        this.#peaks = this.#peaks.concat([
          {
            cursor: 'ew-resize',
            code: 'rm',
            radius: 3,
            x: this.#peakRect.x+this.#peakRect.width,
            y: this.#peakRect.y+Math.floor(this.#peakRect.height/2),
          },
          {
            cursor: 'ew-resize',
            code: 'lm',
            radius: 3,
            x: this.#peakRect.x,
            y: this.#peakRect.y+Math.floor(this.#peakRect.height/2),
          },
        ])
      }
      if (this.#peakRect.height >= 20) {
        this.#peaks = this.#peaks.concat([
          {
            cursor: 'ns-resize',
            code: 'tm',
            radius: 3,
            x: this.#peakRect.x + Math.floor(this.#peakRect.width/2),
            y: this.#peakRect.y
          },
          {
            cursor: 'ns-resize',
            code: 'bm',
            radius: 3,
            x: this.#peakRect.x+Math.floor(this.#peakRect.width/2),
            y: this.#peakRect.y+this.#peakRect.height,
          }
        ])
      }
    }
    return this.#peaks
  }
  #findOutCenter(draw) {
    let _center = {
      x: 0,
      y: 0
    }
    let _peaks = this.#peaks || [];
    if (draw && ['rect'].includes(draw.type)) {
      _center = {
        x: draw.x+draw.width/2,
        y: draw.y+draw.height/2
      }
    } else {
      if (!_peaks || !_peaks.length) {
        return _center
      }
      let _peaksXList = []
      let _peaksYList = []
      _peaks.forEach(val => {
        _peaksXList.push(val.x)
        _peaksYList.push(val.y)
      })

      _center['x'] = (Math.max(..._peaksXList) - Math.min(..._peaksXList))
      _center['y'] = (Math.max(..._peaksYList) - Math.min(..._peaksYList))
    }
    // console.log(_peaks)
    return _center
  }
  // 修正翻转调整后的坐标错误偏差
  #revisionDraws() {
    let _selectedDraws = this.#draws.filter(val => val.selected && !val.lock)
    _selectedDraws.forEach(_item => {
      if (this.#currentPeak) {
        switch (this.#currentPeak.code) {
          case 'tm':
          case 'bm':
            if (_item.height < 0) {
              // [a, b] = [b, a]; // es6 对调两个值
              _item.y = _item.y + _item.height;
              _item.height = Math.abs(_item.height);
            }
            break;
          case 'lm':
          case 'rm':
            if (_item.width < 0) {
              _item.x = _item.x + _item.width;
              _item.width = Math.abs(_item.width);
            }
            break;
          case 'tr':
          case 'bl':
          case 'tl':
          case 'br':
            if (_item.width < 0) {
              _item.x = _item.x + _item.width;
              _item.width = Math.abs(_item.width);
            }
            if (_item.height < 0) {
              _item.y = _item.y + _item.height;
              _item.height = Math.abs(_item.height);
            }
            break;
        }
      }
    })
  }
  #updateDraws({offsetX, offsetY}) {
    if (offsetX === undefined || offsetY === undefined || offsetX.constructor !== Number || offsetY.constructor !== Number) {
      return false;
    }
    let _selectedDraws = this.#draws.filter(val => val.selected && !val.lock)
    if (this.#currentPeak) {
      const _ds_origin = {
        x: (offsetX - this.#hoverPoint.x),
        y: (offsetY - this.#hoverPoint.y)
      }
      const _ds = {
        width: _ds_origin.x / this.#zoomSize,
        height: _ds_origin.y / this.#zoomSize
      }
      // console.log(`x: ${_ds_origin.x}, y: ${_ds_origin.y}`)
      if (this.#currentPeak.code.match(/-rotate/gi)) {
        // const _center = this.#findOutCenter(this.#peakRect)
        _selectedDraws.forEach((val,vindex) => {
          let _rotate = this.#originSelectedDraws[vindex].rotate !== undefined ? this.#originSelectedDraws[vindex].rotate : 0
          val['rotate'] = _rotate + 45;
        //   // this.#peakRect['rotate'] = val.rotate
          console.log(val.rotate)
        })
      }
      switch(this.#currentPeak.code) {
        case 'bm':
          _selectedDraws.forEach((val,vindex) => {
            val['height'] = this.#originSelectedDraws[vindex].height + _ds.height;
          })
          break;
        case 'rm':
          _selectedDraws.forEach((val,vindex) => {
            val['width'] = this.#originSelectedDraws[vindex].width + _ds.width;
          })
          break;
        case 'tm':
          _selectedDraws.forEach((val,vindex) => {
            val['y'] = this.#originSelectedDraws[vindex].y + _ds.height;
            val['height'] = this.#originSelectedDraws[vindex].height - _ds.height;
          })
          break;
        case 'lm':
          _selectedDraws.forEach((val,vindex) => {
            val['x'] = this.#originSelectedDraws[vindex].x + _ds.width;
            val['width'] = this.#originSelectedDraws[vindex].width - _ds.width;
          })
          break;
        case 'br':
          if (_selectedDraws.length > 1) {
            let _delta = (_ds.height + _ds.width) / 2
            _selectedDraws.forEach((val,vindex) => {
              val['height'] = this.#originSelectedDraws[vindex].height + _delta;
              val['width'] = this.#originSelectedDraws[vindex].width + _delta;
            })
          } else {
            _selectedDraws.forEach((val,vindex) => {
              val['height'] = this.#originSelectedDraws[vindex].height + _ds.height;
              val['width'] = this.#originSelectedDraws[vindex].width + _ds.width;
            })
          }
          break;
        case 'tl':
          if (_selectedDraws.length > 1) {
            let _delta = (_ds.height + _ds.width) / 2
            _selectedDraws.forEach((val,vindex) => {
              val['x'] = this.#originSelectedDraws[vindex].x + _delta;
              val['width'] = this.#originSelectedDraws[vindex].width - _delta;
              val['height'] = this.#originSelectedDraws[vindex].height - _delta;
              val['y'] = this.#originSelectedDraws[vindex].y + _delta;
            })
          } else {
            _selectedDraws.forEach((val,vindex) => {
              val['x'] = this.#originSelectedDraws[vindex].x + _ds.width;
              val['width'] = this.#originSelectedDraws[vindex].width - _ds.width;
              val['height'] = this.#originSelectedDraws[vindex].height - _ds.height;
              val['y'] = this.#originSelectedDraws[vindex].y + _ds.height;
            })
          }
          break;
        case 'tr':
          if (_selectedDraws.length > 1) {
            let _delta = (_ds.height + _ds.width) / 2
            _selectedDraws.forEach((val,vindex) => {
              val['width'] = this.#originSelectedDraws[vindex].width + _delta;
              val['height'] = this.#originSelectedDraws[vindex].height - _delta;
              val['y'] = this.#originSelectedDraws[vindex].y + _delta;
            })
          } else {
            _selectedDraws.forEach((val,vindex) => {
              val['width'] = this.#originSelectedDraws[vindex].width + _ds.width;
              val['height'] = this.#originSelectedDraws[vindex].height - _ds.height;
              val['y'] = this.#originSelectedDraws[vindex].y + _ds.height;
            })
          }
          break;
        case 'bl':
          if (_selectedDraws.length > 1) {
            let _delta = (_ds.height + _ds.width) / 2
            _selectedDraws.forEach((val,vindex) => {
              val['width'] = this.#originSelectedDraws[vindex].width - _delta;
              val['height'] = this.#originSelectedDraws[vindex].height + _delta;
              val['x'] = this.#originSelectedDraws[vindex].x + _delta;
            })
          } else {
            _selectedDraws.forEach((val,vindex) => {
              val['width'] = this.#originSelectedDraws[vindex].width - _ds.width;
              val['height'] = this.#originSelectedDraws[vindex].height + _ds.height;
              val['x'] = this.#originSelectedDraws[vindex].x + _ds.width;
            })
          }
          break;
        case 'pp':
          if (this.tinkerUp.wayIndex !== undefined && this.tinkerUp.wayIndex !== null && this.tinkerUp.wayIndex.constructor === Number) {
            _item.ways[this.tinkerUp.wayIndex].x = _sditem.ways[this.tinkerUp.wayIndex].x + _ds.width;
            _item.ways[this.tinkerUp.wayIndex].y = _sditem.ways[this.tinkerUp.wayIndex].y + _ds.height;
          } else {
            _item.x = _sditem.x + _ds.width;
            _item.y = _sditem.y + _ds.height;
          }
          break;
      }
    } else {
      // 整体移动
      _selectedDraws.forEach((val,vindex) => {
        val['x'] = this.#originSelectedDraws[vindex].x + (offsetX - this.#hoverPoint.x) / this.#zoomSize;
        val['y'] = this.#originSelectedDraws[vindex].y + (offsetY - this.#hoverPoint.y) / this.#zoomSize;
      })
    }
    // this.#this.#ctx.aks(_selectedDraws)
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
        const {peak, peakRect, cursor, draw } = this.#detectOverSomething({pointX: this.#hoverPoint.x, pointY: this.#hoverPoint.y})
        if (peak) {
          this.#currentPeak = peak;
        } else {
          this.selectDraw({pointX: this.#hoverPoint.x, pointY: this.#hoverPoint.y, single: false, ctrlKey: e.ctrlKey})
        }
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
        const {peak, peakRect, cursor, draw } = this.#detectOverSomething({pointX: e.offsetX, pointY: e.offsetY})
        this.#currentCursor = cursor.match(/rotate/gi) ? 'rotate' : undefined
      }
      
      if (!this.#spacebarPressed && this.#lBtnPressing) {
        this.#updateDraws({offsetX:e.offsetX, offsetY:e.offsetY})
      }
    }
    if (e.button === 2) {
      
    }
  }
  pointerUpFn(e) {
    if (e.button === 0) {
      if (!this.#spacebarPressed) {
        const _selectedDraws = this.#draws.filter(val => val.selected && !val.lock)
        
        if (!_selectedDraws.length) {
          this.#originSelectedDraws = undefined;
        } else {
          this.#revisionDraws()
          this.#originSelectedDraws = this.constructor.cloneDeep(_selectedDraws)
        }
        // this.#this.#ctx.aks(this.#originSelectedDraws)
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
  #renderCursor() {
    if (this.#currentCursor) {
      document.documentElement.style.cursor = 'vertical-text'
      // this.#setCtx(this.#ctx, {
      //   fillStyle: '#83c3fb',
      //   strokeStyle: '#83c3fb',
      //   lineWidth: 1,
      // })
      // const _cursor = new Path2D(this.#svgCursors[this.#currentCursor].path)
      // this.#ctx.fill(_cursor)
    } else {
      // document.documentElement.style.cursor = 'default'
    }
  }
  setDrawsData(draws) {
    console.log('set draws data')
    this.#draws = this.constructor.cloneDeep(draws)
    this.#originSelectedDraws = this.constructor.cloneDeep(this.#draws.filter(val=>val.selected && !val.lock))
    // this.#this.#ctx.aks(this.#draws.filter(val=>val.selected));
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
  #detectOverSomething({pointX, pointY}) {
    if (pointX === undefined || pointY === undefined || pointX.constructor !== Number || pointY.constructor !== Number) {
      return {};
    }
    
    let _cursor = 'default';
    let _peak = undefined;
    let _drawIndex = undefined;
    let _peakRect = undefined;
    let _draw = undefined;
    // console.log(this.#peakRect)
    if (_cursor === 'default' && this.#peakRect) {
      // this.#ctx.save()
      if (this.#peakRect.rotate !== undefined) {
        const _center = this.#findOutCenter(this.#peakRect)
        this.#ctx.translate(_center.x, _center.y)
        this.#ctx.rotate(this.#peakRect.rotate * Math.PI /180)
        this.#ctx.translate(-_center.x, -_center.y)
      }
      if (this.#peaks && this.#peaks.length) {
        for (let i=(this.#peaks.length-1);i>=0;i--) {
          let val = this.#peaks[i]
          const _path = new Path2D()
          let _flag = false;
          this.#setCtx(this.#ctx, {
            lineWidth: 1
          })
          _path.arc(val.x, val.y, val.radius/this.#zoomSize, 0, 2 * Math.PI);
          _flag = this.#ctx.isPointInPath(_path, pointX, pointY)
          if (_flag) {
            _cursor = val.cursor
            _peak = val;
            this.#ctx.restore()
            break;
          }
        }
      }
      if (_cursor === 'default') {
        const _path2d = new Path2D();
        _path2d.rect(this.#peakRect.x, this.#peakRect.y, this.#peakRect.width, this.#peakRect.height)
        let _flag = this.#ctx.isPointInPath(_path2d, pointX, pointY)
        if (_flag) {
          _peakRect = this.#peakRect
          _cursor = 'move'
          this.#ctx.restore()
        }
      }
    }
    
    if (_cursor === 'default' && this.#draws && this.#draws.length) {
      // console.log('draws')
      for (let i=(this.#draws.length-1);i>=0;i--) {
        let val = this.#draws[i]
        if (!val.lock) {
          if (val.rotate !== undefined) {
            // this.#ctx.save()
            const _center = this.#findOutCenter(val)
            this.#ctx.translate(_center.x, _center.y)
            this.#ctx.rotate(val.rotate * Math.PI /180)
            this.#ctx.translate(-_center.x, -_center.y)
          }
          const _path = this.#drawToSvgPath(val)
          let _flag = (!val.fillStyle || val.fillStyle === 'transparent') ? this.#ctx.isPointInStroke(_path, pointX, pointY) : this.#ctx.isPointInPath(_path, pointX, pointY)
          if (_flag) {
            _cursor = 'move'
            _drawIndex = i;
            _draw = val;
            this.#ctx.restore()
            break;
          }
        }
      }
    }
    document.documentElement.style.cursor = _cursor
    const _returnObj = {peak: _peak, cursor: _cursor, draw: _draw, peakReck: _peakRect, drawIndex: _drawIndex }
    
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
    // console.log('render peaks')
    this.#generatePeaks(this.#draws.filter(val => val.selected && !val.lock))
    if (this.#peakRect) {
      this.#renderDraw(this.#ctx, this.#peakRect)
    }

    if (this.#peaks && this.#peaks.length) {
      this.#peaks.forEach((val,vindex) => {
        let _is_rotate = val.code.match(/-rotate/gi)
        // this.#ctx.save()
        this.#setCtx(this.#ctx, {
          fillStyle: _is_rotate ? '#fff' : '#ff8787',
          strokeStyle: _is_rotate ? '#333' : '#83c3fb',
          lineWidth: 1
        })
        const _peak = new Path2D()
        _peak.arc(val.x, val.y, val.radius/this.#zoomSize, (_is_rotate ? val.startAngle : 0), (_is_rotate ? val.endAngle : 2 * Math.PI) );
        
        if (this.#peakRect.rotate) {
          const _center = this.#findOutCenter(this.#peakRect)
          this.#ctx.translate(_center.x, _center.y)
          this.#ctx.rotate(this.#peakRect.rotate * Math.PI /180)
          this.#ctx.translate(-_center.x, -_center.y)
        }
        this.#ctx.fill(_peak)
        this.#ctx.stroke(_peak)
        this.#ctx.restore()
      })
    }
  }
  #renderRotatePoint() {
    let _center = {
      x: 0,
      y: 0
    }
    if (this.#background && this.#background.centerX && this.#background.centerY) {
      _center = {
        x: this.#background.centerX,
        y: this.#background.centerY
      }
    } else {
      _center = {
        x: Math.floor(this.#canvas.clientWidth/2),
        y: Math.floor(this.#canvas.clientHeight/2)
      }
    }
    const _path = new Path2D()
    this.#setCtx(this.#ctx, {
      lineWidth: 1,
      strokeStyle: 'red',
      fillStyle: 'red'
    })
    _path.arc(_center.x, _center.y, 3/this.#zoomSize, 0, 2 * Math.PI);
    this.#ctx.fill(_path)
    // this.#ctx.stroke(_path)
  }
  #resetStage(){
    let _width = this.#wrap.clientWidth
    let _height = this.#wrap.clientHeight
    if (this.#background && this.#background.width && this.#background.height) {
      _width = Math.max(this.#background.width, this.#wrap.clientWidth)
      _height = Math.max(this.#background.height, this.#wrap.clientHeight)
    }
    this.#ctx.clearRect(-_width, -_height, _width*3, _height*3)

    this.#ctx.resetTransform()
    // console.log(this.#zoomSize, this.#dragOffset.x, this.#dragOffset.y)
    this.#ctx.translate(this.#dragOffset.x, this.#dragOffset.y);
    this.#ctx.scale(this.#zoomSize, this.#zoomSize);

    this.#rotateStage()
    // 默认状态
    this.#setCtx(this.#ctx)
    this.#ctx.save()
  }
  #rotateStage() {
    if (this.#stageDegree) {
      let _center = {
        x: 0,
        y: 0
      }
      if (this.#background && this.#background.centerX && this.#background.centerY) {
        _center = {
          x: this.#background.centerX,
          y: this.#background.centerY
        }
      } else {
        _center = {
          x: Math.floor(this.#canvas.clientWidth/2),
          y: Math.floor(this.#canvas.clientHeight/2)
        }
      }
      this.#ctx.translate(_center.x, _center.y)
      this.#ctx.rotate(this.#stageDegree * Math.PI /180)
      this.#ctx.translate(-_center.x, -_center.y)
    }
  }
  #renderBoard() {
    if (!this.#renderTime) {
      this.#renderTime = new Date().getTime()
    }

    this.#resetStage()

    this.#renderBackground()
    this.#renderDraws()
    // this.#renderTmpDraw()
    // this.#renderCustomAction()
    this.#renderPeaks()
    this.#renderRotatePoint()
    // this.#renderCursor()
    
    // if ((new Date().getTime() - this.#renderTime) < 100 ) {
      window.requestAnimationFrame(() => this.#renderBoard());
    // }
  }
}
