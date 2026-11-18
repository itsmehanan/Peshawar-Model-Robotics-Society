/**
 * PMRS robotic-head hero. Self-contained WebGL renderer: no CDN, image, or
 * generated asset dependency. The model is assembled from lit 3D geometry;
 * scroll progress opens the face into a readable exploded engineering view.
 */
const VERT = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
void main(){
  gl_Position=vec4(aPosition,1.0);
  vNormal=normalize(aNormal);
  vColor=aColor;
  vDepth=aPosition.z;
}`;
const FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
void main(){
  vec3 n=normalize(vNormal);
  vec3 key=normalize(vec3(-0.45,0.72,0.8));
  vec3 fill=normalize(vec3(0.65,-0.25,0.55));
  float diffuse=max(dot(n,key),0.0)*0.72+max(dot(n,fill),0.0)*0.22;
  float rim=pow(1.0-abs(n.z),2.0)*0.16;
  float light=0.28+diffuse+rim;
  vec3 color=vColor*light;
  gl_FragColor=vec4(color,1.0);
}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function sphere(lat=20,lon=28){const out=[];for(let y=0;y<lat;y++){const v0=y/lat*Math.PI,v1=(y+1)/lat*Math.PI;for(let x=0;x<lon;x++){const u0=x/lon*Math.PI*2,u1=(x+1)/lon*Math.PI*2;const point=(v,u)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];const a=point(v0,u0),b=point(v1,u0),c=point(v1,u1),d=point(v0,u1);out.push(...a,...a,...b,...b,...c,...c,...a,...a,...c,...c,...d,...d);}}return out;}
function box(){const faces=[[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],[[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],[[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]],[[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],[[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]]];const out=[];for(const [n,p] of faces){for(const i of [0,1,2,0,2,3])out.push(...p[i],...n);}return out;}
function cylinder(segments=24){const out=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;const p=[Math.cos(a),-1,Math.sin(a)],q=[Math.cos(b),-1,Math.sin(b)],r=[Math.cos(b),1,Math.sin(b)],s=[Math.cos(a),1,Math.sin(a)];for(const v of [p,q,r,p,r,s])out.push(...v,v[0],0,v[2]);const bottom=[0,-1,0],top=[0,1,0];out.push(...bottom,...bottom,...q,...bottom,...p,...bottom,...top,...top,...s,...top,...r,...top);}return out;}
function torus(major=0.78,minor=0.1,segments=32,tube=10){const out=[];const point=(u,v)=>[(major+minor*Math.cos(v))*Math.cos(u), (major+minor*Math.cos(v))*Math.sin(u), minor*Math.sin(v)];for(let i=0;i<segments;i++)for(let j=0;j<tube;j++){const u=i/segments*Math.PI*2,U=(i+1)/segments*Math.PI*2,v=j/tube*Math.PI*2,V=(j+1)/tube*Math.PI*2;const a=point(u,v),b=point(U,v),c=point(U,V),d=point(u,V);for(const p of [a,b,c,a,c,d]){const n=[Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)];out.push(...p,...n);}}return out;}
const GEO={sphere:sphere(),box:box(),cylinder:cylinder(),eyeRing:torus(.78,.11,32,10),earRing:torus(.78,.12,24,8)};
function makeModel(){
 const parts=[];
 const add=(geo,pos,scale,color,rot=[0,0,0],explode=[0,0,0],range=[0,1])=>parts.push({geo,pos,scale,color,rot,explode,range});
 const titanium=[.62,.67,.7], dark=[.12,.16,.19], bright=[.82,.85,.84], copper=[.78,.37,.2], black=[.035,.05,.06], lens=[.94,.46,.22];
 // Main cranial shell, rear dome and cheek structure.
 add('sphere',[0,.32,-.12],[1.13,1.35,.76],titanium,[0,0,0],[0,.12,-.12],[.62,1]);
 add('sphere',[0,-.48,.04],[.9,.72,.72],dark,[0,0,0],[0,-.34,.18],[.28,1]);
 add('sphere',[-.88,-.12,.02],[.32,.67,.57],titanium,[0,0,-.2],[-.42,0,.1],[.2,.85]);
 add('sphere',[.88,-.12,.02],[.32,.67,.57],titanium,[0,0,.2],[.42,0,.1],[.2,.85]);
 // Forehead plate and chin guard.
 add('box',[0,1.15,.48],[.72,.24,.12],bright,[0,0,0],[0,.46,.2],[.2,.78]);
 add('sphere',[0,-.82,.45],[.68,.34,.24],bright,[0,0,0],[0,-.52,.28],[.28,.9]);
 // Face mask: two cheeks and nose bridge move forward during reveal.
 add('box',[-.48,-.12,.68],[.26,.54,.12],dark,[0,0,-.13],[-.34,0,.56],[.18,.88]);
 add('box',[.48,-.12,.68],[.26,.54,.12],dark,[0,0,.13],[.34,0,.56],[.18,.88]);
 add('box',[0,.02,.77],[.18,.57,.14],bright,[0,0,0],[0,.08,.72],[.22,.86]);
 add('box',[0,-.57,.72],[.48,.13,.12],dark,[0,0,0],[0,-.32,.62],[.3,.9]);
 // Eyes: dark recessed sockets, copper bezels, warm optical lenses.
 for(const side of [-1,1]){
   add('sphere',[side*.43,.34,.69],[.31,.27,.14],black,[0,0,side*-.12],[side*.18,.02,.48],[.12,.8]);
   add('eyeRing',[side*.43,.34,.82],[.29,.23,.065],copper,[0,0,side*-.12],[side*.18,.02,.62],[.12,.8]);
   add('sphere',[side*.43,.34,.82],[.18,.15,.09],lens,[0,0,0],[side*.18,.02,.7],[.12,.8]);
   add('sphere',[side*.43,.34,.9],[.055,.055,.035],bright,[0,0,0],[side*.18,.02,.74],[.12,.8]);
   // ear housings and inner circular detail
   add('cylinder',[side*1.08,.12,-.02],[.17,.48,.48],[.3,.36,.4],[Math.PI/2,0,0],[side*.34,.05,0],[.22,.82]);
   add('earRing',[side*1.08,.12,.18],[.34,.34,.12],copper,[Math.PI/2,0,0],[side*.4,.05,.18],[.22,.82]);
   add('sphere',[side*1.08,.12,.2],[.2,.2,.08],dark,[0,0,0],[side*.4,.05,.24],[.22,.82]);
 }
 // Exposed internal core, processor, heat sinks and actuators.
 add('box',[0,-.04,.05],[.38,.5,.28],[.22,.28,.3],[0,0,0],[0,.04,.8],[.42,1]);
 add('box',[0,-.02,.38],[.25,.25,.1],copper,[0,0,0],[0,.04,.95],[.42,1]);
 for(let i=-2;i<=2;i++){
   add('box',[i*.14,-.05,-.02],[.035,.42,.16],bright,[0,0,0],[i*.13,.02,.74],[.42,1]);
 }
 add('cylinder',[-.56,-.48,.1],[.1,.52,.1],copper,[0,0,Math.PI/2],[-.34,-.22,.62],[.32,1]);
 add('cylinder',[.56,-.48,.1],[.1,.52,.1],copper,[0,0,Math.PI/2],[.34,-.22,.62],[.32,1]);
 // Neck column and layered collar.
 add('cylinder',[0,-1.28,-.04],[.42,.5,.42],dark,[0,0,0],[0,-.28,.05],[.1,.95]);
 add('torus',[0,-1.12,-.02],[.5,.5,.5],copper,[Math.PI/2,0,0],[0,-.18,.1],[.1,.95]);
 return parts;
}
const rotate=(p,r)=>{let [x,y,z]=p;let c=Math.cos(r[0]),s=Math.sin(r[0]);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(r[1]);s=Math.sin(r[1]);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(r[2]);s=Math.sin(r[2]);[x,y]=[x*c-y*s,x*s+y*c];return [x,y,z];};
export function mountHeroScene(canvas,{reducedMotion=false}={}){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance'});
 if(!gl)throw new Error('WebGL is unavailable');
 const p=program(gl);gl.useProgram(p);
 const loc={pos:gl.getAttribLocation(p,'aPosition'),normal:gl.getAttribLocation(p,'aNormal'),color:gl.getAttribLocation(p,'aColor')};
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 const stride=9*4;
 for(const [name,size,offset] of [['pos',3,0],['normal',3,12],['color',3,24]]){gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],size,gl.FLOAT,false,stride,offset);}
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);
 const model=makeModel(),geometry=GEO;let width=1,height=1,progress=0,frame=0,disposed=false,visible=true,running=true;
 const pointer={x:0,y:0},target={x:0,y:0};const stage=canvas.closest('[data-hero-stage]')||canvas.parentElement;
 const resize=()=>{const r=canvas.parentElement?.getBoundingClientRect()||canvas.getBoundingClientRect();width=Math.max(1,Math.floor(r.width));height=Math.max(1,Math.floor(r.height));const dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);};
 const ro=new ResizeObserver(resize);if(canvas.parentElement)ro.observe(canvas.parentElement);resize();
 const onPointer=e=>{const r=stage.getBoundingClientRect();pointer.x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*.5;pointer.y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*-.35;};
 const onLeave=()=>{pointer.x=0;pointer.y=0;};stage.addEventListener('pointermove',onPointer,{passive:true});stage.addEventListener('pointerleave',onLeave,{passive:true});
 const section=stage.closest('.hero');let scrollTick=0;
 const updateProgress=()=>{scrollTick=0;if(!section)return;const r=section.getBoundingClientRect();progress=clamp(-r.top/Math.max(1,section.offsetHeight-innerHeight),0,1);};
 const onScroll=()=>{if(!scrollTick)scrollTick=requestAnimationFrame(updateProgress);};addEventListener('scroll',onScroll,{passive:true});updateProgress();
 const pack=[];
 function render(){
   if(disposed||!running||!visible)return;
   const t=performance.now()*.001;target.x+=(pointer.x-target.x)*.045;target.y+=(pointer.y-target.y)*.045;
   const pgr=progress,explode=smooth(.06,.82,pgr);
   const rootY=target.x+(reducedMotion?0:pgr*.26),rootX=target.y+(reducedMotion?0:Math.sin(pgr*Math.PI)*.06);
   pack.length=0;
   const aspect=width/Math.max(1,height),f=1/Math.tan(37*Math.PI/360),camera=7.2;
   for(const part of model){
     const [start,end]=part.range;const open=smooth(start,end,explode);
     const off=part.explode.map(v=>v*open);
     const pos=[part.pos[0]+off[0],part.pos[1]+off[1],part.pos[2]+off[2]];
     const rot=[part.rot[0]+(part.explode[1]||0)*open*.08,part.rot[1]+rootY,part.rot[2]+rootX];
     const verts=geometry[part.geo];
     for(let i=0;i<verts.length;i+=6){
       let v=rotate([verts[i]*part.scale[0],verts[i+1]*part.scale[1],verts[i+2]*part.scale[2]],rot);
       v=[v[0]+pos[0],v[1]+pos[1],v[2]+pos[2]];
       v=rotate(v,[rootX,rootY,0]);
       let n=rotate(rotate([verts[i+3],verts[i+4],verts[i+5]],rot),[rootX,rootY,0]);
       const depth=camera-v[2],z=((50+.1)/(50-.1))-((2*50*.1)/(50-.1))/depth;
       const x=(v[0]*f/aspect)/depth,y=(v[1]*f)/depth;
       pack.push(x,y,z,...n,...part.color);
     }
   }
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pack),gl.DYNAMIC_DRAW);
   gl.drawArrays(gl.TRIANGLES,0,pack.length/9);
   frame=requestAnimationFrame(render);
 }
 const start=()=>{if(disposed||!visible||!running)return;cancelAnimationFrame(frame);render();};
 const stop=()=>{cancelAnimationFrame(frame);frame=0;};
 const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else stop();},{threshold:.01});io.observe(canvas);
 const onVisibility=()=>{running=document.visibilityState==='visible';if(running)start();else stop();};document.addEventListener('visibilitychange',onVisibility);
 const onLost=e=>{e.preventDefault();stop();canvas.dispatchEvent(new CustomEvent('herocontextlost',{bubbles:true}));};canvas.addEventListener('webglcontextlost',onLost);
 start();
 return {firstFrame(){render();return !gl.isContextLost();},start,stop,dispose(){disposed=true;stop();ro.disconnect();io.disconnect();removeEventListener('scroll',onScroll);cancelAnimationFrame(scrollTick);stage.removeEventListener('pointermove',onPointer);stage.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('webglcontextlost',onLost);gl.deleteBuffer(buffer);gl.deleteProgram(p);}};
}
