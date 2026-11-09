// Called by the local upgrade script after backing up the user's exact JSON.
// Apply the requested Firefox 50/50 preference once, preserving raw history.
const {Storage}=require('../desktop/storage.cjs');
const {setAllocation}=require('../desktop/model.cjs');
const directory=process.argv[2];if(!directory)throw Error('Profile directory required');
const storage=new Storage(directory);if(storage.warning)throw Error('Profile recovery requires review before updating');
const sessions=JSON.stringify(storage.data.sessions),entries=JSON.stringify(storage.data.entries);
const firefox=storage.data.apps['firefox.exe'];let applied=false;
if(firefox&&!firefox.allocations){setAllocation(storage.data,'firefox.exe',{focus:50,rest:50});applied=true;}
if(JSON.stringify(storage.data.sessions)!==sessions||JSON.stringify(storage.data.entries)!==entries)throw Error('History changed unexpectedly');
storage.dirty=true;storage.save();
console.log(JSON.stringify({firefoxSplitApplied:applied,sessionsPreserved:true,journalPreserved:true}));
