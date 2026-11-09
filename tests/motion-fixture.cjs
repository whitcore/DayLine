const {initialState,addInterval}=require('../desktop/model.cjs');
function motionFixture(){
 const state=initialState();state.settings.idleMinutes=0;
 state.apps={'code.exe':{exe:'Code.exe',name:'Visual Studio Code',category:'focus'},'firefox.exe':{exe:'firefox.exe',name:'Firefox',category:'neutral'},'telegram.exe':{exe:'Telegram.exe',name:'Telegram',category:'neutral'},'hades.exe':{exe:'Hades.exe',name:'Hades II',category:'rest'}};
 const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);d.setHours(9,0,0,0);let cursor=d.getTime();const lengths=[(95+i*19)*60000,47*60000,29*60000,(40+i*6)*60000];if(i===0){const midnight=new Date(now);midnight.setHours(0,0,0,0);const budget=Math.max(1,Math.min(135*60000,now-midnight-500));cursor=now.getTime()-budget-50;const sum=lengths.reduce((a,b)=>a+b,0);for(let k=0;k<lengths.length;k++)lengths[k]=lengths[k]/sum*budget;}Object.keys(state.apps).forEach((appId,k)=>{addInterval(state,{appId,start:cursor,end:cursor+lengths[k]});cursor+=lengths[k];});}
 return state;
}
module.exports={motionFixture};
