'use strict';
// Local interactions for the reference layout; shop data comes from the PHP API.
const heroSlides=[...document.querySelectorAll('[data-hero-slide]')];
const heroDots=[...document.querySelectorAll('[data-hero]')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroConfig=document.querySelector('.campaign-hero');
let heroIndex=0, heroPaused=reducedMotion||heroConfig?.dataset.autoplay==='false';
function changeHero(index){
 heroIndex=index;
 heroSlides.forEach((slide,i)=>{
  const active=i===index;slide.classList.toggle('is-active',active);slide.inert=!active;
  const video=slide.querySelector('video');
  if(video){if(active&&!heroPaused) video.play().catch(()=>{});else video.pause();}
 });
 heroDots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===index)));
}
heroDots.forEach(dot=>dot.addEventListener('click',()=>changeHero(Number(dot.dataset.hero))));
document.getElementById('hero-pause').addEventListener('click',event=>{
 heroPaused=!heroPaused;event.currentTarget.textContent=heroPaused?'▶':'Ⅱ';
 event.currentTarget.setAttribute('aria-label',heroPaused?'Reproducir banner':'Pausar banner');changeHero(heroIndex);
});
if(heroPaused){heroSlides[0]?.querySelector('video')?.pause();document.getElementById('hero-pause').textContent='▶';document.getElementById('hero-pause').setAttribute('aria-label','Reproducir banner');}
setInterval(()=>{if(!heroPaused&&!document.hidden&&heroSlides.length>1)changeHero((heroIndex+1)%heroSlides.length);},Number(heroConfig?.dataset.interval||8)*1000);
const header=document.getElementById('site-header');
document.querySelectorAll('.logo,.footer-logo').forEach(logo=>logo.addEventListener('click',event=>{
 if(location.pathname==='/'){
  event.preventDefault();document.body.classList.remove('mobile-nav-open');
  document.getElementById('menu-button').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'instant'});
 }
}));
function headerScroll(){header.classList.toggle('scrolled',window.scrollY>80);}
window.addEventListener('scroll',headerScroll,{passive:true});headerScroll();
document.querySelectorAll('.nav-dropdown').forEach(dropdown=>dropdown.addEventListener('toggle',()=>{
 if(dropdown.open)document.querySelectorAll('.nav-dropdown').forEach(other=>{if(other!==dropdown)other.open=false;});
}));
document.addEventListener('click',event=>{
 const sectionLink=event.target.closest('[data-section-target]');
 if(sectionLink){event.preventDefault();const dest=document.getElementById(sectionLink.dataset.sectionTarget);(dest&&dest.offsetHeight?dest:document.getElementById('catalogo')).scrollIntoView({behavior:reducedMotion?'instant':'smooth'});document.body.classList.remove('mobile-nav-open');}
 if(!event.target.closest('.nav-dropdown'))document.querySelectorAll('.nav-dropdown').forEach(dropdown=>dropdown.open=false);
 const button=event.target.closest('[data-scroll-track]');
 if(button){const track=document.getElementById(button.dataset.scrollTrack);track.scrollBy({left:track.clientWidth*.8*Number(button.dataset.direction),behavior:reducedMotion?'instant':'smooth'});}
});
function carousel(track,prev,next){
 if(!track||!prev||!next)return;
 const step=()=>track.clientWidth*.8;
 prev.addEventListener('click',()=>track.scrollBy({left:-step(),behavior:'smooth'}));
 next.addEventListener('click',()=>track.scrollBy({left:step(),behavior:'smooth'}));
 const state=()=>{prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-2;};
 track.addEventListener('scroll',state,{passive:true});new ResizeObserver(state).observe(track);state();
}
carousel(document.querySelector('[data-mag-track]'),document.querySelector('[data-mag-prev]'),document.querySelector('[data-mag-next]'));
carousel(document.querySelector('[data-static-collection-carousel] .cc-static-list'),document.querySelector('[data-cc-static-prev]'),document.querySelector('[data-cc-static-next]'));
const filmObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
 const video=entry.target.querySelector('video'),button=entry.target.querySelector('.film-play');
 if(entry.isIntersecting&&!reducedMotion&&!entry.target.dataset.paused){video.play().then(()=>{button.textContent='Ⅱ';button.setAttribute('aria-label','Pausar video');}).catch(()=>{});}
 else{video.pause();button.textContent='▶';}
}),{threshold:.6});
document.querySelectorAll('.film-card').forEach(card=>{
 filmObserver.observe(card);
 card.querySelector('.film-play').addEventListener('click',event=>{
  const video=card.querySelector('video'),button=event.currentTarget;
  if(video.paused){delete card.dataset.paused;video.play().then(()=>{button.textContent='Ⅱ';button.setAttribute('aria-label','Pausar video');}).catch(()=>{});}
  else{card.dataset.paused='true';video.pause();event.currentTarget.textContent='▶';event.currentTarget.setAttribute('aria-label','Reproducir video');}
 });
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)document.querySelectorAll('video').forEach(video=>video.pause());
 else changeHero(heroIndex);
});
