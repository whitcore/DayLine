class Tracker {
 constructor({onInterval,idleMinutes=3}) {this.onInterval=onInterval;this.idleMinutes=idleMinutes;this.last=null;this.paused=false;}
 reset(){this.last=null;}
 sample(current,wall=Date.now(),mono=performance.now()) {
  const previous=this.last;this.last={current,wall,mono};
  if(this.paused||!previous||current.locked||previous.current.locked||!previous.current.exe)return;
  const delta=mono-previous.mono;
  if(delta<=0||delta>5000||Math.abs(wall-previous.wall-delta)>5000)return;
  const allowed=this.idleMinutes===0?delta:Math.max(0,Math.min(delta,this.idleMinutes*60000-(current.idleMs-delta)));
  if(allowed>0)this.onInterval({appId:previous.current.exe.toLowerCase(),start:previous.wall,end:previous.wall+allowed,...(previous.current.domain?{domain:previous.current.domain}:{})});
 }
}
module.exports={Tracker};
