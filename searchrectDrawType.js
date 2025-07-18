export default function searchrectDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        let _lBtnPressing = false
        return {
            type: 'searchrect', // 重要标识
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
                  drawName: 'searchrect',
                  strokeStyle: 'rgba(187, 224, 255, 0.4)',
                  // label:{
                  //   content: 'abc'
                  // },
                  fillStyle: 'rgba(187, 224, 255, 0.4)',
                  lineWidth: 1,
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