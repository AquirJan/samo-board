"use strict";
import BigNumber from './bignumber.mjs';
import cloneDeep from './lodash.clonedeep.js'
import recordActionHistory from './recordActionHistory.js';
// x=(x1-x2)*Math.cos(Math.pi/180.0*旋转角度)-(y1-y2)*Math.sin(pi/180.0*旋转角度)+x2
// y=(x1-x2)*Math.sin(Math.pi/180.0*旋转角度)+(y1-y2)*Math.cos(pi/180.0*旋转角度)+y2
export default class samoPad {
  wheelFn = undefined;
  wrap;
  ctx;
  canvas;
  animationFrameId=null;
  dragOffset = {x:0,y:0};
  dragDownPoint = {x:0,y:0};
  zoomSize = 1;
  oldZoomSize = 1;
  zoomToObj = null;
  bgList = [];
  stageDegree = 0;
  historyRecordIns=null;
  peakGap = 4;
  peaks = [];
  peakRect = undefined;
  adjustType = 'all';
  mousePressing = false;
  mouseMoving = false;
  currentPeak = undefined;
  lBtnPressing = false;
  rBtnPressing = false;
  renderTime = undefined;
  currentCursor = undefined;
  spacebarPressed = false;
  clickTimeLogs=[];
  resizing = false;
  draws = [];
  singleBg = null
  existBrushObj = null
  drawTypeList={}
  originSelectedDraws=undefined;
  
  currentRotateCenter = null;
  drawType = 'pointer';
  pencilDownFn = undefined;
  pencilMoveFn = undefined;
  pencilUpFn = undefined;
  pencilOutFn = undefined;
  rotateStartPoint = undefined;
  windowResizeFn=undefined;
  windowKeyDownFn=undefined;
  windowKeyUpFn=undefined;
  moveStep = 1
  svgCursors = {
    svgLocation: {
      path: 'M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12 ,2Z',
      offsetX: 0,
      offsetY: 0,
      size: 1
    },
    svgRotate: {
      path: 'M8.016 15.984h12v2.016h-2.016v2.016h-2.016v-2.016h-7.969q-0.844 0-1.43-0.586t-0.586-1.43v-7.969h-2.016v-2.016h2.016v-2.016h2.016v12zM15.984 14.016v-6h-6v-2.016h6q0.844 0 1.43 0.586t0.586 1.43v6h-2.016zM12.047 0q4.688 0 8.133 3.188t3.82 7.828h-1.5q-0.281-2.813-1.875-5.063t-4.078-3.422l-1.359 1.313-3.797-3.797q0.141 0 0.328-0.023t0.328-0.023zM7.453 21.469l1.359-1.313 3.797 3.797q-0.141 0-0.328 0.023t-0.328 0.023q-4.688 0-8.133-3.188t-3.82-7.828h1.5q0.281 2.813 1.875 5.063t4.078 3.422z',
      offsetX: 15,
      offsetY: 15,
      size: 1
    }
  }
  hoverPoint = {
    x: 0,
    y: 0
  }
  drawChanged = false;
  tmpDraw = undefined;
  constructor(options={}) {
    this.opts = this.constructor.mergeDeep({
      manualRender: false, // 是否开启手动控制渲染
      wrap: undefined,
      autoAppend: true, // 是否自动把canvas append到父级容器
      fontSize: 15,
      maxZoomSize: 3,
      measurement: null,
      preventDeleteBtn: false,
      fontFamily: 'PingFang SC, Microsoft YaHei, Helvetica, Helvetica Neue, Hiragino Sans GB, Arial, sans-serif',
      focusMask: {
        render: false,
        fillStyle: 'rgba(0,0,0,.9)',
      },
      recordHistory: false,
      defaultHistory: [],
      guideLine:{
        render: false,
        strokeStyle: 'rgb(51.2,126.4,204)',
        lineWidth: 2,
        lineDash: [8, 6]
      },
      ctxStyle: { 
        // rotate: 0,
        // translate: [0, 0],
        strokeStyle: '#333',
        fillStyle: 'transparent',
        lineWidth: 1, 
        lineDash: [],
        lineJoin: 'miter', // bevel, round, miter;
        lineCap: 'butt', // butt, round, square
        gco: 'source-over'
      }
    }, options)
    this.init();
  }
  // 规范小数
  normalFloat(floatNumber = 0, fixed = 0) {
    return parseFloat(floatNumber.toFixed(fixed));
  }
  setMoveStep(nv){
    if (!isNaN(nv) || nv !== 0){
      this.moveStep = nv;
    }
  }
  // 计算图片显示宽高
  calcImageSize(width, height) {
    let _obj = {
      viewWidth: 0,
      viewHeight: 0,
      offsetX: 0,
      offsetY: 0,
      scaled: 1
    };
    if (width && height) {
      const _container = {
        width: this.wrap.clientWidth,
        height: this.wrap.clientHeight
      }
      _obj.scaled = Number((Math.min((_container.width/width), (_container.height/height), 1)).toFixed(2))
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
    return new Promise((resolve, reject) => {
      if (!src) {
        reject({
          success: false,
          msg: 'no src'
        });
      }
      const image = new Image();
      image.crossOrigin = 'Anonymous';
      image.src = src;
      image.onload = () => {
        if (calcScaled) {
          const { viewHeight, viewWidth, scaled, offsetX, offsetY } = this.calcImageSize(image.naturalWidth, image.naturalHeight);
          // console.log(scaled, offsetX, offsetY)
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
        reject({
          success: false,
          message: 'load image error',
          src
        });
      };
    });
  }
  setBackground({src, fillStyle='transparent', animate=false}){
    return new Promise(async (resolve, reject)=>{
      try {
        const _obj = {
          src,
          fillStyle
        }
        if (_obj.src) {
          this.singleBg = await this.asyncLoadImage(_obj.src);
        } else {
          this.singleBg = {
            success: true,
            ..._obj
          }
        }
        this.zoomSize = this.singleBg?.scaled ?? 1;
        this.dragOffset ={
          x: this.singleBg?.offsetX??0,
          y: this.singleBg?.offsetY??0,
        }
        this.zoomReset({animate})
        return resolve({
          ...this.singleBg
        })
      } catch(error){
        return reject({
          success: false,
          error: true,
          message: `setBackground Error: ${error?.message}`
        })
      }
    })
  }
  static getDPI() {  
    const devicePixelRatio = window.devicePixelRatio;  
    const standardDPI = 96; // 标准 DPI  

    // 估算 DPI  
    const estimatedDPI = standardDPI * devicePixelRatio; 

    return estimatedDPI;  
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
    // const isObject = (obj) => obj && obj.constructor === Object;
    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach((key) => {
        const pVal = prev[key]; // 默认值
        const oVal = obj[key]; // 新值
        if (pVal !== undefined && oVal !== undefined) {
          // console.log(pVal)
          // console.log(oVal)
          if (pVal === null || oVal === null) {
            prev[key] = oVal;
          } else if (pVal.constructor === Array && oVal.constructor === Array) {
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
  initActionHistory(historys){
    this.historyRecordIns = new recordActionHistory({
      historyArray: [historys]
    });
  }
  recordHistoryChange(){
    if (this.opts?.recordHistory && this.drawChanged){
      this.historyRecordIns?.recordChange(this.constructor.cloneDeep(this.draws))
      this.drawChanged = false
    }
  }
  // 历史记录操作,后退
  revoke() {
    if (!this.historyRecordIns) {
      return console.error(`历史操作记录实例不存在`);
    }
    const _data = this.historyRecordIns.revoke();
    if (!_data) {
      console.error(`需要撤销的数据有异常`);
      return false;
    }
    this.setDrawsData(_data, false);
    return true;
  }
  // 历史记录操作,前进
  onward() {
    if (!this.historyRecordIns) {
      return console.error(`历史操作记录实例不存在`);
    }
    const _data = this.historyRecordIns.onward();
    if (!_data) {
      console.error(`需要前进的数据有异常`);
      return false;
    }
    this.setDrawsData(_data, false);
    return true;
  }
  // 清空历史记录
  clearHistory(){
    this.historyRecordIns?.clearRecords()
  }
  init() {
    this.currentCursor = 'default'
    if (this.opts.autoAppend) {
      if (!this.opts.wrap) {
        this.wrap = document.createElement('div')
        this.wrap.style.cssText = `width: 400px;height: 300px;`
      } else {
        this.wrap = this.opts.wrap;
      }
    }
    console.log("初始化samo-pad");
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext('2d');
    if (this.wrap) {
      this.wrap.appendChild(this.canvas);
      this.canvas.height = Math.floor(this.wrap.clientHeight)
      this.canvas.width = Math.floor(this.wrap.clientWidth);
    }
    // this.canvas.style.cssText = `display:grid;background-color: #fff;`
    // 渲染
    this.renderBoard()
    this.setDrawType()

    this.canvas.oncontextmenu = e => {
      e.preventDefault();
    };
    this.wheelFn = e => this.canvasWheel(e)
    this.canvas.addEventListener('wheel', this.wheelFn, false);
    this.bindKeysEvents()

    this.windowResizeFn = e => this.windowResize(e);
    window.addEventListener('resize', this.windowResizeFn, false);
    // this.wrapSizeObserver()
    this.resizeLogic()

    if (this.opts?.recordHistory) {
      this.initActionHistory(this.opts.defaultHistory);
    }
    return this;
  }
  // 销毁
  destroy() {
    window.removeEventListener('resize', this.windowResizeFn, false);
    
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null;
    }
    this.revokeKeysEvents();
    this.historyRecordIns?.destroy()
    this.canvas?.remove();
    this.canvas = null;
    // this.wrap?.remove();
    this.wrap = null;
    document.documentElement.style.cursor = 'default';
  }
  wrapSizeObserver() {
    if (!this.wrap) {
      console.error('没有容器');
      return;
    }
    const resizeObserver = new ResizeObserver( entries => {
      this.resizeLogic()
    });
    resizeObserver.observe(this.wrap);
  }
  async resizeLogic(){
    try {
      if (this.resizing) {
        return;
      }
      this.resizing = true;
      this.canvas.width = 0;
      this.canvas.height = 0;
      // await this.sleep(300)
      setTimeout(()=>{
        const _wrapRect = this.wrap;
        // console.log(_wrapRect.clientWidth, _wrapRect.clientHeight)
        this.canvas.width = Math.floor(_wrapRect?.clientWidth??0);
        this.canvas.height = Math.floor(_wrapRect?.clientHeight??0);
        let _bgObj = {
          success: true,
          fillStyle: this.singleBg?.fillStyle ?? 'transparent',
          scaled: 1,
          offsetX: 0,
          offsetY: 0,
          viewWidth: _wrapRect?.clientWidth??0,
          viewHeight: _wrapRect?.clientHeight??0,
          width: _wrapRect?.clientWidth??0,
          height: _wrapRect?.clientHeight??0
        };
        if (this.singleBg && this.singleBg.data) {
          const { height, width, scaled, offsetX, offsetY } = this.calcImageSize(this.singleBg.data?.naturalWidth??0, this.singleBg.data?.naturalHeight??0);
          _bgObj = {
            src: this.singleBg?.src,
            success: true,
            msg: 'load image complite',
            data: this.singleBg.data,
            scaled,
            offsetX,
            offsetY,
            viewWidth: width,
            viewHeight: height,
            width: this.singleBg.data?.naturalWidth??0,
            height: this.singleBg.data?.naturalHeight??0
          };
        }
        this.singleBg = _bgObj;
        this.zoomSize = this.singleBg?.scaled??1;
        this.dragOffset = {
          x: this.singleBg?.offsetX ?? 0,
          y: this.singleBg?.offsetY??0
        };

        this.resizing = false;
        // console.log(`resizeLogic done: ${this.resizing}`)
      }, 600)
    } catch(error) {
      this.resizing = false;
      console.warn(`resizeLogic Error: ${error?.message}`)
    }
  }
  async windowResize($event) {
    this.resizeLogic()
  }
  bindKeysEvents() {
    this.windowKeyDownFn = (e)=>this.windowKeyDown(e)
    this.windowKeyUpFn = (e)=>this.windowKeyUp(e)
    window.addEventListener('keydown', this.windowKeyDownFn, false);
    window.addEventListener('keyup', this.windowKeyUpFn, false);
  }
  revokeKeysEvents() {
    window.removeEventListener('keydown', this.windowKeyDownFn, false);
    window.removeEventListener('keyup', this.windowKeyUpFn, false);
    this.windowKeyDownFn = null;
    this.windowKeyUpFn = null;
  }
  windowKeyDown(e) {
    // console.log(e)
    // console.log(e.keyCode)
    const _targetNodeName = e?.target?.nodeName
    // console.log(_targetNodeName)
    if (!_targetNodeName?.match(/body/gi)){
      return;
    }
    const _ctrlKey = e?.ctrlKey
    const _keyCode = e?.keyCode
    const _stepDelta = e.shiftKey ? 10*this.moveStep : this.moveStep;
    const _step = this.normalFloat(_stepDelta / this.zoomSize);
    // console.log(_keyCode)
    switch(_keyCode) {
      case 32:
        if (!this.spacebarPressed) {
          this.currentCursor = 'grab'
          this.spacebarPressed = true;
        }
        break;
      case 37:
      case 65:
        // 左
        this.draws.forEach(item=>{
          if (item.selected){
            item.x -= _step
          }
        })
        break;
      case 39:
      case 68:
        // 右
        this.draws.forEach(item=>{
          if (item.selected){
            item.x += _step
          }
        })
        break;
      case 38:
      case 87:
        // 上
        this.draws.forEach(item=>{
          if (item.selected){
            item.y -= _step
          }
        })
        break;
      case 40:
      case 83:
        // 下
        this.draws.forEach(item=>{
          if (item.selected){
            item.y += _step
          }
        })
        break;
      case 46:
        this.deleteDraws()
        break;
      case 90:
        if (_ctrlKey){
          this.revoke()
        }
        break;
      case 89:
        if (_ctrlKey){
          this.onward()
        }
        break;
    }
    // console.log(this.draws)
    this.canvas.dispatchEvent(
      new CustomEvent('spKeyDown', {
        bubbles: true,
        detail: {
          keycode: _keyCode,
          selectedDraws: this.constructor.cloneDeep(this.draws?.filter(item=>item.selected)??[])
        }
      })
    );
  }
  windowKeyUp(e) {
    // console.log(e.keyCode)
    const _keyCode = e.keyCode
    switch(_keyCode) {
      case 32:
        if (this.spacebarPressed) {
          this.currentCursor = 'default'
          this.spacebarPressed = false;
        }
        break;
    }

    // this.canvas.dispatchEvent(
    //   new CustomEvent('spKeyUp', {
    //     bubbles: true,
    //     detail: {
    //       keycode: _keyCode,
    //       // draw: this.selectedDraw,
    //     }
    //   })
    // );
  }
  setCtx(ctx, ctxStyle={}){
    if (!ctx) {
      return;
    }
    const _configs = {...this.opts.ctxStyle, ...ctxStyle}
    for (let key in _configs) {
      if (key === 'gco') {
        ctx.globalCompositeOperation = _configs[key];
      } 
      else if(key==='lineWidth') {
        ctx[key] = _configs[key]/this.zoomSize;
      } 
      else if(key === 'lineDash') {
        // ctx.setLineDash(_configs[key])
        let _list = _configs[key]?.map(item=>item/this.zoomSize)
        ctx.setLineDash(_list)
      } else if (!['rotate', 'translate'].includes(key)) {
        ctx[key] = _configs[key];
      }
    }
  }
  // 文件转base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
  // blob 转成文件
  blobToFile(theBlob, fileName = 'export-picture.png', options = { type: 'image/png' }) {
    return new File([theBlob], fileName, options);
  }
  // base64 to blob数据
  b64toBlob(base64Data) {
    let byteString = atob(base64Data.split(',')[1]);
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/png' });
  }
  autoDownloadFile({name, file}){
    const url = URL.createObjectURL(file);  
        
    // 创建一个 a 标签并触发下载  
    const a = document.createElement('a');  
    a.href = url;  
    a.download = name; // 设置下载文件的名称  
    document.body.appendChild(a);  
    a.click();  
    URL.revokeObjectURL(url)
    document.body.removeChild(a);  
  }
  exportPic(options={}){  
    const _options = this.constructor.mergeDeep(
      {
        type: 'fusion', // draws, fusion
        quality: 1,
        format: 'image/png',
        autoDownload: false,
        // width: this.sbDom.width,
        // height: this.sbDom.height,
        file: {
          name: 'export-picture.png',
          options: {
            type: 'image/png'
          }
        }
      },
      options
    );
    return new Promise((resolve, reject)=>{
      window.cancelAnimationFrame(this.animationFrameId)
      try {
        let _img = ''
        const _canvas = document.createElement('canvas');
        const _width = this.singleBg?.width ?? this.wrap?.clientWidth;
        const _height = this.singleBg?.height ?? this.wrap?.clientHeight;
        _canvas.width = _width;
        _canvas.height = _height;
        const _canvasCtx = _canvas.getContext('2d');
        this.setCtx(_canvasCtx)
        _canvasCtx.save()
        this.renderDraws({ctx: _canvasCtx})
        const _fontSize = Math.ceil((this.singleBg?.width??this.wrap?.width??1)*16/1080)
        this.renderLabels({ctx: _canvasCtx, zoomSize: 1, fontSize: _fontSize})
        this.renderBackground({ctx: _canvasCtx})
        _img = _canvas.toDataURL(_options.format, _options.quality);
        if (!_img) {
          throw new Error(`image base64 code Error`)
        }
        if (_options.file){
          _img = this.blobToFile(this.b64toBlob(_img), _options.file.name, _options.file.options)
          if (_options.autoDownload) {
            this.autoDownloadFile({
              name: _options.file.name,
              file: _img
            })
          }
        }
        return resolve({
          success: true,
          data: _img,
          message: `export picture success`
        })
      } catch(error){
        return reject({
          success: false,
          error: true,
          message: `exportPic function Error: ${error?.message}`
        })
      } finally {
        this.renderBoard()
      }
    }) 
  }
  exportDrawsData() {
    let _draws = this.constructor.cloneDeep(this.draws)
    _draws.forEach(val => {
      if (val.x !== undefined){
        val['x'] = Math.round(val.x)
      }
      if (val.y !== undefined){
        val['y'] = Math.round(val.y)
      }
      if (val.width !== undefined){
        val['width'] = Math.round(val?.width??0)
      }
      if (val.height !== undefined){
        val['height'] = Math.round(val?.height??0)
      }
      if (val.ways && val.ways.length) {
        val.ways.forEach(wal=>{
          wal['x'] = Math.round(wal.x)
          wal['y'] = Math.round(wal.y)
        })
      }
    })
    return _draws
  }
  getCanvas() {
    return this.canvas
  }
  isOutOfContainer(x, y, w, h, cw, ch) {
    return (x | y | (cw - (x + w)) | (ch - (y + h))) < 0;
  }
  setGuideLine(options={}){
    this.opts.guideLine = {
      ...this.opts.guideLine,
      ...options
    }
  }
  setFocusMask(options={}){
    this.opts.focusMask = {
      ...this.opts.focusMask,
      ...options
    }
  }
  setCanvasStyle(styles={}) {
    let _cStyleObj = {}
    if (this.canvas.style.cssText.length) {
      let _stylesArray = this.canvas.style.cssText.replace(/\;$/gi, '').split(';')
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
    return this.canvas.style.cssText = _style.join(';');
  }
  // 计算缩放后拖拉后的差值
  calcZoomedDragoffsetDelta({dx,dy, zoomSize=1}={}) {
    // 锚点缩放
    let _dx = dx ?? this.hoverPoint.x
    let _dy = dy ?? this.hoverPoint.y
    const _originHoverOnPicX = ((_dx-this.dragOffset.x)/this.oldZoomSize)*zoomSize
    const _originHoverOnPicY = ((_dy-this.dragOffset.y)/this.oldZoomSize)*zoomSize
    
    let _dragOffset = {
      x: _dx-_originHoverOnPicX,
      y: _dy-_originHoverOnPicY
    };
    return _dragOffset;
  }
  // 还原缩放
  zoomReset({animate}={}) {
    this.dragDownPoint={x: 0, y:0}
    if (animate){
      const x = (this.singleBg?.width??0)/2
      const y = (this.singleBg?.height ?? 0)/2;
      this.zoomTo({zoomSize: this.singleBg?.scaled ?? 1, x, y, animate})
    } else {
      this.dragOffset = { 
        x: this.singleBg?.offsetX ?? 0, 
        y: this.singleBg?.offsetY ?? 0,
      };
      this.zoomSize = this.singleBg?.scaled ?? 1;
    }
  }
  // 计算当前缩放尺寸
  calcCurrentZoomSize({size, step = 0.01, max = 3, zoomSize}={}) {
    if (isNaN(size)) {
      console.warn('size param is not a number');
      return null;
    }
    this.oldZoomSize = Number(size);
    let _size = 1
    if (step) {
      _size = size + step;
    }
    if (zoomSize) {
      _size = zoomSize
    }
    const _min = Math.min((this.singleBg?.scaled??1), 1);
    return Math.max(_min, Math.min(parseFloat(_size.toFixed(2)), max));
  }
  // 获取缩放倍数
  getZoomSize() {
    return {
      current: this.zoomSize,
      default: this.singleBg?.scaled ?? 1
    };
  }
  // 放大/缩小
  zoomAction({step = 0.05, animate}={}) {
    let _zoomSize = this.calcCurrentZoomSize({size: this.zoomSize, max: this.opts?.maxZoomSize, step});
    if (animate){
      if (this.oldZoomSize !== _zoomSize) {
        let _dragOffset = this.calcZoomedDragoffsetDelta({zoomSize: _zoomSize});
        this.zoomTo({zoomSize: _zoomSize, targetDragOffset:_dragOffset, animate})
      } else {
        if (step < 0){ // 缩小
          this.zoomReset({animate})
        }
      }
      return;
    } 
    this.zoomSize = _zoomSize
    if (this.oldZoomSize !== _zoomSize) {
      this.dragOffset = this.calcZoomedDragoffsetDelta({zoomSize: _zoomSize});
    } else {
      if (step < 0){ // 缩小
        this.zoomReset()
      }
    }
  }
  // 裁剪图片
  cropImage({src, imageData, x, y, width, height, quality=1, format="jpeg"}) {
    return new Promise(async (resolve, reject)=>{
      try {
        let res = undefined
        if (imageData) {
          res = {success: true, data: imageData}
        } else {
          res = await this.asyncLoadImage(src, false);
        }
        const _canvas = document.createElement('canvas');
        _canvas.width = width;
        _canvas.height = height;
        const _canvasCtx = _canvas.getContext('2d');
        if (!res || !res.data || !res.success) {
          throw new Error(res?.msg)    
        }
        _canvasCtx.drawImage(res.data, x, y, width, height, 0, 0, width, height);
        let _result = _canvas.toDataURL(`image/${format}`, quality);
        return resolve({
          success: true,
          result: _result,
          message: `裁剪成功`
        })
      } catch(error){
        return reject({success: false, error: true, message: error?.message})
      }
    })
  }
  // 传入坐标直接缩放到指定点位
  zoomTo({zoomSize=1, x, y, animate=false, targetDragOffset}){
    // x, y 为需要聚焦的中心点坐标，使用原始尺寸
    // console.log(`zoomTo zoomSize: ${zoomSize}, x: ${x}, y: ${y}`)
    if (!targetDragOffset && (x === undefined || y === undefined)){
      console.warn(`please give me center of x and y or targetDragOffset`)
      return;
    }
    
    let _zoomSize = this.calcCurrentZoomSize({size: this.zoomSize, zoomSize});
    
    let _dragOffset = targetDragOffset
    if (!_dragOffset){
      const _x = Math.ceil(x*_zoomSize)
      const _y = Math.ceil(y*_zoomSize)
      
      const _canvasCenterX = Math.floor(this.wrap.clientWidth/2)
      const _canvasCenterY = Math.floor(this.wrap.clientHeight/2)
      
      _dragOffset = {
        x: _canvasCenterX - _x,
        y: _canvasCenterY - _y,
      }
    }

    if (!animate){
      this.dragOffset = _dragOffset
      this.zoomSize = _zoomSize
      return;
    }
    this.zoomToObj = {
      duration: animate?.duration ?? 300,
      targetDragOffset: _dragOffset,
      targetZoomSize: _zoomSize,
      zero: Date.now(),
      deltaZoomSize: new BigNumber(_zoomSize).minus(this.zoomSize).toNumber(),
      deltaDragOffsetX: new BigNumber(_dragOffset.x).minus(this.dragOffset.x).toNumber(),
      deltaDragOffsetY: new BigNumber(_dragOffset.y).minus(this.dragOffset.y).toNumber(),
      currentZoomSize: Number(this.zoomSize),
      currentDragOffset:{
        ...this.dragOffset
      }
    }
  }
  // 检验是否双击
  detectIsDBClick(ctime, mousewhich=1) { // 默认鼠标左键
    this.clickTimeLogs.unshift({mousewhich, ctime});
    if (this.clickTimeLogs.length > 2) {
      this.clickTimeLogs = this.clickTimeLogs?.filter(item=>item.mousewhich === mousewhich)?.slice(0, 2)??[];
    }
    if (this.clickTimeLogs.length !== 2) {
      return false;
    }
    const _deltaTime = Math.abs(this.clickTimeLogs[0].ctime - this.clickTimeLogs[1].ctime);

    if (_deltaTime <= 200) {
      return true;
    } else {
      return false;
    }
  }
  dispatchDrawEvent({e, eventType, transferData}){
    if (!eventType) {
      return;
    }
    let _selectedDraws = [];
    let _overDraws = [];
    if (eventType.match(/up|down/gi)){
      _selectedDraws = this.constructor.cloneDeep(this.draws?.filter(item=>item.selected)??[])
      _overDraws = this.detectOverSomething({
        pointX: e.offsetX,
        pointY: e.offsetY,
        alsoDraws: true
      })
    }
    // console.log(e)
    this.canvas?.dispatchEvent(
      new CustomEvent(`${this.drawType}${eventType}`, {
        // bubbles: true,
        detail: {
          which: e?.which ?? -1,
          selectedDraws: _selectedDraws,
          overDraws: _overDraws?.draws??[],
          point: {
            x: e.offsetX,
            y: e.offsetY
          },
          transferData
        }
      })
    );
  }
  deleteDraws(draws){
    if (this.opts?.preventDeleteBtn){
      return;
    }
    let _draws = draws
    if (_draws){
      let _ids = _draws?.map(item=>item.uuid)
      this.draws = this.draws?.filter(item=>!_ids.includes(item.uuid))??[]
    } else {
      _draws = this.draws?.filter(item=>item.selected)
      this.draws = this.draws?.filter(item=>!item.selected)??[]
    }
    this.drawChanged = true;
    this.recordHistoryChange()
    if (!draws){
      this.canvas.dispatchEvent(
        new CustomEvent('deleteDraw', {
          bubbles: true,
          detail: {
            deletedDraws: _draws
          }
        })
      );
    }
  }
  // 设置选中框框
  setSelectedDraws(data, adjustType="all"){
    let _ids = data?.map(item=>item.uuid)??[]
    if (_ids.length){
      this.adjustType = adjustType  
      this.draws.forEach(val => {
        if (_ids.includes(val.uuid)){
          val.selected = true;
        } else {
          val.selected = false;
        }
      })
    } else {
      this.adjustType = 'all'
      this.draws.forEach(val => {
        val.selected = false;
      })
    }
    this.originSelectedDraws = this.constructor.cloneDeep(this.draws.filter(item=>item.selected))
  }
  // 获取当前背景数据
  getBgObj() {
    return this.singleBg;
  }
  unsetDrawType(){
    this.drawType = null;
    this.canvas.removeEventListener('mousedown', this.pencilDownFn, false);
    this.canvas.removeEventListener('mousemove', this.pencilMoveFn, false);
    this.canvas.removeEventListener('mouseup', this.pencilUpFn, false);
    this.canvas.removeEventListener('mouseout', this.pencilOutFn, false);
    this.pencilDownFn = null;
    this.pencilMoveFn = null;
    this.pencilUpFn = null;
    this.pencilOutFn = null;
  }
  // 设置画图类型
  setDrawType(type='pointer', options={}) {
    this.drawType = type;
    this.draws.forEach(val => {
      val['selected'] = false;
    })
    
    // console.log(`setDrawType ---- ${type}`)
    // document.documentElement.style.cursor = 'crosshair'
    // console.log(this.drawType)
    this.canvas.removeEventListener('mousedown', this.pencilDownFn, false);
    this.canvas.removeEventListener('mousemove', this.pencilMoveFn, false);
    this.canvas.removeEventListener('mouseup', this.pencilUpFn, false);
    this.canvas.removeEventListener('mouseout', this.pencilOutFn, false);

    const _injectTypeObj = this.drawTypeList[type]
    if (_injectTypeObj){
      let _params = {
        // spacebarPressed: this.spacebarPressed,
        ...options,
      }
      if (_injectTypeObj.downFn) {
        this.pencilDownFn = (e) => {
          let _transferData = _injectTypeObj.downFn(e, _params)
          this.dispatchDrawEvent({e, eventType:'Down', transferData: _transferData})
        }
      }
      if (_injectTypeObj.moveFn) {
        this.pencilMoveFn = (e) => {
          _injectTypeObj.moveFn(e, _params)
          this.dispatchDrawEvent({e, eventType:'Move'})
        }
      }
      if (_injectTypeObj.upFn) {
        this.pencilUpFn = (e) => {
          let _transferData = _injectTypeObj.upFn(e, _params)
          this.dispatchDrawEvent({e, eventType:'Up', transferData: _transferData})
        }
      }
      if (_injectTypeObj.outFn) {
        this.pencilOutFn = (e) => {
          _injectTypeObj.outFn(e, _params)
          this.dispatchDrawEvent({e, eventType:'Out'})
        }
      }
    } else {
      if (this[`${this.drawType}DownFn`]) {
        this.pencilDownFn = e => {
          this[`${this.drawType}DownFn`](e, options);
          this.dispatchDrawEvent({e, eventType:'Down'})
        }
      }
      if (this[`${this.drawType}MoveFn`]) {
        this.pencilMoveFn = e => {
          this[`${this.drawType}MoveFn`](e, options);
          this.dispatchDrawEvent({e, eventType:'Move'})
        }
      }
      if (this[`${this.drawType}UpFn`]) {
        this.pencilUpFn = e => {
          this[`${this.drawType}UpFn`](e, options);
          this.dispatchDrawEvent({e, eventType:'Up'})
        }
      }
      if (this[`${this.drawType}OutFn`]) {
        this.pencilOutFn = e => {
          this[`${this.drawType}OutFn`](e, options);
          this.dispatchDrawEvent({e, eventType:'Out'})
        }
      }
    }

    // bind Event
    if (this.pencilDownFn){
      this.canvas.addEventListener('mousedown', this.pencilDownFn, false);
    }
    if (this.pencilMoveFn){
      this.canvas.addEventListener('mousemove', this.pencilMoveFn, false);
    }
    if (this.pencilUpFn){
      this.canvas.addEventListener('mouseup', this.pencilUpFn, false);
    }
    if (this.pencilOutFn){
      this.canvas.addEventListener('mouseout', this.pencilOutFn, false);
    }
  }
  renderSingleDraw({ctx, obj}) {
    if (!obj) {
      return;
    }
    let _path2d = new Path2D();
    ctx.save()
    switch(obj.type) {
      case "rect":
        this.setCtx(ctx, obj)
        _path2d.rect(obj.x, obj.y, obj.width, obj.height);
        if (obj.rotate) {
          const _center = this.findOutCenter(obj)
          ctx.translate(_center.x, _center.y)
          ctx.rotate(obj.rotate * Math.PI /180)
          ctx.translate(-_center.x, -_center.y)
        }
        ctx.stroke(_path2d)
        ctx.fill(_path2d)

        // 绘制方向 1:无 2:左 0:右 3:上 5:下
        let directionList = [0, 6, 20, 21, 27, 57, 65, 70, 86, 95] //有方向的元器件类型
        
        if(obj.drawName==="pcb" && obj.testType==0 && obj.direction!=1 && directionList.indexOf(Number(obj.code))>-1){
          ctx.fillStyle="red";
          const originW = 4
          let W = originW/this.zoomSize;  //方向线宽度
          W = W <= originW ? originW : W
          const _direction = obj.direction && obj.direction.constructor === String ? obj.direction : obj.direction?.toString()
          switch (_direction){
            // 左
            case '2':
              ctx.fillRect(obj.x, obj.y, W, obj.height);
              break;
            // 右
            case '0':
              ctx.fillRect(obj.x+obj.width-W, obj.y, W, obj.height);
              break;
            // 上
            case '3':
              ctx.fillRect(obj.x, obj.y, obj.width, W);
              break;
            // 下
            case '5':
              ctx.fillRect(obj.x, obj.y+obj.height-W, obj.width, W);
              break;
            default:;
          }
        }
        break;
      case 'arc':
        this.setCtx(ctx, obj)
        _path2d.arc(obj.x, obj.y, obj.radius, obj?.startAngle??0, obj?.endAngle??(2*Math.PI));
        if (obj.rotate) {
          let _rotateCenter = obj.rotateCenter
          ctx.translate(_rotateCenter?.x??0, _rotateCenter?.y??0)
          ctx.rotate(obj.rotate * Math.PI /180)
          ctx.translate(-_rotateCenter?.x??0, -_rotateCenter?.y??0)
        }
        ctx.stroke(_path2d)
        ctx.fill(_path2d)
        break;
      case 'polygon':
        this.setCtx(ctx, obj)
        _path2d.moveTo(obj.x, obj.y);
        obj?.ways?.forEach(item=>{
          _path2d.lineTo(item.x, item.y);
        })
        if (obj.closed){
          _path2d.closePath()
        }
        if (obj.rotate) {
          const _center = this.findOutCenter(obj)
          ctx.translate(_center.x, _center.y)
          ctx.rotate(obj.rotate * Math.PI /180)
          ctx.translate(-_center.x, -_center.y)
        }
        ctx.stroke(_path2d)
        if (obj.closed){
          ctx.fill(_path2d)
        }
        break;
      case 'eraser':
        this.setCtx(ctx, {
          lineCap: obj?.lineCap,
          lineJoin: obj?.lineJoin,
          gco: obj?.gco ?? 'destination-out',
          strokeStyle: obj?.strokeStyle,
        })
        ctx.lineWidth=obj?.lineWidth
        ctx.stroke(obj.path2d);
        break;
      case 'brush':
        this.setCtx(ctx, {
          lineCap: obj?.lineCap,
          lineJoin: obj?.lineJoin,
          gco: obj?.gco,
          strokeStyle: obj?.strokeStyle,
        })
        ctx.lineWidth=obj?.lineWidth
        ctx.stroke(obj?.path2d);
        
        break;
    }
    ctx.restore()
  }
  generatePeaks(draws) {
    this.peaks = []
    this.peakRect = undefined;
    if (!draws || draws.constructor !== Array || !draws.length) {  
      return this.peaks
    }
    let _pointsList = []
    draws.forEach(val=>{
      if (val.type === 'rect') {
        _pointsList.push({
          x: val.x,
          y: val.y
        },
        {
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
      if (val.type === 'arc') {
        // console.log(val.radius)
        let _radius = val.radius
        _pointsList.push({
          x: (val.x - _radius),
          y: (val.y - _radius),
        },
        {
          x: (val.x + _radius),
          y: (val.y - _radius),
        },
        {
          x: val.x+_radius,
          y: (val.y + _radius),
        },
        {
          x: val.x,
          y: (val.y + _radius),
        })
      }
      if (val.ways && val.ways.length) {
        _pointsList.push({
          x: val.x,
          y: val.y
        })
        val.ways.forEach((wal, windex) => {
          _pointsList.push({
            waysIndex: windex,
            x: wal.x,
            y: wal.y,
          })
        })
      }
    })
    let _peakGap = this.peakGap/this.zoomSize
    _peakGap = _peakGap<=this.peakGap?this.peakGap:_peakGap;
    const _XList = _pointsList.map(val => val.x)
    const _YList = _pointsList.map(val => val.y)
    const _minX = Math.min(..._XList) - _peakGap;
    const _maxX = Math.max(..._XList) + _peakGap;
    const _minY = Math.min(..._YList) - _peakGap;
    const _maxY = Math.max(..._YList) + _peakGap;
    let _radius = 3/this.zoomSize
    _radius = _radius < 1 ? 1: _radius;

    let _rotate = draws && draws.length === 1 ? draws[0].rotate : 0
    
    this.peakRect = {
      type: 'rect',
      drawName: 'peakRect',
      x: _minX,
      y: _minY,
      strokeStyle: '#83c3fb',
      fillStyle: 'rgba(0, 0, 0, .4)',
      lineWidth: 2,
      lineDash: [8, 6],
      width: (_maxX-_minX),
      height: (_maxY-_minY),
      // gco: 'destination-over',
      rotate: _rotate,
    }
    if (this.adjustType === 'all'){
      let _arcRotateCenter = {
        x: this.peakRect.x + this.peakRect.width/2,
        y: this.peakRect.y + this.peakRect.height/2,
      }
      let _arcBase = {
        type: 'arc',
        startAngle: 0,
        lineWidth: 6,
        radius: _radius,
        fillStyle: '#ff8787',
        strokeStyle: '#83c3fb',
        endAngle: 2 * Math.PI,
        rotate: _rotate,
        rotateCenter: _arcRotateCenter
      }
      this.peaks = [
        // {
        //   cursor: 'default',
        //   code: 'tube',
        //   type: 'polygon',
        //   lineWidth: 2,
        //   strokeStyle: '#83c3fb',
        //   x: this.peakRect.x + (this.peakRect.width/2),
        //   y: this.peakRect.y - (25/this.zoomSize),
        //   rotate: _rotate,
        //   // lineDash: [8/this.zoomSize, 6/this.zoomSize],
        //   ways:[
        //     {
        //       x: this.peakRect.x + Math.floor(this.peakRect.width/2),
        //       y: this.peakRect.y
        //     }
        //   ]
        // },
        // {
        //   ..._arcBase,
        //   fillStyle: '#fff' ,
        //   strokeStyle: '#333',
        //   // cursor: 'svgRotate',
        //   cursor: 'move',
        //   code: 'all-rotate',
        //   // radius: 6/this.zoomSize,
        //   x: this.peakRect.x + (this.peakRect.width/2),
        //   y: this.peakRect.y - (25/this.zoomSize)
        // },
        {
          ..._arcBase,
          cursor: 'nwse-resize',
          code: 'tl',
          x: this.peakRect.x,
          y: this.peakRect.y
        },
        // {
        //   cursor: 'rotate',
        //   code: 'tl-rotate',
        //   startAngle: Math.PI/2,
        //   endAngle: 2 * Math.PI,
        //   radius: 3,
        //   x: this.peakRect.x,
        //   y: this.peakRect.y
        // },
        {
          ..._arcBase,
          cursor: 'nesw-resize',
          code: 'tr',
          x: this.peakRect.x + this.peakRect.width,
          y: this.peakRect.y
        },
        // {
        //   cursor: 'rotate',
        //   code: 'tr-rotate',
        //   startAngle: Math.PI * 3,
        //   endAngle: 2.5 * Math.PI,
        //   radius: 20,
        //   x: this.peakRect.x+this.peakRect.width,
        //   y: this.peakRect.y
        // },
        {
          ..._arcBase,
          cursor: 'nwse-resize',
          code: 'br',
          x: this.peakRect.x+this.peakRect.width,
          y: this.peakRect.y+this.peakRect.height
        },
        // {
        //   cursor: 'rotate',
        //   code: 'br-rotate',
        //   startAngle: Math.PI * 3.5,
        //   endAngle: Math.PI * 5,
        //   radius: 20,
        //   x: this.peakRect.x+this.peakRect.width,
        //   y: this.peakRect.y+this.peakRect.height
        // },
        {
          ..._arcBase,
          cursor: 'nesw-resize',
          code: 'bl',
          x: this.peakRect.x,
          y: this.peakRect.y+this.peakRect.height
        },
        // {
        //   cursor: 'rotate',
        //   code: 'bl-rotate',
        //   startAngle: Math.PI * 2,
        //   endAngle: Math.PI * 3.5,
        //   radius: 20,
        //   x: this.peakRect.x,
        //   y: this.peakRect.y+this.peakRect.height
        // }
      ]
      let _limitSize = 50/this.zoomSize
      if (draws.length === 1) {
        if (draws[0].type === 'rect'){
  
          if (this.peakRect.height >= _limitSize) {
            this.peaks = this.peaks.concat([
              {
                ..._arcBase,
                cursor: 'ew-resize',
                code: 'rm',
                x: this.peakRect.x+this.peakRect.width,
                y: this.peakRect.y+Math.floor(this.peakRect.height/2),
              },
              {
                ..._arcBase,
                cursor: 'ew-resize',
                code: 'lm',
                x: this.peakRect.x,
                y: this.peakRect.y+Math.floor(this.peakRect.height/2),
              },
            ])
          }
          if (this.peakRect.width >= _limitSize) {
            this.peaks = this.peaks.concat([
              {
                ..._arcBase,
                cursor: 'ns-resize',
                code: 'tm',
                x: this.peakRect.x + Math.floor(this.peakRect.width/2),
                y: this.peakRect.y
              },
              {
                ..._arcBase,
                cursor: 'ns-resize',
                code: 'bm',
                x: this.peakRect.x+Math.floor(this.peakRect.width/2),
                y: this.peakRect.y+this.peakRect.height,
              }
            ])
          }
        } else if (draws[0].type === 'arc'){
          this.peaks = this.peaks?.filter(item=>item.code === 'br')
          // this.peaks = [
          //   {
          //     ..._arcBase,
          //     cursor: 'ew-resize',
          //     code: 'rm',
          //     x: this.peakRect.x+this.peakRect.width,
          //     y: this.peakRect.y+Math.floor(this.peakRect.height/2),
          //   }
          // ]
        } else if (draws[0].type === 'polygon'){
          this.peakRect = null;
          this.peaks = _pointsList?.map((item, index)=>{
            return {
              ..._arcBase,
              code: 'pp',
              waysIndex: item.waysIndex,
              cursor: 'move',
              x: item.x,
              y: item.y
            }
          })
        }
      }
    }
    return this.peaks
  }
  findOutCenter(draw) {
    let _center = {
      x: 0,
      y: 0
    }
    let _peaks = this.peaks || [];
    if (draw && draw.width && draw.height) {
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
  revisionDraws(draw) {
    if (draw){
      let _draw = {
        ...draw
      }
      if (_draw.width < 0) {
        _draw.x = _draw.x + _draw.width;
        _draw.width = Math.abs(_draw.width);
      }
      if (_draw.height < 0) {
        _draw.y = _draw.y + _draw.height;
        _draw.height = Math.abs(_draw.height);
      }
      return _draw;
    }
    this.draws.forEach(_item => {
      if (_item.selected){
        if (this.currentPeak) {
          switch (this.currentPeak.code) {
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
      }
    })
  }
  calculatePointRelative(center, point){
    const {x: cx, y: cy} = center;
    const {x: px, y: py} = point;
    const _relative = {
        x: Math.floor(px-cx),
        y: -Math.floor(py-cy),
    }
    return _relative
  }
  calculateDegree(point) {
    if (!point) {
        console.warn('calculateDegree miss require params')
    }
    const {x, y} = point
    let _angle = Math.atan2(y, x)  // 极坐标系
    let _degree = _angle*(180/Math.PI);
    _degree = -(_degree-90)
    return Number((_degree).toFixed(0))
  }
  // 单控制点调整尺寸
  revisionSize({x, y}) {
    // 调整尺寸
    const _ds = this.getDeltaSize(x, y);
    if (!this.originSelectedDraws || !this.originSelectedDraws.length) {
      return;
    }
    this.draws.forEach(item=>{
      const _sditem = this.originSelectedDraws?.find(oitem=>oitem.uuid === item.uuid)
      // console.log(_sditem)
      // console.log(this.currentPeak)
      if (_sditem && this.currentPeak){
        if (_sditem.type === 'rect'){
          switch (this.currentPeak.code) {
            case 'bm':
              item.height = _sditem.height + _ds.height;
              break;
            case 'rm':
              item.width = _sditem.width + _ds.width;
              break;
            case 'br':
              item.height = this.shiftKey ? _sditem.width + _ds.width : _sditem.height + _ds.height;
              item.width = _sditem.width + _ds.width;
              break;
            case 'tm':
              item.height = _sditem.height - _ds.height;
              item.y = _sditem.y + _ds.height;
              break;
            case 'lm':
              item.width = _sditem.width - _ds.width;
              item.x = _sditem.x + _ds.width;
              break;
            case 'tl':
              item.height = _sditem.height - _ds.height;
              item.y = _sditem.y + _ds.height;
              item.width = _sditem.width - _ds.width;
              item.x = _sditem.x + _ds.width;
              break;
            case 'tr':
              item.width = _sditem.width + _ds.width;
              item.height = _sditem.height - _ds.height;
              item.y = _sditem.y + _ds.height;
              break;
            case 'bl':
              item.height = _sditem.height + _ds.height;
              item.width = _sditem.width - _ds.width;
              item.x = _sditem.x + _ds.width;
              break;
          }
        } else if (_sditem.type === 'arc'){
          switch (this.currentPeak.code) {
            case 'br':
              item.radius = _sditem.radius + _ds.height;
              break;
          }
        } else if (_sditem.type === 'polygon'){
          switch (this.currentPeak.code) {
            case 'pp':
              if (this.currentPeak.waysIndex !== undefined){
                item.ways[this.currentPeak.waysIndex].x=this.currentPeak.x + _ds.width;
                item.ways[this.currentPeak.waysIndex].y=this.currentPeak.y + _ds.height;
              } else {
                item.x = _sditem.x + _ds.width;
                item.y = _sditem.y + _ds.height;
              }
              break;
          }
        }
        
      }
    });
    
  }
  dragDown(e){
    this.dragDownPoint = {
      x: e.offsetX - this.dragOffset.x,
      y: e.offsetY - this.dragOffset.y
    };
  }
  dragMove(e){
    this.currentCursor = 'grabbing';
    this.dragOffset = {
      x: e.offsetX-this.dragDownPoint.x,
      y: e.offsetY-this.dragDownPoint.y,
    }
  }
  // 指针状态事件
  pointerDownFn(e) {
    // console.log(e)
    const _ctrlKey = e?.ctrlKey
    const _altKey = e?.altKey
    // e.which: 鼠标左键数值1，滚轮中键数值2，鼠标右键数值3
    const _btnVal = e?.which
    this.mousePressing = true;
    if (_btnVal === 1){
      if (!_ctrlKey && !_altKey && this.detectIsDBClick(e.timeStamp)) {
        this.zoomAction({step: 0.8, animate: true});
        return;
      }
      const {peak, draws, draw, cursor, isOnPeakRect} = this.detectOverSomething({
        pointX: e.offsetX,
        pointY: e.offsetY,
        alsoDraws: true
      })
      this.currentCursor = cursor
      this.currentPeak = peak;
      let _nv = null
      
      if (!this.currentPeak){
        if (_ctrlKey){
          const _uuids = this.draws?.filter(item=>item.selected)??[]
          this.setSelectedDraws([...draws, ..._uuids])
        } else {
          let _oldSelectedDrawIds = this.draws?.filter(item=>item.selected)?.map(item=>item.uuid)??[]
          this.draws.forEach(item=>{
            item.selected = false;
          })
          if (draws && draws.length){
            if (!_oldSelectedDrawIds.length || draws.length === 1){
              _nv = draws[0]
              this.setSelectedDraws([_nv])
            } else {
              if (_oldSelectedDrawIds.length === 1) {
                if (_altKey){
                  // 依次循环选择
                  if (_oldSelectedDrawIds.length <= 0){
                    _nv = draws[0]
                  } else {
                    _nv = draws.reduce((p, c, i)=>{
                      if (_oldSelectedDrawIds.includes(c.uuid)){
                        if (draws[i+1]){
                          p = draws[i+1]
                        } else {
                          p = draws[0]  
                        }
                        return p
                      } else {
                        if (!_oldSelectedDrawIds.includes(c.uuid) && !p){
                          p = c
                        } 
                        return p
                      }
                    }, null)
                  }
                } else {
                  if (draws?.find(item=>_oldSelectedDrawIds.includes(item.uuid))){
                    _nv = this.draws?.find(item=>_oldSelectedDrawIds.includes(item.uuid))
                  } else {
                    _nv =draws[0]
                  }
                }
                if (_nv){
                  this.setSelectedDraws([_nv])
                }
              }
            }
          }
        }
      }
      if (_nv){
        this.generatePeaks([_nv])
        // this.originSelectedDraws = this.constructor.cloneDeep([_nv])
      }
      if (this.peakRect || this.currentPeak){
        if (this.currentPeak){
          this.dragDownPoint = {
            x: e.offsetX,
            y: e.offsetY
          }
        } else if (this.peakRect) {
          let _path = new Path2D()
          _path.rect(this.peakRect.x, this.peakRect.y, this.peakRect.width, this.peakRect.height);
          if (this.ctx.isPointInPath(_path, e.offsetX, e.offsetY)){
            this.dragDownPoint = {
              x: e.offsetX,
              y: e.offsetY
            }
          } else {
            this.dragDownPoint = {
              x: 0,
              y: 0
            };
          }
        }
      } else {
        // polygon situation
        this.dragDownPoint = {
          x: e.offsetX,
          y: e.offsetY
        }
      }
    }
    if (_btnVal === 3){
      this.currentCursor = 'grabbing';
      this.dragDown(e)
    }
  }
  pointerMoveFn(e) {
    const _btnVal = e?.which
    if (this.mousePressing){
      if (_btnVal === 1){
        this.drawChanged = true;
        if (this.currentPeak){
          this.revisionSize({
            x: e.offsetX,
            y: e.offsetY
          })
          if (this.currentPeak.code.match(/rotate/gi)){
            const _center = this.findOutCenter(this.peakRect)
            // console.log(`_center: ${JSON.stringify(_center)}`)
            this.currentRotateCenter = _center;
            const _relativePoint = this.calculatePointRelative(_center, {x:(e.offsetX-this.dragOffset.x)/this.zoomSize, y:(e.offsetY-this.dragOffset.y)/this.zoomSize})
            // console.log(`this.hoverPoint: ${JSON.stringify(this.hoverPoint)}`)
            // console.log(`_relativePoint: ${JSON.stringify(_relativePoint)}`)
            const _degree = this.calculateDegree(_relativePoint)
            // console.log(_degree)
            this.peakRect.rotate = _degree
            this.draws.forEach(item=>{
              if (item.selected){
                item['rotate'] = _degree
              }
            })
          }
        } else if (this.dragDownPoint){
          const _dx = e.offsetX - this.dragDownPoint.x
          const _dy = e.offsetY - this.dragDownPoint.y
          this.draws.forEach(item=>{
            const _origin = this.originSelectedDraws?.find(oitem=>oitem.uuid === item.uuid)
            if (item.selected && _origin){
              if (item.type === 'polygon'){
                item.x = _origin.x + _dx/this.zoomSize;
                item.y = _origin.y + _dy/this.zoomSize;
                item.ways.forEach((witem, windex)=>{
                  witem.x = _origin.ways[windex].x+ _dx/this.zoomSize;
                  witem.y = _origin.ways[windex].y+ _dy/this.zoomSize;
                })
              } else {
                item.x = _origin.x + _dx/this.zoomSize;
                item.y = _origin.y + _dy/this.zoomSize;
              }
            }
          })
        }
      }
      if (_btnVal === 3){
        // console.log(`鼠标右键`)
        this.dragMove(e)
      }
    } else {
      const {cursor, draw, draws} = this.detectOverSomething({
        pointX: e.offsetX,
        pointY: e.offsetY,
        alsoDraws: true,
      })
      this.currentCursor = cursor;
    }
    
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
  }
  pointerUpFn(e, params) {
    const _btnVal = e?.which
    // console.log(`up -----------`)
    this.mousePressing = false;
    this.currentCursor = 'default'
    this.currentRotateCenter = null;
    if (_btnVal === 1){
      if (this.currentPeak){
        this.revisionDraws()
        this.currentPeak = null;
      }
      this.outContainerResetPosition()
      this.recordHistoryChange()
      this.originSelectedDraws = this.constructor.cloneDeep(this.draws.filter(item=>item.selected))
    }
    if (_btnVal === 3){
      // console.log(`鼠标右键`)
      if (this.detectIsDBClick(e.timeStamp, 3)) {
        this.zoomReset({animate:true});
      } 
    }
  }
  pointerOutFn(e, params) {
    this.pointerUpFn(e, params)
    // this.dragUp(e)
  }
  outContainerResetPosition(){
    const _corners = this.getBoundingCorners(this.draws.filter(item=>item.selected))
    if (!_corners || !this.singleBg){
      return;
    }
    const _isout = this.isOutOfContainer(_corners.x, _corners.y, _corners.width, _corners.height, this.singleBg.width, this.singleBg.height);
    if (_isout){
      let _deltaX = 0;
      let _deltaY = 0;
      if (_corners.tlx<0){
        _deltaX = Math.abs(_corners.tlx);
      }
      if (_corners.brx>this.singleBg.width){
        _deltaX = -(Math.abs(_corners.brx)-this.singleBg.width);
      }
      if (_corners.tly<0){
        _deltaY = Math.abs(_corners.tly);
      }
      if (_corners.bry>this.singleBg.height){
        _deltaY = -(Math.abs(_corners.bry)-this.singleBg.height);
      }
      this.draws.forEach(item=>{
        if (item.selected){
          item.x = item.x+_deltaX;
          item.y = item.y+_deltaY;
        }
      })
    }
  }
  getBoundingCorners(rects=[]) {
    if (rects.length === 0) return null;
    
    // 初始化最小/最大值
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // 遍历所有矩形，找出最小和最大的X/Y值
    for (const rect of rects) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
    }
    
    // 返回四个角的坐标
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      tlx: minX, 
      tly: minY,    // 左上角
      trx: maxX, 
      try: minY,    // 右上角
      brx: maxX, 
      bry: maxY,    // 右下角
      blx: minX, 
      bly: maxY    // 左下角
    } 
  }
  renderCursor() {
    // console.log(this.currentCursor)
    // document.documentElement.style.cursor = this.currentCursor
    // return;
    if (this.currentCursor) {
      if (this.svgCursors[this.currentCursor]){
        document.documentElement.style.cursor = 'none'
        this.setCtx(this.ctx, {
          fillStyle: '#fff',
          strokeStyle: '#333',
          lineWidth: 2,
        })
        const _cursor = new Path2D(this.svgCursors[this.currentCursor].path)
        // this.ctx.translate(this.hoverPoint.x-this.dragOffset.x-this.svgCursors[this.currentCursor].offsetX, 0)
        // this.ctx.translate(this.hoverPoint.x-this.dragOffset.x-(this.svgCursors[this.currentCursor].offsetX/this.zoomSize), this.hoverPoint.y-this.dragOffset.y-(this.svgCursors[this.currentCursor].offsetY/this.zoomSize))
        this.ctx.stroke(_cursor)
        this.ctx.fill(_cursor)
        this.ctx.restore()
      } else {
        document.documentElement.style.cursor = this.currentCursor
      }
    }
  }
  addDrawData(draw, {prevInsert=false}={}){
    const _draw = this.revisionDraws(draw)
    if (prevInsert){
      this.draws.unshift(this.constructor.cloneDeep(draw))
    } else {
      this.draws = [...this.draws, this.constructor.cloneDeep(_draw)]
    }
    this.drawChanged = true;
    this.recordHistoryChange()
  }
  setDrawsData(draws, record=false) {
    // console.log(`set draws data, record:${record}`)
    this.draws = this.constructor.cloneDeep(draws)?.map(item=>{
      if (!item.uuid){
        item['uuid'] = this.constructor.generateUUID()
      }
      return item
    })??[]
    this.originSelectedDraws = this.constructor.cloneDeep(this.draws?.filter(val=>val.selected)??[])
    // this.this.ctx.aks(this.draws.filter(val=>val.selected));
    if (record){
      this.drawChanged = true;
      this.recordHistoryChange()
    }
  }
  injectDrawType({type, downFn, moveFn, upFn, outFn}={}) {
    if (!type){
      throw new Error(`miss type`);
    }
    // console.log(`injectDrawType----${type}`)
    if (this.drawTypeList[type]){
      console.log(`type ${type}, already exists`)
      return {
        success: false,
        message: `type ${type}, already exists`
      }
    }
    this.drawTypeList[type] = {downFn, moveFn, upFn, outFn}
    return {
      success: true,
      message: `inject draw type success`
    }
  }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    let _deltas = {
      width: (x - this.dragDownPoint.x) / this.zoomSize,
      height: (y - this.dragDownPoint.y) / this.zoomSize
    };
    return _deltas;
  }
  getDragOffset(){
    return this.dragOffset
  }
  getTmpDraw(){
    return this.tmpDraw
  }
  setHoverPoint(){

  }
  // 绘画临时draw
  setTmpDraw(params, force=false) {
    if (!params){
      this.tmpDraw = null;
      return this.tmpDraw;
    }
    if (force){
      this.tmpDraw = params;
      return this.tmpDraw;
    }
    const {uuid, x, y, strokeStyle='red', lineWidth = 1, fillStyle = 'transparent', gco = 'source-over', drawName="rect", type='rect', label} = params;
    const _ds = this.getDeltaSize(x, y);
    
    if (this.tmpDraw) {
      this.tmpDraw['width'] = _ds.width
      this.tmpDraw['height'] = _ds.height
    } else {
      this.dragDownPoint = {
        x,
        y
      }
      const _x = (x - this.dragOffset.x) / this.zoomSize;
      const _y = (y - this.dragOffset.y) / this.zoomSize;
      this.tmpDraw = {
        uuid: uuid??this.constructor.generateUUID(),
        x: _x,
        y: _y,
        lineWidth,
        label,
        // width: _ds.width,
        // height: _ds.height,
        type: type,
        drawName,
        gco,
        strokeStyle,
        fillStyle,
      };
    }
    
    return this.tmpDraw;
  }
  setCursor(params){
    // params = { path, offsetX, offsetY, size}
    this.currentCursor = params;
  }
  detectOverSomething({pointX, pointY, alsoDraws=false}) {
    if (pointX === undefined || pointY === undefined || pointX.constructor !== Number || pointY.constructor !== Number) {
      return {};
    }
    
    let _cursor = 'default';
    let _peak = undefined;
    let _peakRect = undefined;
    let _draw = undefined;
    let _draws = undefined;
    // console.log(this.peakRect)
    // if (this.peakRect) {
      // if (this.peakRect.rotate !== undefined) {
      //   const _center = this.findOutCenter(this.peakRect)
      //   this.ctx.translate(_center.x, _center.y)
      //   this.ctx.rotate(this.peakRect.rotate * Math.PI /180)
      //   this.ctx.translate(-_center.x, -_center.y)
      // }
      if (this.peaks && this.peaks.length) {
        for (let i=(this.peaks.length-1);i>=0;i--) {
          this.ctx.save()
          let val = this.peaks[i]
          const _path = new Path2D()
          if (val.rotate){
            let _rotateCenter = val.rotateCenter
            this.ctx.translate(_rotateCenter?.x??0, _rotateCenter?.y??0)
            this.ctx.rotate(val.rotate * Math.PI /180)
            this.ctx.translate(-_rotateCenter?.x??0, -_rotateCenter?.y??0)
          }
          _path.arc(val.x, val.y, val.radius+this.peakGap/this.zoomSize, 0, 2 * Math.PI);
          if (this.ctx.isPointInPath(_path, pointX, pointY)) {
            _cursor = val.cursor
            _peak = val;
            break;
          }
          this.ctx.restore()
        }
      }
      // if (_cursor === 'default') {
      //   const _path2d = new Path2D();
      //   _path2d.rect(this.peakRect.x, this.peakRect.y, this.peakRect.width, this.peakRect.height)
      //   let _flag = this.ctx.isPointInPath(_path2d, pointX, pointY)
      //   if (_flag) {
      //     _peakRect = this.peakRect
      //     _cursor = 'move'
      //     // this.ctx.restore()
      //   }
      // }
      // this.ctx.restore()
    // }
    
    if (!_peak && this.draws && this.draws.length && alsoDraws) {
      // console.log('draws')
      _draws = this.draws?.filter(item=>{
        if (!item.lock || (item.selected && item.lock)) {
          let _path = new Path2D()
          this.ctx.save()
          switch(item.type){
            case 'rect':
              _path.rect(item.x, item.y, item.width, item.height);
              break;
            case 'polygon':
              _path.moveTo(item.x, item.y)
              item.ways.forEach(witem=>{
                _path.lineTo(witem.x, witem.y)
              })
              if (item.closed){
                _path.closePath()
              }
              break;
            case 'arc':
              _path.arc(item.x, item.y, item.radius, item?.startAngle??0, item?.endAngle??(2 * Math.PI));
              break;
          }
          // const _path = this.drawToSvgPath(item)
          let _flag = false;
          if (item.type === 'polygon'){
            if (item.closed){
              _flag = this.ctx.isPointInPath(_path, pointX, pointY)
            } else {
              _flag = this.ctx.isPointInStroke(_path, pointX, pointY)
            }
          } else {
            _flag = this.ctx.isPointInPath(_path, pointX, pointY)
          }
          if (_flag){
            return item
          }
          this.ctx.restore()
        }
      })??[]
      if (_draws.length) {
        _cursor = 'move'
      }
    }

    // 校验是否在peakrect上
    let _isOnPeakRect = false;
    // _peakRect = this.peakRect
    // if (_peakRect){
    //   const _peackRectPath = new Path2D()
    //   _peackRectPath.rect(_peakRect.x, _peakRect.y, _peakRect.width, _peakRect.height) 
    //   _isOnPeakRect = this.ctx.isPointInPath(_peackRectPath, pointX, pointY)
    // }
    
    const _returnObj = {peak: _peak, cursor: _cursor, draw: _draw, draws: _draws, peakReck: _peakRect, isOnPeakRect: _isOnPeakRect }
    
    return _returnObj
  }
  renderDraws({ctx, zoomSize}) {
    if (!ctx){
      console.warn(`renderDraws need ctx`)
      return;
    }
    if (this.draws && this.draws.length) {
      this.draws.forEach((val,index) => {
        this.renderSingleDraw({ctx, obj:val, zoomSize})
      })
    }
  }
  renderGuideLine(){
    if (!this.opts?.guideLine?.render){
      return;
    }
    const _lockOnId = this.opts?.guideLine?.lockOnId
    let _selectedDraws = []
    if (_lockOnId){
      _selectedDraws = this.draws?.filter(item=>item.uuid === _lockOnId);
    } else {
      _selectedDraws = this.draws?.filter(item=>item.selected && item.type ==='rect');
    }
    if (_selectedDraws.length === 1){
      const _focusRect = _selectedDraws?.[0]
      let _xCenter = _focusRect.x+_focusRect.width/2
      let _yCenter = _focusRect.y+_focusRect.height/2
      let _lines = {
        topLine: [
          {
            x: _xCenter,
            y: _focusRect.y
          },
          {
            x: _xCenter,
            y: -this.dragOffset.y/this.zoomSize
          }
        ],
        rightLine: [
          {
            x: _focusRect.x+_focusRect.width,
            y: _yCenter
          },
          {
            x: (this.canvas.clientWidth-this.dragOffset.x)/this.zoomSize,
            y: _yCenter
          }
        ],
        bottomLine: [
          {
            x: _xCenter,
            y: _focusRect.y+_focusRect.height
          },
          {
            x: _xCenter,
            y: (this.canvas.clientHeight-this.dragOffset.y)/this.zoomSize
          }
        ],
        leftLine: [
          {
            x: _focusRect.x,
            y: _yCenter
          },
          {
            x: -this.dragOffset.x/this.zoomSize,
            y: _yCenter
          }
        ]
      }
      let _path2d = new Path2D()
      this.setCtx(this.ctx, {
        strokeStyle: this.opts?.guideLine?.strokeStyle,
        lineWidth: this.opts?.guideLine?.lineWidth,
        lineDash: this.opts?.guideLine?.lineDash
      })
      for (let key of Object.keys(_lines)){
        const _start = _lines[key][0]
        const _end = _lines[key][1]
        _path2d.moveTo(_start.x, _start.y)
        _path2d.lineTo(_end.x, _end.y)
      }
      this.ctx.stroke(_path2d)
      this.ctx.restore()
    }
  }
  renderTmpDraw() {
    if (this.tmpDraw) {
      this.renderSingleDraw({ctx:this.ctx, obj:this.tmpDraw})  
    }
  }
  // 滚动缩放
  canvasWheel(e) {
    // console.log(e)
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    const _wheelDelta = e.wheelDelta;
    let _step = _wheelDelta > 0 ? 0.1 : -0.1
    this.zoomAction({step: _step, animate: false});
    e.preventDefault();
    e.stopPropagation();
  }
  // 重组显示文字
  fittingString(_ctx, str, maxWidth) {
    let strWidth = _ctx.measureText(str).width;
    const ellipsis = '...';
    const ellipsisWidth = _ctx.measureText(ellipsis).width;
    if (strWidth < maxWidth) {
      return str;
    } else {
      var len = str.length;
      while (strWidth >= maxWidth - ellipsisWidth && len-- > 0) {
        str = str.slice(0, len);
        strWidth = _ctx.measureText(str).width;
      }
      return str + ellipsis;
    }
  }
  renderPeaks(){
    // console.log('render peaks')
    this.generatePeaks(this.draws?.filter(val => val.selected))
    if (this.peakRect) {
      this.renderSingleDraw({ctx:this.ctx, obj:this.peakRect})
    }

    if (this.peaks && this.peaks.length) {
      this.peaks.forEach((val) => {
        this.renderSingleDraw({ctx:this.ctx, obj:val})
      })
    }
  }
  renderRotatePoint() {
    if (!this.currentRotateCenter){
      return;
    }
    let _center = this.currentRotateCenter;
    const _path = new Path2D()
    this.setCtx(this.ctx, {
      lineWidth: 2,
      strokeStyle: 'red',
      fillStyle: 'red'
    })
    _path.arc(_center.x, _center.y, 3/this.zoomSize, 0, 2 * Math.PI);
    this.ctx.fill(_path)
    this.ctx.restore()
    // this.ctx.stroke(_path)
  }
  clearStage(timeStamp){
    // console.log(`clear stage zoom size: ${this.zoomSize}`)
    if (this.zoomToObj){
      let _elapsed = new BigNumber(Date.now()).minus(this.zoomToObj.zero).dividedBy(this.zoomToObj.duration).toNumber()
      const _progress = Math.min(_elapsed, 1);
      if (_progress < 1){
        this.zoomSize = new BigNumber(this.zoomToObj.deltaZoomSize).times(_progress).plus(this.zoomToObj.currentZoomSize).toNumber()
        this.dragOffset.x = new BigNumber(this.zoomToObj.deltaDragOffsetX).times(_progress).plus(this.zoomToObj.currentDragOffset.x).toNumber()
        this.dragOffset.y = new BigNumber(this.zoomToObj.deltaDragOffsetY).times(_progress).plus(this.zoomToObj.currentDragOffset.y).toNumber()
      } else {
        this.zoomSize = this.zoomToObj.targetZoomSize;
        this.dragOffset = this.zoomToObj.targetDragOffset
        this.zoomToObj = null;
      }
    }
    this.ctx.resetTransform()
    // this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    let _width = this.wrap.clientWidth
    let _height = this.wrap.clientHeight
    this.ctx.clearRect(0, 0, _width, _height)
    this.ctx.translate(this.dragOffset.x, this.dragOffset.y);
    this.ctx.scale(this.zoomSize, this.zoomSize);
    // this.ctx.translate(this.dragOffset.x/this.zoomSize, this.dragOffset.y/this.zoomSize);
    // console.log(this.dragOffset)
    this.setCtx(this.ctx)
    this.ctx.save()
  }
  renderLabels({ctx, zoomSize, fontSize}){
    if (this.draws){
      for (let item of this.draws){
        this.renderLabel({ctx, draw: item, zoomSize, fontSize})
      }
    }
    if (this.tmpDraw){
      this.renderLabel({ctx, draw: this.tmpDraw})
    }
  }
  // 绘制标签
  renderLabel({draw, zoomSize, ctx, fontSize}={}) {
    const { content, placement='tl', showInside=false, strokeStyle='#444', fillStyle='white', strokeText=true} = draw?.label ?? {}
    let _finalText = content && content.constructor === Array ? content.join(',') : content;
    
    if (_finalText === undefined) {
      return;
    }

    const _ctx = ctx ? ctx : this.ctx;
    const _zoomSize = zoomSize ?? this.zoomSize;
    const _rectWidth = draw?.width??0
    const _rectHeight = draw?.height??0
    const _rectX = draw?.x??0
    const _rectY = draw?.y??0
    
    const minFonSize=16;
    let _fontOriginSize = fontSize ?? (this.opts?.fontSize ?? minFonSize)/_zoomSize
    _fontOriginSize = _fontOriginSize <= minFonSize ? minFonSize : _fontOriginSize;
    
    
    let lineWidth = 5;
    let _padding = 4/_zoomSize;
    _padding = _padding < 1 ? 1 : _padding;
    let _y = 0;
    let _x = 0;
    let _width = 0;
    let _fontWidth = _ctx.measureText(_finalText).width; // 文字的宽度
    let _outside = true;
    if (showInside) {
      const _content = this.fittingString(_ctx, _finalText, _rectWidth-_padding*2)
      _fontWidth = _ctx.measureText(_content).width;
      _finalText = _content
      _y = _rectY + _fontOriginSize;
      _width = Math.min(...[_fontWidth, _rectWidth]);
      _x = _rectX + _rectWidth - _width - _padding;
        
      _outside = false;
    }
    if (_outside){
      _y = _rectY - Math.floor(_fontOriginSize/2) - (draw?.radius??0);
      _x = _rectX;
    }
    if (placement === 'bl'){
      _y = _rectY + _fontOriginSize + _rectHeight + (draw?.radius??0);
    }
    this.setCtx(_ctx, {strokeStyle, fillStyle, lineWidth, font: `${_fontOriginSize}px ${this.opts?.fontFamily}`})
    if (strokeText){
      _ctx.strokeText(_finalText, _x, _y)
    }
    _ctx.fillText(_finalText, _x, _y);
    _ctx.restore()
  }
  renderFocusMask(){
    if (!this.opts?.focusMask?.render){
      return;
    }
    const _lockOnId = this.opts?.focusMask?.lockOnId
    let _selectedDraws = []
    if (_lockOnId){
      _selectedDraws = this.draws?.filter(item=>item.uuid === _lockOnId);
    } else {
      _selectedDraws = this.draws?.filter(item=>item.selected && item.type ==='rect');
    }
    let _fillStyle = this.opts?.focusMask?.fillStyle
    // let _selectedDraws = this.draws?.filter(item=>item.selected && item.type ==='rect');
    if (_selectedDraws.length === 1){
      const _rectItem = _selectedDraws?.[0]
      let _path2d = new Path2D()
      this.setCtx(this.ctx, { fillStyle: _fillStyle})
      _path2d.rect(-this.dragOffset.x/this.zoomSize, -this.dragOffset.y/this.zoomSize, this.canvas.width/this.zoomSize, this.canvas.height/this.zoomSize)
      this.ctx.fill(_path2d)
      this.ctx.restore()
      _path2d = new Path2D()
      this.setCtx(this.ctx, { fillStyle:'#fff', gco: 'destination-out'})
      _path2d.rect(_rectItem.x, _rectItem.y, _rectItem.width, _rectItem.height)
      this.ctx.fill(_path2d)
      this.ctx.restore()
    }
  }
  renderBackground({ctx}) {
    if (!ctx){
      console.warn(`renderBackground need ctx`)
      return;
    }
    if (this.singleBg) {
      if (this.singleBg.data){
        this.setCtx(ctx, {gco: 'destination-over'})
        // console.log(`this.singleBg.offsetX: ${this.singleBg.offsetX}, this.dragOffset.x: ${this.dragOffset.x}`)
        // this.ctx.translate((this.singleBg.offsetX+this.dragOffset.x)/this.zoomSize, (this.singleBg.offsetY+this.dragOffset.y)/this.zoomSize)
        // if (this.singleBg.degree) {
        //   const _center = {
        //     x: Math.floor(this.singleBg.width/2),
        //     y: Math.floor(this.singleBg.height/2)
        //   }
        //   this.ctx.translate(_center.x, _center.y)
        //   this.ctx.rotate(this.singleBg.degree * Math.PI /180)
        //   this.ctx.translate(-_center.x, -_center.y)
        // }
        ctx.drawImage(this.singleBg.data, 0, 0);
      } else if (this.singleBg.fillStyle){
        this.setCtx(ctx, {fillStyle: this.singleBg.fillStyle})
        ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      }
      ctx.restore()
    }
  }
  renderMeasurment({ctx}){
    if (!ctx){
      console.warn(`renderMeasurment need ctx`)
      return;
    }
    if (!this.opts.measurement){
      return;
    }
    let _xLength = (this.wrap?.clientWidth ?? 0)/this.zoomSize
    let _yLength = (this.wrap?.clientHeight ?? 0)/this.zoomSize
    if (!_xLength || !_yLength){
      return;
    }
    let _axisList = []
    let _zoomSize = this.zoomSize >= 1 ? 1 : this.zoomSize;
    let _step = Math.ceil(_xLength/14/_zoomSize)
    _step = _step <= 10 ? 10 : _step

    for (let i=_step;i<_xLength;i+=_step){
      _axisList.push([
        {
          x: i-this.dragOffset.x/this.zoomSize,
          y: -this.dragOffset.y/this.zoomSize
        },
        {
          x: i-this.dragOffset.x/this.zoomSize,
          y: (15-this.dragOffset.y)/this.zoomSize,
          label:{
            content: i,
            placement: 'bl',
          }
        },
      ])
    }
    
    for (let i=_step;i<_yLength;i+=_step){
      _axisList.push([
        {
          x: -this.dragOffset.x/this.zoomSize,
          y: i-this.dragOffset.y/this.zoomSize
        },
        {
          x: (15-this.dragOffset.x)/this.zoomSize,
          y: i-this.dragOffset.y/this.zoomSize,
          label:{
            content: i,
            placement: 'bl',
          }
        },
      ])
    }
    // console.log(`_axisXList.length: ${_axisXList.length}`)
    let _path2d = new Path2D()
    // let _axsisThick = 20/this.zoomSize;
    // this.setCtx(ctx, {fillStyle: 'rgba(255,255,255,.5)'})
    // _path2d.rect(-this.dragOffset.x/this.zoomSize, -this.dragOffset.y/this.zoomSize, this.wrap.clientWidth/this.zoomSize, _axsisThick)
    // ctx.fill(_path2d)
    // ctx.restore()
    // _path2d = new Path2D()
    for (let item of _axisList){
      this.setCtx(ctx, {strokeStyle: 'black', lineWidth: 1})
      _path2d.moveTo(item[0].x, item[0].y)
      _path2d.lineTo(item[1].x, item[1].y)
      ctx.stroke(_path2d)
      ctx.restore()
      this.renderLabel({draw: item[1], ctx})
    }
  }
  renderBgLoading(){
    this.setCtx(this.ctx, {gco: 'source-over'})
  }
  // 设置已有笔刷图
  async setExistBrushPic(obj) {
    const _obj = {
      src: '',
      ...obj
    }
    if (_obj.src) {
      this.existBrushObj = await this.asyncLoadImage(_obj.src, false);
    } else {
      this.existBrushObj = null;
    }
  }
  renderExistBrushPic({ctx}){
    // 添加已有brush
    if (!ctx){
      return;
    }
    if (this.existBrushObj && this.existBrushObj.success) {
      ctx.drawImage(this.existBrushObj.data, 0, 0);
    }
  }
  pickAoiBaseColor ({width, height, image}){
    return new Promise(async (resolve, reject) => {
      try {
        if (!image) {
          resolve({message: `没有找到图像数据`});
        }
        const _image = await this.asyncLoadImage(image, false)
        if (!_image.success){
          return reject({message: `没有该图片`})
        }
        // console.log(_image)
        const _canvas = document.createElement('canvas');
        _canvas.width = width;
        _canvas.height = height;
        const _canvasCtx = _canvas.getContext('2d');
        _canvasCtx.drawImage(_image.data, 0, 0);
        const _imgData = _canvasCtx.getImageData(0, 0, _canvas.width, _canvas.height);
        
        let _outMaskColor=undefined
        for (let i = 0; i < _imgData.data.length; i += 4) {  
          if (_imgData.data[i+3] === 255 && !_outMaskColor) {
            _outMaskColor = {
              r: _imgData.data[i],
              g: _imgData.data[i+1],
              b: _imgData.data[i+2],
              a: 255,
            }
            break;
          }
        }
        return resolve({
          outMaskColor: _outMaskColor,
        });
      } catch(error){
        console.log(error)
        return reject(error);
      }
    });
  }
  // 获取brush图层
  getBrushObj(){
    return this.existBrushObj;
  }
  renderBoard(timeStamp) {
    this.clearStage(timeStamp)
    this.renderExistBrushPic({ctx: this.ctx})
    this.renderFocusMask()
    this.renderDraws({ctx: this.ctx})
    this.renderTmpDraw()
    this.renderLabels({ctx: this.ctx})
    this.renderGuideLine()
    this.renderPeaks()
    this.renderRotatePoint()
    this.renderCursor()
    this.renderBackground({ctx: this.ctx})

    this.renderMeasurment({ctx: this.ctx})
    if (!this.opts.manualRender) {
      this.animationFrameId = window.requestAnimationFrame((timeStamp) => this.renderBoard(timeStamp));
    }
    
  }
}
