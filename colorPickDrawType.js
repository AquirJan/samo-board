export default function colorPickerDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        let _lBtnPressing = false
        // let _mousePressing = false;
        return {
            type: 'colorPicker', // 重要标识
            downFn: (e, params) => {
              const _btnVal = e.which;
              if (_btnVal === 3){
                // console.log(`鼠标右键`)
                samoPadIns?.setCursor('grabbing');
                samoPadIns?.dragDown(e)
              }
              if (_btnVal === 1) {
                _lBtnPressing = true;
              }
            },
            moveFn: (e, params) => {
              samoPadIns?.setCursor('crosshair');
              const _btnVal = e.which;
              if (_btnVal === 1) {
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
                  const pixelData = samoPadIns.ctx.getImageData(e.offsetX, e.offsetY, 1, 1).data
                  // console.log(pixelData)
                  const _pixel = {
                    r: pixelData[0],
                    g: pixelData[1],
                    b: pixelData[2],
                    a: pixelData[3],
                  }
                  
                  // samoPadIns.canvas.dispatchEvent(
                  //   new CustomEvent('colorPickerUp', {
                  //     bubbles: true,
                  //     detail: {
                  //       pixel: _pixel,
                  //     }
                  //   })
                  // );
                  return {pixel:_pixel}
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