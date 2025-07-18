export default function stepmoveDrawType({samoPadIns, samoPad}={}){
    try {
        if (!samoPad){
            throw new Error('miss samoPad')
        }
        if (!samoPadIns){
            throw new Error('miss samoPadIns')
        }
        return {
            type: 'stepmove', // 重要标识
            downFn: (e, params) => {
              const _btnVal = e.which;
              if (_btnVal === 3){
                // console.log(`鼠标右键`)
                samoPadIns?.setCursor('grabbing');
                samoPadIns?.dragDown(e)
              }
            },
            moveFn: (e, params) => {
              const _btnVal = e.which;
              if (_btnVal === 3){
                // samoPadIns?.setCursor('grabbing');
                samoPadIns?.dragMove(e);
              }
            },
            upFn: (e, params) => {
              const _btnVal = e.which;
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