import { esc, mountFaq } from '../ui.js';
import { bootHero3D } from '../hero-boot.js';
import { state } from '../store.js';

/* Shared field artwork helpers used by the existing Fields routes. */
const FIELD_ART = {
  robotics: '/assets/art/field-robotics',
  science: '/assets/art/field-science',
  engineering: '/assets/art/field-engineering',
  technology: '/assets/art/field-technology',
};
export const fieldArt = (id) => FIELD_ART[id] || '/assets/art/hero';
export function artPicture(base, { width, height, eager = false, className = '' } = {}) {
  const root = String(base).replace(/\.[a-z0-9]+$/i, '');
  return `<picture${className ? ` class="${className}"` : ''}>
    <source media="(max-width: 640px)" type="image/webp" srcset="${root}-sm.webp">
    <source media="(max-width: 640px)" srcset="${root}-sm.png">
    <source type="image/webp" srcset="${root}.webp">
    <img src="${root}-sm.png" alt="" width="${width || 880}" height="${height || 660}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
  </picture>`;
}


const pad=n=>String(n).padStart(2,'0');
function logoMark(site){
  const dark=site.logoMarkDarkUrl||'/assets/pmrs-logo-dark.jpg';
  const light=site.logoMarkLightUrl||'/assets/pmrs-logo-light.jpg';
  return '<span class="pmrs-logo-crop target-logo__mark" aria-hidden="true"><img class="pmrs-logo-dark" src="'+esc(dark)+'" alt="" width="1536" height="1536"><img class="pmrs-logo-light" src="'+esc(light)+'" alt="" width="1536" height="1536"></span>';
}
function fieldCard(category,index){
  const media=category.imageUrl
    ? '<img class="target-card__image" src="'+esc(category.imageUrl)+'" alt="'+esc(category.name)+'" width="880" height="660" loading="lazy" decoding="async">'
    : artPicture(fieldArt(category.id),{width:320,height:320});
  return '<a class="target-card" href="#/fields/'+esc(category.id)+'" data-link><span class="target-card__num">'+pad(index+1)+'</span>'+media+'<h3>'+esc(category.name)+'</h3><span class="target-card__go" aria-hidden="true">↗</span></a>';
}
function journalCard(article){
  return '<a class="target-journal-card" href="#/journal/'+esc(article.slug)+'" data-link><span class="lab">'+esc(article.label)+' · '+article.readMinutes+' MIN READ</span><h3>'+esc(article.title)+'</h3><p>'+esc(article.excerpt)+'</p><span class="target-card__go" aria-hidden="true">↗</span></a>';
}
function headline(value){
  const words=esc(value||'Build something the future needs.').split(' ');
  if(words.length<3)return words.join(' ');
  return words.slice(0,2).join(' ')+' <span>'+words.slice(2,-1).join(' ')+' <em>'+words[words.length-1]+'</em></span>';
}
export function homePage(){
  const content=state.content||{},student=state.student,admin=state.admin,site=content.site||{},event=content.event||{},registration=content.registration||{};
  const categories=content.categories||[],articles=(content.articles||[]).slice(0,3),faqs=(content.faqs||[]).slice(0,5),counts=content.counts||{},contact=content.contact||{},socials=content.socials||[];
  const deadline=registration.deadlineLabel||'Teams of two to six',href=student?'#/dashboard':registration.open===false?'#/contact':'#/register',label=student?'Open my dashboard':registration.open===false?'Registration details':'Register your team';
  const stats=[{value:event.dateLabel||'To be announced',label:'Date'},{value:event.venue||'To be announced',label:'Venue'},{value:registration.open===false?'Registration closed':deadline,label:'Teams'}];
  const notice=(content.announcements||[]).find(a=>a.isActive!==false);
  const navAction=student?'<a class="target-btn target-btn--outline target-btn--small" href="#/dashboard" data-link>Dashboard</a>':admin?'<a class="target-btn target-btn--outline target-btn--small" href="#/admin/overview" data-link>Admin</a>':'<a class="target-btn target-btn--outline target-btn--small target-hide-mobile" href="#/login" data-link>Sign in</a>';
  const registerAction=student||admin?'':'<a class="target-btn target-btn--primary target-btn--small" href="#/register" data-link>Register <b>↗</b></a>';
  const statsHtml=stats.map(s=>'<div><strong>'+esc(s.value)+'</strong><span class="lab">'+esc(s.label)+'</span></div>').join('');
  const faqHtml=faqs.map((f,i)=>'<div class="faq__item"><button class="faq__q" data-faq-trigger aria-expanded="false" aria-controls="target-faq-'+i+'"><span>'+esc(f.question)+'</span><span class="faq__icon" aria-hidden="true">+</span></button><div class="faq__a" id="target-faq-'+i+'" role="region"><div>'+esc(f.answer)+'</div></div></div>').join('');
  const socialsHtml=socials.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label||s.handle||s.platform)+' ↗</a>').join('');
  return '<div class="view pmrs-target-home">'+
    '<nav class="target-nav" aria-label="Primary navigation"><div class="target-wrap target-nav__inner">'+
    '<a class="target-logo" href="#/" data-link>'+logoMark(site)+'<span class="target-logo__name">'+esc(site.name||'PMRSDC')+'</span><small>'+esc([site.campusName||'Dalazak Campus',site.tagline].filter(Boolean).join(' · '))+'</small></a>'+
    '<div class="target-links"><a href="#fields" data-scroll>Fields</a><a href="#journal" data-scroll>Journal</a><a href="#about" data-scroll>About</a><a href="#contact" data-scroll>Contact</a></div>'+
    '<div class="target-nav__actions"><button class="theme-toggle target-theme" type="button" data-theme-toggle aria-label="Switch theme"><span aria-hidden="true">◐</span></button>'+navAction+registerAction+'<button class="target-menu-toggle" type="button" data-target-menu-toggle aria-expanded="false" aria-controls="target-mobile-menu" aria-label="Open menu"><span></span><span></span></button></div></div><div class="target-mobile-menu" id="target-mobile-menu" hidden><a href="#fields" data-scroll>Fields</a><a href="#journal" data-scroll>Journal</a><a href="#about" data-scroll>About</a><a href="#contact" data-scroll>Contact</a><a href="#/login" data-link>Sign in</a></div></nav>'+
    '<section class="target-stage" id="top" data-hero-stage><div class="target-sticky">'+
    '<canvas class="target-canvas" data-hero-canvas hidden aria-label="Interactive glass robotics module that opens into its circuit core as you scroll" role="img"></canvas>'+
    '<div class="target-hero"><div class="target-wrap"><div class="target-hero__copy" data-hero-copy><span class="lab">[ '+esc((event.kicker||'Season 04').toUpperCase())+' — 2026 · '+esc((event.city||'PESHAWAR, PAKISTAN').toUpperCase())+' ]</span>'+
    '<h1>'+headline(event.headline)+'</h1><p>'+esc(event.intro||'One day. Four fields. Hundreds of students presenting the work they made when nobody told them what to make. PMRS is where school science stops being a worksheet and becomes a public exhibition.')+'</p>'+
    '<div class="target-cta"><a class="target-btn target-btn--primary" href="'+href+'" data-link>'+esc(label)+' <b>↗</b></a><a class="target-btn target-btn--outline" href="#fields" data-scroll>Explore the fields</a></div></div></div></div>'+
    '<div class="target-side lab">Robotics<br>AI &amp; Vision<br>Sensors<br>Engineering</div>'+
    categories.slice(0,4).map((category,index)=>'<div class="target-call" data-hero-call><div><b>'+esc(category.name)+'</b><small>Field '+pad(index+1)+'</small></div></div>').join('')+'<div class="target-count lab"><span>01 / 04</span></div></div></section>'+
    (notice?'<aside class="target-notice" aria-label="Announcement"><div class="target-wrap"><span class="lab">'+(notice.level==='important'?'IMPORTANT':'NOTICE')+'</span><p><b>'+esc(notice.title)+'</b>'+(notice.body?' — '+esc(notice.body):'')+'</p>'+(notice.linkUrl?'<a href="'+esc(notice.linkUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(notice.linkLabel||'Read more')+' ↗</a>':'')+'<button type="button" data-dismiss-notice aria-label="Dismiss announcement">×</button></div></aside>':'')+
    '<section class="target-paper" id="about"><div class="target-wrap target-paper__grid"><div><span class="lab">[ The exhibition ]</span><h2>A working <em>exhibition.</em></h2></div><div class="target-stats">'+statsHtml+'</div></div></section>'+
    '<section class="target-fields" id="fields"><div class="target-wrap"><div class="target-section-head"><h2>Four ways to enter.<br><span>One exhibition floor.</span></h2><p>Every team presents in exactly one field. Choose the one that matches the work you actually built, not the one that sounds most impressive.</p></div><div class="target-card-grid">'+categories.map(fieldCard).join('')+'</div></div></section>'+
    '<section class="target-process" id="process"><div class="target-wrap"><span class="lab">[ How it works ]</span><h2>Teams register in minutes.</h2><div class="target-steps">'+
    '<article><span class="lab">01</span><h3>Create your account</h3><p>Name, class, school, one field of entry. About forty seconds, and you can edit all of it later.</p></article>'+
    '<article><span class="lab">02</span><h3>Start or join a team</h3><p>Leaders create a team, set its size and share the passcode. Everyone else joins with that code — same school, same field.</p></article>'+
    '<article><span class="lab">03</span><h3>Build, then present</h3><p>Prepare the object and a two-minute explanation. Judges visit every booth and leave written feedback.</p></article></div></div></section>'+
    '<section class="target-journal" id="journal"><div class="target-wrap"><div class="target-section-head"><h2>Field notes for<br><span>first-time exhibitors.</span></h2><a href="#/journal" class="target-text-link" data-link>All writing ↗</a></div><div class="target-journal-grid">'+(articles.length?articles.map(journalCard).join(''):'<p class="lab">New field notes will be published here.</p>')+'</div></div></section>'+
    (faqs.length?'<section class="target-faq"><div class="target-wrap target-faq__grid"><div><span class="lab">[ Questions ]</span><h2>Good to know.</h2></div><div class="faq" data-faq>'+faqHtml+'</div></div></section>':'')+
    '<section class="target-end" id="register"><div class="target-wrap"><span class="lab">[ Season 04 ]</span><h2>'+(registration.open===false?'The next exhibition starts here.':'Bring the thing you made.')+'</h2><p>'+esc(registration.open===false?(registration.closedMessage||'Contact the coordination desk to learn when the next season opens.'):'Teams register in minutes. You keep control of your profile, your team and your field — and you can change all of it from your dashboard.')+'</p><a class="target-btn target-btn--primary" href="'+href+'" data-link>'+esc(label)+' <b>↗</b></a></div></section>'+
    '<footer class="target-footer" id="contact"><div class="target-wrap"><a class="target-logo" href="#/" data-link>'+logoMark(site)+'<span class="target-logo__name">'+esc(site.name||'PMRSDC')+'</span><small>'+esc(site.campusName||'Dalazak Campus')+'</small></a><span>'+esc(site.fullName||'Peshawar Model Robotics Society — Dalazak Campus')+'</span><span>'+esc(contact.address||event.city||'Peshawar, Pakistan')+'</span><div class="target-footer__links">'+(contact.email?'<a href="mailto:'+esc(contact.email)+'">'+esc(contact.email)+'</a>':'')+socialsHtml+'</div></div></footer>'+
    '</div>';
}
export function mountHome(root){
  mountFaq(root);
  bootHero3D();
  root.querySelectorAll('[data-scroll]').forEach(link=>link.addEventListener('click',event=>{
    const id=link.getAttribute('href')?.slice(1),target=id&&root.querySelector('#'+CSS.escape(id));
    if(!target)return;
    event.preventDefault();
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }));
  const close=root.querySelector('[data-dismiss-notice]');
  close?.addEventListener('click',()=>close.closest('.target-notice')?.remove());
  const menuButton=root.querySelector('[data-target-menu-toggle]');
  const menu=root.querySelector('#target-mobile-menu');
  menuButton?.addEventListener('click',()=>{
    const open=menuButton.getAttribute('aria-expanded')==='true';
    menuButton.setAttribute('aria-expanded',String(!open));
    menuButton.setAttribute('aria-label',open?'Open menu':'Close menu');
    if(menu)menu.hidden=open;
  });
  menu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    if(menu)menu.hidden=true;
    menuButton?.setAttribute('aria-expanded','false');
    menuButton?.setAttribute('aria-label','Open menu');
  }));
}
