export default function arcDrawType({samoPadIns, samoPad}={}){
  try {
      if (!samoPad){
          throw new Error('miss samoPad')
      }
      if (!samoPadIns){
          throw new Error('miss samoPadIns')
      }
      let _downPoint = {x: 0, y:0}
      let _lBtnPressing = false
      let _zoomSizeObj = null
      let _dragOffset = null
      return {
        type: 'arc', // 重要标识
        downFn: (e) => {
          const _btnVal = e.which;
          if (_btnVal === 3){
            // console.log(`鼠标右键`)
            samoPadIns?.setCursor('grabbing');
            samoPadIns?.dragDown(e)
          }
          if (_btnVal === 1) {
            _lBtnPressing = true;
            _dragOffset = samoPadIns?.getDragOffset()
            _zoomSizeObj = samoPadIns?.getZoomSize()
            let _x = (e.offsetX-_dragOffset.x)/_zoomSizeObj.current
            let _y = (e.offsetY-_dragOffset.y)/_zoomSizeObj.current
            _downPoint = {
              x: _x,
              y: _y,
            }
            samoPadIns?.setTmpDraw({
              x: _downPoint.x,
              y: _downPoint.y,
              radius: 1,
              type: 'arc',
              drawName: 'arc',
              strokeStyle: 'red',
              lineWidth: 2,
            }, true)
          }
        },
        moveFn: (e) => {
          const _btnVal = e.which;
          samoPadIns?.setCursor('crosshair');
          if (_btnVal === 1) {
            if (_lBtnPressing && _dragOffset && _zoomSizeObj) {
              let _tmpDraw = samoPadIns?.getTmpDraw()
              let _x = (e.offsetX-_dragOffset.x)/_zoomSizeObj.current
              // let _y = (e.offsetY-_dragOffset.y)/_zoomSizeObj.current
              const _radius = _downPoint.x
              _tmpDraw.radius = Math.abs(_x-_radius);
            }
          }
          if (_btnVal === 3){
            samoPadIns?.dragMove(e);
          }
        },
        upFn: (e, params) => {
          const _btnVal = e.which;
          // console.log(params)
          if (_btnVal === 1) {
            if (_lBtnPressing) {
              _lBtnPressing = false;
              let _tmpDraw = samoPadIns?.getTmpDraw()
              // console.log(_tmpDraw)
              if (_tmpDraw){
                _tmpDraw.uuid = samoPad.generateUUID()
                _tmpDraw.label = params.label
                
                samoPadIns?.addDrawData(_tmpDraw)
                samoPadIns?.setTmpDraw(null)
              }
            }
            samoPadIns?.setDrawType('pointer')
            // console.log(params)
            // console.log(samoPadIns?.exportDrawsData())
          }
          if (_btnVal === 3){
            if (samoPadIns?.detectIsDBClick(e.timeStamp)) {
              samoPadIns?.zoomReset();
            }
          }
        },
        outFn: (e) => {
          // this.rectUpFn(e)
        }
      }
  } catch(error){
      return new Error(error?.message)
  }
}