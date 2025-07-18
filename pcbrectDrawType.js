export default function pcbrectDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        let _lBtnPressing = false
        return {
            type: 'pcb', // 重要标识
            downFn: (e, params) => {
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
                  drawName: 'pcbrect',
                  strokeStyle: 'blue',
                  // label:{
                  //   content: 'abc'
                  // },
                  // fillStyle: 'blue',
                  lineWidth: 2,
                  ...params,
                })
              }
            },
            moveFn: (e, params) => {
              samoPadIns?.setCursor('crosshair');
              const _btnVal = e.which;
              if (_btnVal === 1) {
                if (_lBtnPressing) {
                  samoPadIns?.setTmpDraw({
                    x: e.offsetX,
                    y: e.offsetY,
                    // type: 'rect',
                    // drawName: 'pcbrect',
                    // strokeStyle: 'blue',
                    // fillStyle: 'green',
                    // lineWidth: 2
                  })
                }
              }
              if (_btnVal === 3){
                samoPadIns?.dragMove(e);
              }
            },
            upFn: (e, params) => {
              const _btnVal = e.which;
              if (_btnVal === 1) {
                if (_lBtnPressing) {
                  _lBtnPressing = false;
                  const _tmpDraw = samoPadIns?.getTmpDraw()
                  // console.log(_tmpDraw)
                  // console.log(params)
                  if (_tmpDraw){
                    if (Math.abs(_tmpDraw.width) > 10 && Math.abs(_tmpDraw.height) > 10){
                      // console.log(params?.ext)
                      _tmpDraw['ext'] = params?.ext
                      _tmpDraw['code'] = params?.code
                      const _sort = params?.ext?.sort ?? 0
                      const _type = params?.ext?.type ?? "0"
                      // console.log(`_sort: ${_sort}, _type: ${_type}`)
                      _tmpDraw['lock'] = _type != 0 && _sort == 0
                      samoPadIns?.addDrawData(_tmpDraw)
                      samoPadIns?.setSelectedDraws([_tmpDraw])
                      samoPadIns?.outContainerResetPosition()
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
            outFn: (e, params) => {
              this.upFn(e, params)
            }
        }
    } catch(error){
        return new Error(error?.message)
    }
}