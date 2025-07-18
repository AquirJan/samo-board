export default function polygonDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        let _downPoint = {x: 0, y:0}
        let _zoomSizeObj = null
        let _dragOffset = null
        let _lastWayIndex = null;
        let _closeGap = 5;
        return {
          type: 'polygon', // 重要标识
          downFn: (e) => {
            const _btnVal = e.which;
            if (_btnVal === 3){
              // console.log(`鼠标右键`)
              samoPadIns?.setCursor('grabbing');
              samoPadIns?.dragDown(e)
            }
            if (_btnVal === 1) {
            }
          },
          moveFn: (e) => {
            const _btnVal = e.which;
            samoPadIns?.setCursor('crosshair');
            let _tmpDraw = samoPadIns?.getTmpDraw()
            // console.log(!!_tmpDraw)
            if (_tmpDraw){
              _dragOffset = samoPadIns?.getDragOffset()
              _zoomSizeObj = samoPadIns?.getZoomSize()
              let _x = (e.offsetX-_dragOffset.x)/_zoomSizeObj.current
              let _y = (e.offsetY-_dragOffset.y)/_zoomSizeObj.current
              if (!_tmpDraw.ways[_lastWayIndex]){
                _tmpDraw.ways.push({
                  x: _x,
                  y: _y
                })
              } else {
                _tmpDraw.ways[_lastWayIndex]={
                  x: _x,
                  y: _y
                }
              }
              // samoPadIns?.setTmpDraw(_tmpDraw, true)
            }
            if (_btnVal === 3){
              samoPadIns?.dragMove(e);
            }
          },
          upFn: (e, params) => {
            const _btnVal = e.which;
            // console.log(params)
            if (_btnVal === 1) {
              if (samoPadIns?.detectIsDBClick(e.timeStamp)) {
                let _tmpDraw = samoPadIns?.getTmpDraw()
                
                if (_tmpDraw) {
                  let _lastWayPoint = _tmpDraw.ways.pop()
                  _tmpDraw.uuid = samoPad.generateUUID()
                  _closeGap = _closeGap / _zoomSizeObj.current
                  if (_tmpDraw.ways.length>=3 && _tmpDraw.x-_closeGap <= _lastWayPoint.x && _tmpDraw.x+_closeGap >= _lastWayPoint.x && _tmpDraw.y-_closeGap <= _lastWayPoint.y && _tmpDraw.y+_closeGap >= _lastWayPoint.y){
                    _tmpDraw.closed = true;
                    _tmpDraw.ways.pop()
                  }
                  // _tmpDraw.label = params.label
                  samoPadIns?.addDrawData(_tmpDraw)
                }
                samoPadIns?.setDrawType('pointer')
                samoPadIns?.setTmpDraw(null)
                // console.log(JSON.stringify(samoPadIns?.exportDrawsData()?.filter(item=>item.type==='polygon')?.[0]))
              } else {
                // console.log(`single click-----`)
                _downPoint = {
                  x: e.offsetX,
                  y: e.offsetY,
                }
                _dragOffset = samoPadIns?.getDragOffset()
                _zoomSizeObj = samoPadIns?.getZoomSize()
                let _x = (_downPoint.x-_dragOffset.x)/_zoomSizeObj.current
                let _y = (_downPoint.y-_dragOffset.y)/_zoomSizeObj.current
                
                let _tmpDraw = samoPadIns?.getTmpDraw()
                if(!_tmpDraw){
                  samoPadIns?.setTmpDraw({
                    x: _x,
                    y: _y,
                    ways: [],
                    type: 'polygon',
                    drawName: 'polygon',
                    strokeStyle: 'blue',
                    fillStyle: 'red',
                    lineCap: 'square',
                    lineJoin: 'round',
                    lineWidth: 5,
                    ...params,
                  }, true)
                  _lastWayIndex = 0
                } else {
                  _lastWayIndex = _tmpDraw?.ways?.length??0
                  _tmpDraw.ways[_lastWayIndex]={
                    x: _x,
                    y: _y
                  }
                  // samoPadIns?.setTmpDraw(_tmpDraw, true)
                }
              }
              // console.log(params)
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