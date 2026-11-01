'use strict';
(()=>{
 const preference=window.matchMedia('(prefers-color-scheme: dark)');
 const apply=()=>{document.documentElement.dataset.theme=preference.matches?'dark':'light';};
 apply();
 if(preference.addEventListener)preference.addEventListener('change',apply);
 else preference.addListener(apply);
})();
