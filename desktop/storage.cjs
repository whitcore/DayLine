const fs=require('node:fs');const path=require('node:path');
const {initialState,validateState}=require('./model.cjs');
class Storage {
 constructor(dir) {
  fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'dayline.json');this.warning='';this.dirty=false;
  try{this.data=validateState(JSON.parse(fs.readFileSync(this.file,'utf8')));}
  catch(error){if(error.code==='ENOENT')this.data=initialState();else{try{this.data=validateState(JSON.parse(fs.readFileSync(this.file+'.bak','utf8')));this.warning='Восстановлена резервная копия данных.';}catch{throw Error('Файл данных повреждён. Сохрани dayline.json и dayline.json.bak перед восстановлением.');}}}
 }
 save() {
  if(!this.dirty)return;
  const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data),'utf8');
  if(fs.existsSync(this.file)&&!this.warning)fs.copyFileSync(this.file,this.file+'.bak');
  fs.renameSync(tmp,this.file);this.dirty=false;
 }
}
module.exports={Storage};
