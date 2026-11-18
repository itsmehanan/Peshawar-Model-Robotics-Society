import { esc, mountFaq } from '../ui.js';
import { bootHero3D } from '../hero-boot.js';
import { state } from '../store.js';

const pad=n=>String(n).padStart(2,'0');
function fieldCard(category,index){
  const key=['robotics','science','engineering','technology'].includes(category.id)?category.id:'technology';
  return '<a class="target-card" href="#/fields/'+esc(category.id)+'" data-link><span class="target-card__num">'+pad(index+1)+'</span><img data-k="'+key+'" alt="'+esc(category.name)+' visual" width="320" height="320" loading="lazy"><h3>'+esc(category.name)+'</h3><span class="target-card__go" aria-hidden="true">↗</span></a>';
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
  const {content,student,admin}=state,site=content.site||{},event=content.event||{},registration=content.registration||{};
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
    '<a class="target-logo" href="#/" data-link><i aria-hidden="true"></i> '+esc(site.name||'PMRS')+' <span>2026</span></a>'+
    '<div class="target-links"><a href="#fields" data-scroll>Fields</a><a href="#journal" data-scroll>Journal</a><a href="#about" data-scroll>About</a><a href="#contact" data-scroll>Contact</a></div>'+
    '<div class="target-nav__actions"><button class="theme-toggle target-theme" type="button" data-theme-toggle aria-label="Switch theme"><span aria-hidden="true">◐</span></button>'+navAction+registerAction+'</div></div></nav>'+
    '<section class="target-stage" id="top" data-hero-stage><div class="target-sticky">'+
    '<canvas class="target-canvas" data-hero-canvas aria-label="Glass and metal robotics module, rotating and separating into layers as you scroll" role="img"></canvas>'+
    '<div class="target-hero"><div class="target-wrap"><div class="target-hero__copy" data-hero-copy><span class="lab">[ '+esc((event.kicker||'Season 04').toUpperCase())+' — 2026 · '+esc((event.city||'PESHAWAR, PAKISTAN').toUpperCase())+' ]</span>'+
    '<h1>'+headline(event.headline)+'</h1><p>'+esc(event.intro||'One day. Four fields. Hundreds of students presenting the work they made when nobody told them what to make. PMRS is where school science stops being a worksheet and becomes a public exhibition.')+'</p>'+
    '<div class="target-cta"><a class="target-btn target-btn--primary" href="'+href+'" data-link>'+esc(label)+' <b>↗</b></a><a class="target-btn target-btn--outline" href="#fields" data-scroll>Explore the fields</a></div></div></div></div>'+
    '<div class="target-side lab">Robotics<br>AI &amp; Vision<br>Sensors<br>Engineering</div>'+
    '<div class="target-call" data-hero-call><div><b>Robotics &amp; AI</b><small>Field 01</small></div></div><div class="target-call" data-hero-call><div><b>Engineering &amp; Design</b><small>Field 03</small></div></div><div class="target-call" data-hero-call><div><b>Future Technology</b><small>Field 04</small></div></div><div class="target-count lab"><span>01 / 04</span></div></div></section>'+
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
    '<footer class="target-footer" id="contact"><div class="target-wrap"><a class="target-logo" href="#/" data-link><i aria-hidden="true"></i> '+esc(site.name||'PMRS')+' <span>2026</span></a><span>'+esc(site.fullName||'Peshawar Model Robotics Society')+'</span><span>'+esc(contact.address||event.city||'Peshawar, Pakistan')+'</span><div class="target-footer__links">'+(contact.email?'<a href="mailto:'+esc(contact.email)+'">'+esc(contact.email)+'</a>':'')+socialsHtml+'</div></div></footer>'+
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
}
