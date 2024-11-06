export default function rectDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        let _lBtnPressing = false
        return {
            type: 'rect', // 重要标识
            downFn: (e) => {
              const _btnVal = e.which;
              if (_btnVal === 3){
                // console.log(`鼠标右键`)
                samoPadIns?.setCursor('grabbing');
                samoPadIns?.dragDown(e)
              }
              if (_btnVal === 1) {
              //   console.log(this.#dragOffset)
                _lBtnPressing = true;
                samoPadIns?.setTmpDraw({
                  x: e.offsetX,
                  y: e.offsetY,
                  type: 'rect',
                  drawName: 'rect',
                  strokeStyle: 'blue',
                  label:{
                    content: 'abc'
                  },
                  // fillStyle: 'blue',
                  lineWidth: 2
                })
              }
            },
            moveFn: (e) => {
              samoPadIns?.setCursor('crosshair');
              const _btnVal = e.which;
              if (_btnVal === 1) {
                if (_lBtnPressing) {
                  samoPadIns?.setTmpDraw({
                    x: e.offsetX,
                    y: e.offsetY,
                    type: 'rect',
                    drawName: 'rect',
                    strokeStyle: 'blue',
                    // fillStyle: 'green',
                    lineWidth: 2
                  })
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
                  const _tmpDraw = samoPadIns?.getTmpDraw()
                  // console.log(_tmpDraw)
                  
                  if (_tmpDraw){
                    if (Math.abs(_tmpDraw.width) > 10 && Math.abs(_tmpDraw.height) > 10){
                      samoPadIns?.addDrawData(_tmpDraw)
                      samoPadIns?.setDrawType('pointer')
                    }
                    samoPadIns?.setTmpDraw(null)
                  }
                }
              }
              if (_btnVal === 3){
                // console.log(`鼠标右键`)
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