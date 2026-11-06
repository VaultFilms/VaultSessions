"use strict";
(function(root){
 function clean(records){
  if(!Array.isArray(records))return [];
  let budget=900000;
  return records.slice(-60).filter(record=>record&&['inspection','summary','handoff'].includes(record.kind)&&typeof record.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(record.id)&&typeof record.date==='string'&&Number.isFinite(Date.parse(record.date))&&typeof record.text==='string'&&record.text.length<=60000).reverse().flatMap(record=>{
   const copy={id:record.id,kind:record.kind,date:record.date,title:typeof record.title==='string'?record.title.slice(0,160):'',speaker:['ChatGPT','Gemini','Claude'].includes(record.speaker)?record.speaker:'Inspector',text:record.text};
   if(copy.kind==='inspection'){
    if(Array.isArray(record.sharedWith))copy.sharedWith=record.sharedWith.filter(name=>['ChatGPT','Gemini','Claude'].includes(name));
    if(Array.isArray(record.shareErrors))copy.shareErrors=record.shareErrors.filter(value=>typeof value==='string').slice(0,3).map(value=>value.slice(0,1000));
    try{const report=JSON.parse(copy.text);if(report.schema!==1||!['chatgpt','gemini','claude'].includes(report.provider)||!report.state||typeof report.state.phase!=='string'||typeof report.state.visibility!=='string'||!Array.isArray(report.checks)||report.checks.length>100||report.checks.some(check=>typeof check.name!=='string'||typeof check.selector!=='string'||!Number.isInteger(check.matches)||check.matches<0||!Array.isArray(check.elements)||(check.elements||[]).some(element=>typeof element.html!=='string')))return [];}catch{return [];}
   }
   const size=JSON.stringify(copy).length;if(size>budget)return [];budget-=size;return [copy];
  }).reverse();
 }
 const api={clean};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VaultDocumentRecords=api;
})(globalThis);
