export default function brushDrawType({samoPadIns, samoPad}={}){
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
          type: 'brush', // 重要标识
          downFn: (e, params) => {
            const _btnVal = e.which;
            if (_btnVal === 3){
              // console.log(`鼠标右键`)
              samoPadIns?.setCursor('grabbing');
              samoPadIns?.dragDown(e)
            }
            if (_btnVal === 1) {
              _downPoint = {
                x: e.offsetX,
                y: e.offsetY,
              }
              _lBtnPressing = true;
              _dragOffset = samoPadIns?.getDragOffset()
              _zoomSizeObj = samoPadIns?.getZoomSize()
              let _x = (e.offsetX-_dragOffset.x)/_zoomSizeObj.current
              let _y = (e.offsetY-_dragOffset.y)/_zoomSizeObj.current
              let _path2d = new Path2D()
              _path2d.moveTo(_x, _y)
              samoPadIns?.setTmpDraw({
                type: 'brush',
                drawName: 'brush',
                strokeStyle: 'blue',
                lineCap: 'square',
                lineJoin: 'bevel',
                lineWidth: 20,
                path2d: _path2d,
                ...params
              }, true)
            }
          },
          moveFn: (e) => {
            const _btnVal = e.which;
            samoPadIns?.setCursor('crosshair');
            if (_btnVal === 1) {
              if (_lBtnPressing && _dragOffset && _zoomSizeObj) {
                let _x = (e.offsetX-_dragOffset.x)/_zoomSizeObj.current
                let _y = (e.offsetY-_dragOffset.y)/_zoomSizeObj.current
                let _path2d = samoPadIns?.getTmpDraw()?.path2d
                _path2d.lineTo(_x, _y)
              }
            }
            if (_btnVal === 3){
              samoPadIns?.dragMove(e);
            }
          },
          upFn: (e) => {
            const _btnVal = e.which;
            if (_btnVal === 1) {
              if (_lBtnPressing) {
                _lBtnPressing = false;
                let _tmpDraw = samoPadIns?.getTmpDraw()
                // console.log(_tmpDraw)
                _tmpDraw.uuid = samoPad.generateUUID()
                samoPadIns?.addDrawData(_tmpDraw)
              }
              samoPadIns?.setTmpDraw(null)
              // samoPadIns?.setDrawType('pointer')
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