import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function mountHeroScene(canvas,{reducedMotion=false}={}){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(error){throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;

  const envScene=new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(30,30,30),new THREE.MeshBasicMaterial({color:0x05070b,side:THREE.BackSide})));
  function panel(w,h,x,y,z,color,intensity){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);mesh.lookAt(0,0,0);envScene.add(mesh);
  }
  panel(14,5,0,12,4,0x9fc4ff,5);
  panel(5,14,-12,2,3,0xffffff,3);
  panel(4,10,12,0,-4,0xff5a1f,4);
  panel(12,3,0,-9,6,0x6f8fbf,2);
  panel(8,8,0,3,-12,0xffffff,1.5);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const env=pmrem.fromScene(envScene,.02).texture;
  pmrem.dispose();

  const glass=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.06,transmission:1,thickness:.7,ior:1.5,envMap:env,envMapIntensity:1.5,transparent:true,opacity:1,specularIntensity:1});
  const metal=new THREE.MeshStandardMaterial({color:0xb8bcc2,metalness:1,roughness:.25,envMap:env,envMapIntensity:1.3});
  const dark=new THREE.MeshStandardMaterial({color:0x0e1013,metalness:.6,roughness:.45,envMap:env});
  const orange=new THREE.MeshStandardMaterial({color:0xff5a1f,metalness:.1,roughness:.45,envMap:env,envMapIntensity:.8});
  const glow=new THREE.MeshBasicMaterial({color:0x6fd0ff});
  function box(w,h,d,material,x=0,y=0,z=0){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);return mesh;
  }

  const hero=new THREE.Group(),top=new THREE.Group(),mid=new THREE.Group(),bottom=new THREE.Group();
  top.add(box(2.2,.62,2.2,glass));
  bottom.add(box(2.2,.62,2.2,glass));
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x,z])=>{
    top.add(box(.28,.5,.28,orange,x*1.02,-.04,z*1.02));
    bottom.add(box(.28,.5,.28,orange,x*1.02,.04,z*1.02));
  });
  bottom.add(box(1.4,.12,.5,dark,0,-.05,1.1));
  mid.add(box(1.8,.09,1.8,dark));
  mid.add(box(.8,.14,.8,metal,0,.11,0));
  mid.add(box(.5,.06,.5,dark,0,.21,0));
  mid.add(box(.16,.05,.16,glow,.12,.25,.1));
  for(let i=0;i<6;i++){
    mid.add(box(.22,.06,.1,metal,-.7+i*.28,.07,.72));
    mid.add(box(.1,.06,.22,metal,-.74,.07,-.5+i*.2));
  }
  mid.add(box(.4,.1,.4,orange,.55,.08,-.55));
  top.position.y=.62;bottom.position.y=-.62;
  hero.add(top,mid,bottom);hero.rotation.x=.42;

  const scene=new THREE.Scene();scene.add(hero);
  const key=new THREE.DirectionalLight(0xffffff,1.2);key.position.set(3,5,4);scene.add(key);
  const camera=new THREE.PerspectiveCamera(32,1,.1,50);camera.position.set(0,0,9);

  function poster(kind){
    const group=new THREE.Group(),posterScene=new THREE.Scene();
    if(kind==='robotics'){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.2,32,96),metal);group.add(ring);
      const ring2=new THREE.Mesh(new THREE.TorusGeometry(.8,.08,24,96),orange);ring2.rotation.y=1.2;group.add(ring2);
      group.add(new THREE.Mesh(new THREE.SphereGeometry(.62,48,48),glass));
      group.add(new THREE.Mesh(new THREE.SphereGeometry(.28,32,32),glow));
    }else if(kind==='science'){
      group.add(new THREE.Mesh(new THREE.SphereGeometry(.85,64,64),glass));
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.9,48,1,true),glass);neck.position.y=1;group.add(neck);
      const liquid=new THREE.Mesh(new THREE.SphereGeometry(.62,48,48),orange);liquid.position.y=-.12;group.add(liquid);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.3,.05,16,48),metal);rim.rotation.x=Math.PI/2;rim.position.y=1.45;group.add(rim);
    }else if(kind==='engineering'){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.4,48),metal);wheel.rotation.x=Math.PI/2;group.add(wheel);
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2,tooth=box(.3,.34,.4,metal,Math.cos(a)*1.05,Math.sin(a)*1.05,0);tooth.rotation.z=a;group.add(tooth);}
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.46,40),orange);hub.rotation.x=Math.PI/2;group.add(hub);
      const bore=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.5,32),dark);bore.rotation.x=Math.PI/2;group.add(bore);
    }else{
      group.add(box(1.7,.55,1.7,glass));
      group.add(box(1,.16,1,metal,0,-.02,0));
      group.add(box(.5,.18,.5,dark,0,.04,0));
      group.add(box(.1,.04,.1,glow,.1,.15,.1));
      for(let i=0;i<7;i++){const p=-.7+i*.233;group.add(box(.09,.05,.34,orange,p,-.05,1));group.add(box(.09,.05,.34,orange,p,-.05,-1));group.add(box(.34,.05,.09,orange,1,-.05,p));group.add(box(.34,.05,.09,orange,-1,-.05,p));}
    }
    group.rotation.set(.5,-.6,.05);posterScene.add(group);
    const light=new THREE.DirectionalLight(0xffffff,1.1);light.position.set(3,4,5);posterScene.add(light);
    return posterScene;
  }
  function bakePosters(){
    const posterCamera=new THREE.PerspectiveCamera(30,1,.1,50);posterCamera.position.set(0,0,7.2);
    const oldRatio=renderer.getPixelRatio(),oldSize=new THREE.Vector2();renderer.getSize(oldSize);
    renderer.setPixelRatio(1);renderer.setSize(560,560,false);renderer.setClearColor(0x000000,0);
    document.querySelectorAll('.pmrs-target-home img[data-k]').forEach(img=>{
      renderer.render(poster(img.dataset.k),posterCamera);
      try{img.src=canvas.toDataURL('image/png');}catch{}
    });
    renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);renderer.setClearColor(0x000000,0);
  }

  const isAuthScene=!canvas.closest('[data-hero-stage]');
  let baseScale=1,baseX=0,baseY=0,hover=0,targetHover=0;
  let vw=0,vh=0;
  function size(){
    const stage=canvas.parentElement,w=stage.clientWidth,h=stage.clientHeight;
    if(w===vw&&h===vh)return;
    vw=w;vh=h;renderer.setSize(w,h,false);camera.aspect=w/h;
    const wide=w/h>1.15&&w>860;
    if(isAuthScene){
      camera.fov=27;
      baseX=0;baseY=0;baseScale=1.28;
    }else{
      camera.fov=wide?32:38;
      baseX=wide?2.35:0;
      baseY=wide?-.88:-1.62;
      baseScale=wide?1.08:.78;
    }
    camera.updateProjectionMatrix();
    hero.position.set(baseX,baseY,0);
    hero.scale.setScalar(baseScale);
  }
  const smooth=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
  const stage=canvas.closest('[data-hero-stage]')||canvas.parentElement;
  const textBlock=stage.querySelector('[data-hero-copy]');
  const calls=[...stage.querySelectorAll('[data-hero-call]')];
  let mx=0,my=0,tx=0,ty=0,visible=true,disposed=false,frame=0;
  const onPointer=e=>{
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    tx=Math.max(-1,Math.min(1,((e.clientX-rect.left)/rect.width-.5)*2));
    ty=Math.max(-1,Math.min(1,((e.clientY-rect.top)/rect.height-.5)*2));
    targetHover=1;
  };
  const onLeave=()=>{tx=0;ty=0;targetHover=0;};
  stage.addEventListener('pointermove',onPointer,{passive:true});
  stage.addEventListener('pointerleave',onLeave,{passive:true});
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else stop();},{threshold:0});
  observer.observe(stage);
  const t0=performance.now();
  function render(now){
    if(disposed||!visible)return;
    size();
    const travel=Math.max(1,stage.offsetHeight-innerHeight);
    const p=Math.min(1,Math.max(0,-stage.getBoundingClientRect().top/travel));
    const explode=smooth(.06,.92,p);
    mx+=(tx-mx)*.075;my+=(ty-my)*.075;hover+=(targetHover-hover)*.09;
    const spin=reducedMotion?0:(now-t0)*.00012;
    top.position.y=.62+explode*1.5;
    bottom.position.y=-.62-explode*1;
    mid.position.y=explode*.25;
    hero.rotation.y=-.5+spin+p*2.2+mx*(isAuthScene ? 0.9 : 0.82);
    hero.rotation.x=.42+my*.48-explode*.12;
    hero.position.x=baseX+mx*.13;
    const scrollCenter=smooth(.015,.30,p);\n    const centeredY=baseY+(isAuthScene?0:(vw/vh>1.15&&vw>860? .88:1.18)*scrollCenter);\n    hero.position.y=centeredY-my*.10;
    hero.scale.setScalar(baseScale*(1+hover*.045));
    if(textBlock){const opacity=1-smooth(.04,.3,p);textBlock.style.opacity=opacity;textBlock.style.transform='translateY('+(-smooth(.04,.3,p)*30)+'px)';textBlock.style.pointerEvents=p>.3?'none':'auto';}
    calls.forEach((call,i)=>{
      const opacity=smooth(.27+i*.055,.47+i*.055,p);
      call.style.opacity=opacity;
      call.style.transform='translateX('+((1-opacity)*34)+'px) translateY('+((1-opacity)*8)+'px)';
    });
    renderer.render(scene,camera);
    frame=requestAnimationFrame(render);
  }
  const start=()=>{if(disposed||!visible)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(render);};
  const stop=()=>{cancelAnimationFrame(frame);frame=0;};
  const resizeObserver=new ResizeObserver(size);if(canvas.parentElement)resizeObserver.observe(canvas.parentElement);
  const onVisibility=()=>{if(document.visibilityState==='visible')start();else stop();};
  document.addEventListener('visibilitychange',onVisibility);
  const onLost=e=>{e.preventDefault();stop();canvas.dispatchEvent(new CustomEvent('herocontextlost',{bubbles:true}));};
  canvas.addEventListener('webglcontextlost',onLost);
  size();bakePosters();vw=0;size();start();
  return {
    firstFrame(){renderer.render(scene,camera);return !renderer.getContext().isContextLost();},
    start,stop,
    dispose(){disposed=true;stop();observer.disconnect();resizeObserver.disconnect();stage.removeEventListener('pointermove',onPointer);stage.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('webglcontextlost',onLost);scene.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});env.dispose();renderer.dispose();}
  };
}
