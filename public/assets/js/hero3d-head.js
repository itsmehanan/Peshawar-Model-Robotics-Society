/**
 * PMRS hero sculpture: a soft, expressive robotic hand holding a faceted crystal.
 * The separate sculptural forms begin exploded and gather into one object as
 * the visitor scrolls down. No external model, image, or runtime dependency.
 */
const VERT = [
  "attribute vec3 aPosition;",
  "attribute vec3 aNormal;",
  "attribute vec3 aColor;",
  "varying vec3 vNormal;",
  "varying vec3 vColor;",
  "void main(){",
  "  gl_Position=vec4(aPosition,1.0);",
  "  vNormal=normalize(aNormal);",
  "  vColor=aColor;",
  "}"
].join("\n");
const FRAG = [
  "precision mediump float;",
  "varying vec3 vNormal;",
  "varying vec3 vColor;",
  "void main(){",
  "  vec3 n=normalize(vNormal);",
  "  vec3 key=normalize(vec3(-0.48,0.72,0.82));",
  "  vec3 fill=normalize(vec3(0.62,-0.28,0.58));",
  "  float diffuse=max(dot(n,key),0.0)*0.72+max(dot(n,fill),0.0)*0.24;",
  "  float spec=pow(max(dot(reflect(-key,n),vec3(0.0,0.0,1.0)),0.0),22.0)*0.34;",
  "  float rim=pow(1.0-max(dot(n,vec3(0.0,0.0,1.0)),0.0),3.0)*0.2;",
  "  vec3 color=vColor*(0.3+diffuse)+vec3(0.28,0.72,0.78)*rim+vec3(1.0,0.78,0.48)*spec;",
  "  gl_FragColor=vec4(color,1.0);",
  "}"
].join("\n");
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function sphere(lat=24,lon=32){const out=[];for(let y=0;y<lat;y++){const v0=y/lat*Math.PI,v1=(y+1)/lat*Math.PI;for(let x=0;x<lon;x++){const u0=x/lon*Math.PI*2,u1=(x+1)/lon*Math.PI*2;const point=(v,u)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];const a=point(v0,u0),b=point(v1,u0),c=point(v1,u1),d=point(v0,u1);out.push(...a,...a,...b,...b,...c,...c,...a,...a,...c,...c,...d,...d);}}return out;}
function cylinder(segments=40){const out=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;const p=[Math.cos(a),-1,Math.sin(a)],q=[Math.cos(b),-1,Math.sin(b)],r=[Math.cos(b),1,Math.sin(b)],s=[Math.cos(a),1,Math.sin(a)];for(const v of [p,q,r,p,r,s])out.push(...v,v[0],0,v[2]);}return out;}
function torus(major=.8,minor=.08,segments=48,tube=12){const out=[];const point=(u,v)=>[(major+minor*Math.cos(v))*Math.cos(u),(major+minor*Math.cos(v))*Math.sin(u),minor*Math.sin(v)];for(let i=0;i<segments;i++)for(let j=0;j<tube;j++){const u=i/segments*Math.PI*2,U=(i+1)/segments*Math.PI*2,v=j/tube*Math.PI*2,V=(j+1)/tube*Math.PI*2;const a=point(u,v),b=point(U,v),c=point(U,V),d=point(u,V);for(const p of [a,b,c,a,c,d]){const n=[Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)];out.push(...p,...n);}}return out;}
function tube(points,radii,segments=12){
  const out=[];
  const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  for(let i=0;i<points.length-1;i++){
    const p0=points[i],p1=points[i+1],t=norm(p1.map((v,k)=>v-p0[k]));
    const ref=Math.abs(t[2])>.88?[0,1,0]:[0,0,1],u=norm(cross(t,ref)),v=norm(cross(t,u));
    const rings=[];
    for(let j=0;j<=1;j++){
      const center=j?p1:p0,rad=radii[i+j]||radii[radii.length-1];
      const ring=[];
      for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,n=norm(u.map((q,m)=>q*Math.cos(a)+v[m]*Math.sin(a)));ring.push({p:center.map((q,m)=>q+n[m]*rad),n});}
      rings.push(ring);
    }
    for(let k=0;k<segments;k++){const a=rings[0][k],b=rings[0][k+1],c=rings[1][k+1],d=rings[1][k];for(const q of [a,b,c,a,c,d])out.push(...q.p,...q.n);}
  }
  return out;
}
function gem(){
  const out=[],top=[0,.72,0],bottom=[0,-.72,0],ring=[[0.48,0,0],[0,0,.48],[-.48,0,0],[0,0,-.48]];
  const tri=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;for(const p of [a,b,c])out.push(...p,n[0]/l,n[1]/l,n[2]/l);};
  for(let i=0;i<4;i++){tri(top,ring[i],ring[(i+1)%4]);tri(bottom,ring[(i+1)%4],ring[i]);}
  return out;
}
const GEO={sphere:sphere(),cylinder:cylinder(),torus:torus(),tube:null,gem:gem()};
function makeModel(){
  const parts=[];
  const add=(geo,pos,scale,color,rot=[0,0,0],explode=[0,0,0],range=[0,1])=>parts.push({geo,pos,scale,color,rot,explode,range});
  const silver=[.58,.68,.72],pearl=[.82,.86,.84],shadow=[.18,.25,.29],cyan=[.18,.72,.78],gold=[.82,.61,.34],crystal=[.26,.78,.86];
  // Forearm and softly sculpted palm.
  add('cylinder',[0,-1.03,.04],[.34,.47,.34],shadow,[0,0,0],[0,-.42,.08],[.1,.94]);
  add('torus',[0,-.77,.08],[.38,.38,.38],gold,[Math.PI/2,0,0],[0,-.35,.12],[.1,.9]);
  add('sphere',[0,-.22,.22],[.64,.69,.28],silver,[0,0,0],[0,-.42,.24],[.15,.92]);
  add('sphere',[0,-.36,.43],[.48,.46,.13],pearl,[0,0,0],[0,-.48,.38],[.18,.9]);
  // Four elegant curved fingers, built as continuous tapered forms rather than bolts.
  const fingers=[
    {p:[[-.43,-.02,.28],[-.57,.24,.32],[-.59,.57,.4],[-.48,.82,.49],[-.28,.78,.57]],r:[.145,.13,.115,.105,.075],e:[-.42,.2,.42]},
    {p:[[-.16,.02,.34],[-.22,.34,.39],[-.2,.68,.47],[-.06,.91,.55],[.12,.86,.62]],r:[.15,.135,.12,.105,.075],e:[-.18,.45,.55]},
    {p:[[.13,.02,.34],[.18,.34,.4],[.23,.63,.48],[.34,.81,.55],[.48,.75,.59]],r:[.145,.13,.115,.1,.07],e:[.28,.35,.48]},
    {p:[[.39,-.08,.26],[.55,.16,.32],[.62,.4,.4],[.65,.59,.48],[.77,.55,.51]],r:[.13,.115,.1,.09,.06],e:[.5,.12,.32]}
  ];
  for(const f of fingers)parts.push({geo:'tube',custom:tube(f.p,f.r),pos:[0,0,0],scale:[1,1,1],color:silver,rot:[0,0,0],explode:f.e,range:[.08,.86]});
  // Thumb sweeps across the front to cradle the crystal.
  parts.push({geo:'tube',custom:tube([[.48,-.34,.38],[.72,-.12,.45],[.69,.17,.53],[.48,.37,.61],[.25,.3,.66]],[.19,.16,.135,.115,.085]),pos:[0,0,0],scale:[1,1,1],color:pearl,rot:[0,0,0],explode:[.52,-.18,.5],range:[.12,.9]});
  // The crystal is the unmistakable focal object: faceted, translucent-looking cyan with a warm core.
  add('gem',[0,.72,.52],[.68,.82,.62],crystal,[0,0,.08],[0,.68,.5],[.05,.94]);
  add('sphere',[0,.69,.84],[.13,.2,.07],gold,[0,0,0],[0,.88,.58],[.12,.92]);
  add('torus',[0,.15,.72],[.18,.18,.18],gold,[Math.PI/2,0,0],[0,.45,.75],[.25,.95]);
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
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
 const model=makeModel();let width=1,height=1,progress=0,frame=0,lastFrame=0,disposed=false,visible=true,running=true;
 const pointer={x:0,y:0},target={x:0,y:0},stage=canvas.closest('[data-hero-stage]')||canvas.parentElement;
 const resize=()=>{const r=canvas.parentElement?.getBoundingClientRect()||canvas.getBoundingClientRect();width=Math.max(1,Math.floor(r.width));height=Math.max(1,Math.floor(r.height));const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);};
 const ro=new ResizeObserver(resize);if(canvas.parentElement)ro.observe(canvas.parentElement);resize();
 const onPointer=e=>{const r=stage.getBoundingClientRect();pointer.x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*.28;pointer.y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*-.2;};
 const onLeave=()=>{pointer.x=0;pointer.y=0;};stage.addEventListener('pointermove',onPointer,{passive:true});stage.addEventListener('pointerleave',onLeave,{passive:true});
 const section=stage.closest('.hero');let scrollTick=0;
 const updateProgress=()=>{scrollTick=0;if(!section)return;const r=section.getBoundingClientRect();progress=clamp(-r.top/Math.max(1,section.offsetHeight-innerHeight),0,1);};
 const onScroll=()=>{if(!scrollTick)scrollTick=requestAnimationFrame(updateProgress);};addEventListener('scroll',onScroll,{passive:true});updateProgress();
 const pack=[];
 function render(){
   if(disposed||!running||!visible)return;
   const now=performance.now();if(now-lastFrame<1000/40){frame=requestAnimationFrame(render);return;}lastFrame=now;
   target.x+=(pointer.x-target.x)*.045;target.y+=(pointer.y-target.y)*.045;
   // Exploded at the top of the chapter; the hand gathers around the crystal as you scroll.
   const assembly=1-smooth(.04,.94,progress);
   const rootY=target.x+(reducedMotion?0:progress*.1),rootX=target.y+(reducedMotion?0:Math.sin(progress*Math.PI)*.035);
   pack.length=0;
   const aspect=width/Math.max(1,height),f=1/Math.tan(34*Math.PI/360),camera=5.35;
   for(const part of model){
     const [start,end]=part.range,open=smooth(start,end,assembly);
     const off=part.explode.map(v=>v*open);
     const pos=[part.pos[0]+off[0],part.pos[1]+off[1],part.pos[2]+off[2]];
     const rot=[part.rot[0],part.rot[1]+rootY,part.rot[2]+rootX];
     const verts=part.custom||GEO[part.geo];
     for(let i=0;i<verts.length;i+=6){
       let v=rotate([verts[i]*part.scale[0],verts[i+1]*part.scale[1],verts[i+2]*part.scale[2]],rot);
       v=[v[0]+pos[0],v[1]+pos[1],v[2]+pos[2]];
       v=rotate(v,[rootX,rootY,0]);
       const n=rotate(rotate([verts[i+3],verts[i+4],verts[i+5]],rot),[rootX,rootY,0]);
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
 return {firstFrame(){render();return !gl.isContextLost();},start,stop,dispose(){disposed=true;stop();ro.disconnect();io.disconnect();removeEventListener('scroll',onScroll);cancelAnimationFrame(scrollTick);stage.removeEventListener('pointermove',onPointer);stage.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('webglcontextlost',onLost);gl.deleteBuffer(buffer);gl.deleteProgram(p);}};
}
