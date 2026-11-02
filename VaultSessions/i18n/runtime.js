'use strict';
(function(root){
 const catalogs=new Map();let locale='en',patterns=[];
 const translatedParameters={message_053:['0'],message_046:['1'],message_086:['1']};
 let requested=null,manual=null,initialized=false;
 try{requested=new URLSearchParams(location.search).get('ui');}catch{}
 // Older versions also saved automatic initialization as a preference. Only new explicit choices override browser detection.
 try{manual=localStorage.getItem('vaultsessions.locale.manual');}catch{}
 const browserLanguages=Array.isArray(root.navigator?.languages)&&root.navigator.languages.length?root.navigator.languages:[root.navigator?.language||'en'];
 function supported(code){
  if(typeof code!=='string')return null;
  const normalized=code.replace(/_/g,'-').toLowerCase();
  return [...catalogs.keys()].find(key=>key.toLowerCase()===normalized)
    || [...catalogs.keys()].find(key=>key.toLowerCase()===normalized.split('-')[0])||null;
 }
 function initialLocale(){
  return supported(requested)||supported(manual)||browserLanguages.map(supported).find(Boolean)||'en';
 }
 const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const format=(text,args={})=>text.replace(/\{([\w]+)\}/g,(match,key)=>Object.hasOwn(args,key)?String(args[key]):match);
 function t(key,args={}){
  const source=catalogs.get(locale)?.messages[key]!==undefined?locale:'en';
  const catalog=catalogs.get(source);let template=catalog?.messages[key]??key;
  for(const rule of catalog?.plurals?.[key]||[]){
   const category=new Intl.PluralRules(source).select(Number(args[rule.count]));
   template=template.replace(rule.other,rule[category]??rule.other);
  }
  return format(template,args);
 }
 function templates(catalog,key,value){
  let values=[value];
  for(const rule of catalog.plurals?.[key]||[]){values=values.flatMap(template=>[...new Set(Object.entries(rule).filter(([category])=>category!=='count').map(([,phrase])=>template.replace(rule.other,phrase)))]);}
  return [...new Set(values)];
 }
 function buildPatterns(){
  patterns=[];for(const code of catalogs.keys())for(const [key,value]of Object.entries(catalogs.get(code)?.messages||{})){
   if(typeof value!=='string')continue;for(const template of templates(catalogs.get(code),key,value)){const names=[];let last=0,source='';
   for(const match of template.matchAll(/\{([\w]+)\}/g)){source+=escape(template.slice(last,match.index))+'([\\s\\S]*?)';names.push(match[1]);last=match.index+match[0].length;}
   source+=escape(template.slice(last));patterns.push({key,value:template,names,regex:new RegExp('^'+source+'$')});}
  }
  patterns.sort((a,b)=>a.names.length-b.names.length||b.value.length-a.value.length);
 }
 function message(text){
  if(typeof text!=='string')return text;
  for(const item of patterns){const match=item.regex.exec(text);if(match){const args={};item.names.forEach((name,index)=>args[name]=translatedParameters[item.key]?.includes(name)?message(match[index+1]):match[index+1]);return t(item.key,args);}}
  return text;
 }
 function apply(scope=document){
  for(const element of scope.querySelectorAll('[data-i18n]'))element.textContent=t(element.dataset.i18n);
  for(const [data,attribute]of [['i18nPlaceholder','placeholder'],['i18nAria','aria-label'],['i18nTitle','title']])for(const element of scope.querySelectorAll('[data-'+data.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']'))element.setAttribute(attribute,t(element.dataset[data]));
 }
 function refreshGenerated(scope=document){
  const selectors='.badge,.card-actions button,.provider-status,.entry-state,.entry header strong,#current-speaker,#discussion-counts,#status,#activity,#switch-view,#reload-extension,#page-material-note,.entry.system .entry-body,#image-items button,#invitations option,#send';
  for(const node of scope.querySelectorAll(selectors)){const before=node.textContent,after=message(before);if(before!==after){if(node.matches('.entry-body')&&root.RoundtableLinks)root.RoundtableLinks.render(node,after);else node.textContent=after;}}
 }
 function setLocale(code,{persist=true}={}){
  initialized=true;
  if(!catalogs.has(code))code='en';locale=code;
  if(typeof document!=='undefined'){document.documentElement.lang=code;apply();refreshGenerated();}
  if(persist)try{localStorage.setItem('vaultsessions.locale',code);localStorage.setItem('vaultsessions.locale.manual',code);}catch{}
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('vaultsessions-language',{detail:{locale:code}}));
 }
 const api={register:(code,catalog)=>{if(!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(code)||!catalog?.messages)throw Error('Invalid locale catalog');catalogs.set(code,catalog);if(!initialized)locale=initialLocale();buildPatterns();},t,message,apply,refreshGenerated,setLocale,get locale(){return catalogs.has(locale)?locale:'en'},get locales(){return [...catalogs].map(([code,data])=>({code,name:data.name,shortName:data.shortName,meetingLanguage:data.meetingLanguage}));}};
 root.VaultI18n=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
