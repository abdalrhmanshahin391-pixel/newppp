/**
 * The owner's choice (Nov 2026): Uzyra always moves. The site's look depends on its motion, so a
 * device's "reduce motion" setting (Windows "Animation effects" off, Android "Remove animations",
 * battery savers) and Chrome's Data Saver no longer stop the cube, the fields, the films or the
 * videos. This runs in <head> before the app:
 * - `matchMedia("(prefers-reduced-motion: reduce)")` answers "no"; "no-preference" answers "yes";
 * - `navigator.connection.saveData` reads false;
 * - CSS `@media (prefers-reduced-motion: reduce)` blocks are removed and "no-preference" blocks
 *   always apply, in every stylesheet, including ones added later (route CSS, injected styles).
 */
export const alwaysMotionBootScript = `(function(){
var RM=/prefers-reduced-motion/i,RED=/prefers-reduced-motion\\s*:\\s*reduce/i;
try{var orig=window.matchMedia&&window.matchMedia.bind(window);if(orig){window.matchMedia=function(q){var s=String(q);if(!RM.test(s))return orig(q);var on=!RED.test(s);if(/^\\s*not\\b/i.test(s))on=!on;var n=function(){};return{matches:on,media:s,onchange:null,addListener:n,removeListener:n,addEventListener:n,removeEventListener:n,dispatchEvent:function(){return false}}}}}catch(_){}
try{var c=navigator.connection;if(c&&c.saveData)Object.defineProperty(c,'saveData',{configurable:true,get:function(){return false}})}catch(_){}
function strip(owner,list){for(var i=list.length-1;i>=0;i--){var r=list[i];try{var t=r.media?r.media.mediaText:(r.conditionText||'');if(t&&RM.test(t)){if(RED.test(t)){owner.deleteRule(i);continue}r.media.mediaText='all'}if(r.cssRules&&r.cssRules.length)strip(r,r.cssRules)}catch(_){}}}
function scan(){var s=document.styleSheets;for(var i=0;i<s.length;i++){try{var rules=s[i].cssRules;if(rules)strip(s[i],rules)}catch(_){}}}
var queued=0;function later(){if(queued)return;queued=1;(window.requestAnimationFrame||setTimeout)(function(){queued=0;scan()})}
scan();document.addEventListener('DOMContentLoaded',scan);window.addEventListener('load',scan);
try{new MutationObserver(function(m){for(var i=0;i<m.length;i++){var a=m[i].addedNodes;for(var j=0;j<a.length;j++){var el=a[j];if(el.nodeName==='LINK'){el.addEventListener('load',later)}if(el.nodeName==='STYLE'||el.nodeName==='LINK')later()}if(m[i].type==='characterData'||m[i].target.nodeName==='STYLE')later()}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true})}catch(_){}
})();`;
