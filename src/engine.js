const $=id=>document.getElementById(id);
const ids=["W","H","b","fh","pat","cell","rot","gw","gh","iw","ih","preset","bx","by","mg","seam","pins","snap","pd","hd","fc","sepb","bt","mount","flt","cove","lw","plates","pt","pl"];
let model=null, selected=0;

function readParams(){
  const n=id=>{const v=parseFloat($(id).value);return isFinite(v)?v:0};
  return {W:Math.max(60,n("W")),H:Math.max(60,n("H")),b:Math.max(4,n("b")),fh:Math.max(1,n("fh")),
    pat:$("pat").value,cell:Math.max(8,n("cell")),rot:$("rot").checked,
    gw:Math.max(.8,n("gw")),gh:Math.max(1,n("gh")),iw:Math.max(.8,n("iw")),ih:Math.max(1,n("ih")),
    bx:Math.max(80,n("bx")),by:Math.max(80,n("by")),mg:Math.max(0,n("mg")),
    zig:$("seam").value!=="straight",lap:$("seam").value==="lap",
    pins:$("pins").checked&&$("seam").value!=="straight",
    sepb:$("sepb").checked&&$("seam").value!=="straight",bt:Math.max(0.6,n("bt")),mount:$("mount").value==="cleat"&&$("sepb").checked&&$("seam").value!=="straight",wall:$("mount").value==="pegs"&&$("seam").value!=="straight",pin:Math.max(1.5,n("pd")),hub:Math.max(4,n("hd")),fc:Math.min(0.5,Math.max(0,n("fc"))),snap:$("snap").checked,flt:Math.max(0,+$("flt").value||0),cove:$("cove").checked,lw:Math.min(16,Math.max(4,+$("lw").value||10)),
    plates:$("plates").checked&&$("seam").value==="straight",pt:Math.max(.8,n("pt")),pl:Math.max(15,n("pl"))};
}
const isTri=p=>["asanoha","kikko","mitsukude","sankaku"].includes(p);

/* ---------- lattice: cells + shared edges ---------- */
function lattice(P){
  const {W,H,cell:s}=P, cx=W/2, cy=H/2, cells=[], emap=new Map();
  let ang=P.rot?Math.PI/2:0; if(P.pat==="hishi") ang+=Math.PI/4;
  const ca=Math.cos(ang), sa=Math.sin(ang);
  const tf=(p)=>[cx+p[0]*ca-p[1]*sa, cy+p[0]*sa+p[1]*ca];
  const inView=(pts)=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of pts){a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1]);}return b>0&&a<W&&d>0&&c<H;};
  const key=(a,b)=>{const k1=Math.round(a[0]*100)+","+Math.round(a[1]*100),k2=Math.round(b[0]*100)+","+Math.round(b[1]*100);return k1<k2?k1+"|"+k2:k2+"|"+k1};
  const addEdge=(a,b,ci)=>{const k=key(a,b);let e=emap.get(k);if(!e){e={a,b,cells:[]};emap.set(k,e);}e.cells.push(ci);};
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const R=Math.hypot(W,H)/2+2*s;
  if(isTri(P.pat)){
    const h=s*Math.sqrt(3)/2, J=Math.ceil(R/h)+1, I=Math.ceil(R/s)+1;
    const v=(i,j)=>tf([i*s+j*s/2, j*h]);
    for(let j=-J;j<=J;j++)for(let i=-I-J;i<=I+J;i++){
      for(const tri of [[v(i,j),v(i+1,j),v(i,j+1)],[v(i+1,j),v(i+1,j+1),v(i,j+1)]]){
        if(!inView(tri))continue;
        const c=[(tri[0][0]+tri[1][0]+tri[2][0])/3,(tri[0][1]+tri[1][1]+tri[2][1])/3];
        const infill=[];
        for(let k=0;k<3;k++){
          if(P.pat==="asanoha") infill.push([c,tri[k]]);
          if(P.pat==="mitsukude"||P.pat==="kikko") infill.push([c,mid(tri[k],tri[(k+1)%3])]);
        }
        const ci=cells.length; cells.push({c,poly:tri,infill,kind:P.pat==="kikko"?"g":"i"});
        for(let k=0;k<3;k++) addEdge(tri[k],tri[(k+1)%3],ci);
      }
    }
  } else {
    const I=Math.ceil(R/s)+1, o=s/2, v=(i,j)=>tf([i*s-o, j*s-o]);
    for(let j=-I;j<=I;j++)for(let i=-I;i<=I;i++){
      const q=[v(i,j),v(i+1,j),v(i+1,j+1),v(i,j+1)];
      if(!inView(q))continue;
      const c=[(q[0][0]+q[2][0])/2,(q[0][1]+q[2][1])/2];
      const ci=cells.length; cells.push({c,poly:q,infill:[],kind:"i"});
      for(let k=0;k<4;k++) addEdge(q[k],q[(k+1)%4],ci);
    }
  }
  return {cells,edges:[...emap.values()],drawEdges:P.pat!=="kikko"};
}

/* Liang–Barsky */
function clip(a,b,x0,y0,x1,y1){
  const dx=b[0]-a[0], dy=b[1]-a[1]; let t0=0,t1=1;
  const p=[-dx,dx,-dy,dy], q=[a[0]-x0,x1-a[0],a[1]-y0,y1-a[1]];
  for(let i=0;i<4;i++){
    if(Math.abs(p[i])<1e-12){ if(q[i]<0) return null; }
    else { const r=q[i]/p[i]; if(p[i]<0){ if(r>t1) return null; if(r>t0) t0=r; } else { if(r<t0) return null; if(r<t1) t1=r; } }
  }
  return [t0,t1];
}
function rectBox(x0,y0,x1,y1,h){return {pts:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],z0:0,z:h,kind:"r"}}
function barBox(pa,pb,w,h,kind){
  const L=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]), nx=-(pb[1]-pa[1])/L*w/2, ny=(pb[0]-pa[0])/L*w/2;
  let pts=[[pa[0]+nx,pa[1]+ny],[pa[0]-nx,pa[1]-ny],[pb[0]-nx,pb[1]-ny],[pb[0]+nx,pb[1]+ny]];
  let ar=0;for(let i=0;i<4;i++){const p=pts[i],q=pts[(i+1)%4];ar+=p[0]*q[1]-q[0]*p[1];}
  if(ar<0) pts.reverse();
  return {pts,z0:0,z:h,kind};
}
function polyArea(pts){let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2}

function hull(pts){
  const p=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]), cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const q of p){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],q)<=1e-9)lo.pop();lo.push(q);}
  for(const q of p.reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],q)<=1e-9)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
// keep the part of polygon `pts` where (p-q)·n >= 0
function cutHalf(pts,q,n){
  const out=[], f=p=>(p[0]-q[0])*n[0]+(p[1]-q[1])*n[1];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length], fa=f(a), fb=f(b);
    if(fa>=0) out.push(a);
    if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb); out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}
function clipConvex(pts,poly){ // poly CCW
  let out=pts;
  for(let i=0;i<poly.length&&out.length>2;i++){const a=poly[i],b=poly[(i+1)%poly.length]; out=cutHalf(out,a,[-(b[1]-a[1]),b[0]-a[0]]);}
  return out;
}

/* ---------- tiling ---------- */
function candidates(P){
  const ex=P.bx-2*P.mg, ey=P.by-2*P.mg, big=Math.max(ex,ey), out=[];
  const nx0=Math.ceil(P.W/big), ny0=Math.ceil(P.H/big);
  for(let nx=nx0;nx<=nx0+5;nx++)for(let ny=ny0;ny<=ny0+5;ny++){
    const tw=P.W/nx, th=P.H/ny;
    if((tw<=ex&&th<=ey)||(tw<=ey&&th<=ex)) out.push({nx,ny,tw,th,ex,ey});
  }
  return out.sort((a,b)=>a.nx*a.ny-b.nx*b.ny||Math.abs(a.tw-a.th)-Math.abs(b.tw-b.th));
}

function build(){
  const P=readParams(), Lt=lattice(P), cands=candidates(P);
  let L=null, tiles=null;
  for(const C of cands.slice(0,12)){ const t=makeTiles(P,C,Lt); L=C; tiles=t; if(t.every(x=>x.fits)) break; }
  if(!tiles){ const ex=P.bx-2*P.mg, ey=P.by-2*P.mg; L={nx:1,ny:1,tw:P.W,th:P.H,ex,ey}; tiles=makeTiles(P,L,Lt); }
  const plates=[];
  if(P.plates){
    const per=len=>Math.max(2,Math.round(len/110));
    for(let r=0;r<L.ny;r++)for(let c=1;c<L.nx;c++){const n=per(L.th);for(let k=0;k<n;k++)plates.push({len:P.pl,wid:P.b-1})}
    for(let r=1;r<L.ny;r++)for(let c=0;c<L.nx;c++){const n=per(L.tw);for(let k=0;k<n;k++)plates.push({len:P.pl,wid:P.b-1})}
  }
  const borders=makeBorders(P,Lt,tiles.pins||[],tiles.sockets||[]);
  model={P,L,tiles,plates,pins:tiles.pins||[],sockets:tiles.sockets||[],keys:tiles.keys||[],K:tiles.K,teeth:tiles.teeth||0,borders,pegs:borders.reduce((n,b)=>n+(b.pegs||0),0)};
  if(selected>=tiles.length) selected=0;
  render();
}

function makeTiles(P,L,Lt){
  const e=Math.max(P.gw,P.iw), rail=P.b/2;
  const tileIdx=(x,y)=>{const c=Math.min(L.nx-1,Math.max(0,Math.floor(x/L.tw))),r=Math.min(L.ny-1,Math.max(0,Math.floor((P.H-y)/L.th)));return r*L.nx+c;};
  const tiles=[];
  for(let r=0;r<L.ny;r++)for(let c=0;c<L.nx;c++){
    tiles.push({r,c,x0:c*L.tw,x1:(c+1)*L.tw,y1:P.H-r*L.th,y0:P.H-(r+1)*L.th,boxes:[],name:String.fromCharCode(65+r)+(c+1)});
  }
  const cellTile=Lt.cells.map(cl=>tileIdx(cl.c[0],cl.c[1]));

  const sides=[[[P.b,0],[1,0]],[[P.W-P.b,0],[-1,0]],[[0,P.b],[0,1]],[[0,P.H-P.b],[0,-1]]];
  function addBar(ti,a,b,w,h,kind,terr){
    let len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<0.05) return;
    for(const k of keys){
      const tr=K.L+0.1;
      if(Math.hypot(a[0]-k.M[0],a[1]-k.M[1])<0.02){const u=tr/len; a=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]; len-=tr;}
      else if(Math.hypot(b[0]-k.M[0],b[1]-k.M[1])<0.02){const u=tr/len; b=[b[0]+(a[0]-b[0])*u,b[1]+(a[1]-b[1])*u]; len-=tr;}
      if(len<0.05) return;
    }
    if(pinPts.length){
      // stop bars short of a pin hole so the hole stays open
      for(let vi=0;vi<pinPts.length;vi++){
        const v=pinPts[vi], tr=Math.max(pinR[vi][0],pinR[vi][2]||0)+0.15;
        if(Math.hypot(a[0]-v[0],a[1]-v[1])<w/2+0.02){const u=tr/len; a=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]; len-=tr;}
        else if(Math.hypot(b[0]-v[0],b[1]-v[1])<w/2+0.02){const u=tr/len; b=[b[0]+(a[0]-b[0])*u,b[1]+(a[1]-b[1])*u]; len-=tr;}
        if(len<0.05) return;
      }
    }
    const pt=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    if(P.zig){
      const re=clip(a,b,e,e,P.W-e,P.H-e); if(!re||len*(re[1]-re[0])<0.05) return;
      const base=barBox(pt(re[0]),pt(re[1]),w,h,kind).pts;
      if(terr&&terr.multi){ for(const tp of terr.multi) pushPiece(ti,clipConvex(base,tp),0,h,kind); return; }
      pushPiece(ti,terr?clipConvex(base,terr):base,0,h,kind);
    } else {
      const T=tiles[ti]; const r=clip(a,b,T.x0+e,T.y0+e,T.x1-e,T.y1-e); if(!r||len*(r[1]-r[0])<0.05) return;
      tiles[ti].boxes.push(barBox(pt(r[0]),pt(r[1]),w,h,kind));
    }
  }
  function pushPiece(ti,poly,z0,h,kind){
      if(poly.length<3) return;
      // inside the border band: overlap 0.5 mm into border printed on this tile, stop flush where a neighbor owns it
      for(const [q,n] of sides){
        if(poly.length<3) return;
        const f=p=>(p[0]-q[0])*n[0]+(p[1]-q[1])*n[1];
        if(poly.every(p=>f(p)>=0)) continue;
        const inBand=cutHalf(poly,q,[-n[0],-n[1]]);
        const own=!P.sepb&&inBand.length>2&&inBand.every(p=>tileIdx(p[0]-n[0]*1e-6,p[1]-n[1]*1e-6)===ti&&tileIdx(p[0]+0.01,p[1])===ti&&tileIdx(p[0]-0.01,p[1])===ti&&tileIdx(p[0],p[1]+0.01)===ti&&tileIdx(p[0],p[1]-0.01)===ti);
        poly=cutHalf(poly,[q[0]-n[0]*(own?P.b-e:0),q[1]-n[1]*(own?P.b-e:0)],n);
      }
      if(poly.length<3||polyArea(poly)<0.01) return;
      tiles[ti].boxes.push({pts:poly,z0,z:h,kind});
  }
  const ccw=p=>{let ar=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];ar+=a[0]*b[1]-b[0]*a[1];}return ar<0?p.slice().reverse():p;};
  const cpoly=Lt.cells.map(cl=>ccw(cl.poly));
  const pinPts=[], pinCells=[], pinR=[], keys=[], sockets=[];
  const depth=(isTri(P.pat)?P.cell*Math.sqrt(3)/2:P.cell)+P.gw;
  const distEdge=(x,y)=>Math.min(x,P.W-x,y,P.H-y);
  if(P.zig&&P.pins){
    const vmap=new Map(), vk=p=>Math.round(p[0]*100)+","+Math.round(p[1]*100);
    for(const ed of Lt.edges){
      const own=ed.cells.map(ci=>cellTile[ci]), seam=own.length===2&&own[0]!==own[1];
      for(const p of [ed.a,ed.b]){const k=vk(p);let v=vmap.get(k);if(!v){v={p,cells:new Set(),seam:false};vmap.set(k,v);}ed.cells.forEach(c=>v.cells.add(c));if(seam)v.seam=true;}
    }
    const ro=P.hub/2;
    // peg holes: grid points under the border's backing lattice, owned by a single tile, spaced along the border
    if(P.sepb){
      const cand=[...vmap.values()].filter(v=>{const d=distEdge(...v.p);const ts=new Set([...v.cells].map(c=>cellTile[c]));return !v.seam&&ts.size===1&&d>=P.b+ro+0.6&&d<=P.b+depth-ro-0.6;});
      cand.sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]);
      const minGap=Math.max(55,P.cell*1.4);
      for(const v of cand){ if(pinPts.every(q=>Math.hypot(q[0]-v.p[0],q[1]-v.p[1])>=minGap)){pinPts.push(v.p);pinCells.push([...v.cells]);pinR.push([P.pin/2,P.hub/2,SNAP(P).on?(P.pin-P.fc)/2+SNAP(P).bd+0.1:0]);} }
    }
    // bowtie keys: midpoints of seam edges (lap seams lock with their own teeth instead)
    // (kept clear of the backing lattice and spaced apart)
    const m=P.b+(P.sepb?depth:0)+8;
    const seams=Lt.edges.filter(ed=>ed.cells.length===2&&cellTile[ed.cells[0]]!==cellTile[ed.cells[1]]);
    seams.sort((a,b)=>(a.a[0]+a.b[0])-(b.a[0]+b.b[0])||(a.a[1]+a.b[1])-(b.a[1]+b.b[1]));
    if(!P.lap&&!P.wall) for(const ed of seams){
      const M=[(ed.a[0]+ed.b[0])/2,(ed.a[1]+ed.b[1])/2];
      if(distEdge(...M)<m) continue;
      if(keys.some(k=>Math.hypot(k.M[0]-M[0],k.M[1]-M[1])<P.cell*1.2)) continue;
      const l=Math.hypot(ed.b[0]-ed.a[0],ed.b[1]-ed.a[1]);
      keys.push({M,ed,t:[(ed.b[0]-ed.a[0])/l,(ed.b[1]-ed.a[1])/l]});
    }
  }
  // wall-peg mount: two hidden sockets per tile, at grid points owned by that tile alone,
  // clear of the border's backing lattice; each slides onto a peg on a wall puck
  if(P.wall){
    const vmap=new Map(), vk=p=>Math.round(p[0]*100)+","+Math.round(p[1]*100);
    for(const ed of Lt.edges){
      const own=ed.cells.map(ci=>cellTile[ci]), seam=own.length===2&&own[0]!==own[1];
      for(const p of [ed.a,ed.b]){const k=vk(p);let v=vmap.get(k);if(!v){v={p,cells:new Set(),seam:false};vmap.set(k,v);}ed.cells.forEach(c=>v.cells.add(c));if(seam)v.seam=true;}
    }
    const W0=WALL(P), clear=P.b+(P.sepb?depth:0)+W0.half+2;
    tiles.forEach((T,ti)=>{
      const cand=[...vmap.values()].filter(v=>{
        if(v.seam) return false; const ts=new Set([...v.cells].map(c=>cellTile[c]));
        if(ts.size!==1||!ts.has(ti)) return false;
        if(isTri(P.pat)?v.cells.size<6:v.cells.size<4) return false;
        return distEdge(...v.p)>=clear;
      });
      const cy=(T.y0+T.y1)/2+(T.y1-T.y0)*0.12, picks=[];
      for(const tx of [T.x0+(T.x1-T.x0)*0.25,T.x0+(T.x1-T.x0)*0.75]){
        let best=null,bd=1e9;
        for(const v of cand){ if(picks.some(q=>Math.hypot(q.p[0]-v.p[0],q.p[1]-v.p[1])<Math.max(40,W0.half*2+6))) continue; const d=Math.hypot(v.p[0]-tx,v.p[1]-cy); if(d<bd){bd=d;best=v;} }
        if(best) picks.push(best);
      }
      for(const v of picks){ pinPts.push(v.p); pinCells.push([...v.cells]); pinR.push([W0.sock/2,W0.sock/2+2.6]); sockets.push({p:v.p,tile:ti}); }
      T.sockets=picks.length;
    });
  }
  const K={a0:1.6,a1:3.2,d:4.5}; K.L=K.d+1.4; K.W=K.a1+1.6;
  const keyOn=new Map(keys.map(k=>[k.ed,k]));
  // half-lap seams: even tiles (checkerboard) are bases and keep the front half of the seam bar,
  // odd tiles are additions and keep the back half plus teeth that drop into notches in the base
  const parity=ti=>(tiles[ti].r+tiles[ti].c)%2;
  const lapEdges=new Set(), cuts=Lt.cells.map(()=>[]);
  if(P.lap){
    for(const ed of Lt.edges){
      if(ed.cells.length!==2) continue;
      const [t0,t1]=ed.cells.map(ci=>cellTile[ci]);
      if(t0===t1||parity(t0)===parity(t1)) continue;
      lapEdges.add(ed);
      const dx=ed.b[0]-ed.a[0], dy=ed.b[1]-ed.a[1], l=Math.hypot(dx,dy);
      for(const ci of ed.cells){
        const c=Lt.cells[ci].c; let n=[-dy/l,dx/l];
        if((c[0]-ed.a[0])*n[0]+(c[1]-ed.a[1])*n[1]<0) n=[-n[0],-n[1]];
        cuts[ci].push([[ed.a[0]+n[0]*P.gw/2,ed.a[1]+n[1]*P.gw/2],n]);
      }
    }
    for(const T of tiles) T.role=parity(tiles.indexOf(T))===0?"base":"addition";
  }
  // a cell's own area, minus the lap strips along its seam edges
  const terr=Lt.cells.map((cl,ci)=>{let p=cpoly[ci]; for(const [q,n] of cuts[ci]) p=cutHalf(p,q,n); return p;});
  const tileSetAt=new Map(), vk2=p=>Math.round(p[0]*100)+","+Math.round(p[1]*100);
  for(const ed of Lt.edges) for(const p of [ed.a,ed.b]){const k=vk2(p); if(!tileSetAt.has(k)) tileSetAt.set(k,new Set()); ed.cells.forEach(ci=>tileSetAt.get(k).add(cellTile[ci]));}

  function lapStrip(ed,own){
    const [ta,tb]=own, baseT=parity(ta)===0?ta:tb, addT=baseT===ta?tb:ta;
    const baseCell=ed.cells[own.indexOf(baseT)];
    const dx=ed.b[0]-ed.a[0], dy=ed.b[1]-ed.a[1], len=Math.hypot(dx,dy), t=[dx/len,dy/len];
    let n=[-t[1],t[0]]; const c=Lt.cells[baseCell].c;
    if((c[0]-ed.a[0])*n[0]+(c[1]-ed.a[1])*n[1]<0) n=[-n[0],-n[1]];
    const W=(s,u)=>[ed.a[0]+s*t[0]+u*n[0],ed.a[1]+s*t[1]+u*n[1]];
    const g=P.gw/2, half=P.gh/2, fc=P.fc, wall=Math.min(0.8,P.gw*0.35), td=Math.max(0.6,half-0.6);
    // where three tiles meet, stop the strip short so different tile pairs don't collide
    const junction=p=>(tileSetAt.get(vk2(p))||new Set()).size>=3;
    const s0=junction(ed.a)?g+0.3:0, s1=junction(ed.b)?len-g-0.3:len;
    if(s1-s0<2) return;
    const zone=hull(cpoly[ed.cells[0]].concat(cpoly[ed.cells[1]]));
    const rect=(sa,sb,ua,ub)=>clipConvex(ccw([W(sa,ua),W(sb,ua),W(sb,ub),W(sa,ub)]),zone);
    // teeth: two per edge, opening in opposite directions so the joint locks both ways across the seam
    const tl=Math.min(6,(s1-s0)*0.22), teeth=[];
    if(P.pins&&s1-s0>=3*tl) teeth.push({s:s0+(s1-s0)*0.3,dir:1},{s:s0+(s1-s0)*0.7,dir:-1});
    const z1=half-td;
    // snap-fit: a 0.25 mm barb, 3 layers tall, near the tooth tip; only when the wall stays printable
    const bd=0.25, bh=0.6, snap=P.snap&&wall-bd-fc>=0.35&&td>=bh+0.8, zr=z1+0.2+bh+0.1;
    pushPiece(baseT,rect(s0,s1,-g,g),0,z1,"lb");
    let cur=s0;
    const brk=[];
    for(const T of teeth){brk.push([T.s-tl/2,T.s+tl/2,T.dir]);}
    for(const [ns,ne,dir] of brk){
      if(ns>cur) pushPiece(baseT,rect(cur,ns,-g,g),z1,half,"lb");
      // notch open on the side the tooth enters from; a thin wall stays on the other side
      if(snap){
        // the wall has a shallow recess at the bottom of the notch; the tooth's barb clicks into it
        const lo=dir>0?rect(ns,ne,-g,-g+wall-bd-fc):rect(ns,ne,g-wall+bd+fc,g);
        pushPiece(baseT,lo,z1,zr,"lb");
        pushPiece(baseT,dir>0?rect(ns,ne,-g,-g+wall):rect(ns,ne,g-wall,g),zr,half,"lb");
      } else pushPiece(baseT,dir>0?rect(ns,ne,-g,-g+wall):rect(ns,ne,g-wall,g),z1,half,"lb");
      cur=ne;
    }
    if(cur<s1) pushPiece(baseT,rect(cur,s1,-g,g),z1,half,"lb");
    pushPiece(addT,rect(s0,s1,-g,g),half,P.gh,"la");
    for(const [ns,ne,dir] of brk){
      const tooth=dir>0?rect(ns+fc,ne-fc,-g+wall+fc,g):rect(ns+fc,ne-fc,-g,g-wall-fc);
      pushPiece(addT,tooth,z1+0.2,half,"la");
      if(snap){
        const inset=Math.min(0.5,(ne-ns)/4);
        const barb=dir>0?rect(ns+fc+inset,ne-fc-inset,-g+wall-bd,-g+wall+fc):rect(ns+fc+inset,ne-fc-inset,g-wall-fc,g-wall+bd);
        pushPiece(addT,barb,z1+0.2,z1+0.2+bh,"la");
      }
    }
    lapCount++; toothCount+=teeth.length;
  }
  let lapCount=0, toothCount=0;

  if(P.zig){
    for(const ed of Lt.edges){
      const own=ed.cells.map(ci=>cellTile[ci]);
      if(own.length===1||own[0]===own[1]){
        if(Lt.drawEdges) addBar(own[0],ed.a,ed.b,P.gw,P.gh,"g",P.lap?{multi:ed.cells.map(ci=>terr[ci])}:(own.length===1?cpoly[ed.cells[0]]:hull(cpoly[ed.cells[0]].concat(cpoly[ed.cells[1]]))));
      }
      else if(lapEdges.has(ed)) lapStrip(ed,own);
      else {
        // seam edge: each side prints a half-width bar on its own side of the line
        const dx=ed.b[0]-ed.a[0], dy=ed.b[1]-ed.a[1], l=Math.hypot(dx,dy);
        for(let k=0;k<2;k++){
          const c=Lt.cells[ed.cells[k]].c; let nx=-dy/l, ny=dx/l;
          if((c[0]-ed.a[0])*nx+(c[1]-ed.a[1])*ny<0){nx=-nx;ny=-ny;}
          const o=P.gw/4;
          const A=[ed.a[0]+nx*o,ed.a[1]+ny*o], B=[ed.b[0]+nx*o,ed.b[1]+ny*o], key=keyOn.get(ed);
          if(key){
            const f=(l/2-K.a1)/l, g=(l/2+K.a1)/l, pt=t=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
            addBar(own[k],A,pt(f),P.gw/2,P.gh,"h",cpoly[ed.cells[k]]);
            addBar(own[k],pt(g),B,P.gw/2,P.gh,"h",cpoly[ed.cells[k]]);
          } else addBar(own[k],A,B,P.gw/2,P.gh,"h",P.lap?terr[ed.cells[k]]:cpoly[ed.cells[k]]);
        }
      }
    }
    Lt.cells.forEach((cl,ci)=>{for(const [a,b] of cl.infill) addBar(cellTile[ci],a,b,cl.kind==="g"?P.gw:P.iw,cl.kind==="g"?P.gh:P.ih,cl.kind,P.lap?terr[ci]:cpoly[ci]);});
    // split hubs: each tile gets the part of the ring inside its own cells, plus a 1 mm front cap
    const N=32, cap=Math.min(1,P.gh/3);
    pinPts.forEach((v,pi)=>{
      const [ri,ro,ru]=pinR[pi], segs=hubSegs(P,ri,ru);
      const [x,y]=v, P2=(r,a)=>[x+r*Math.cos(a),y+r*Math.sin(a)];
      for(let k=0;k<N;k++){
        const a0=2*Math.PI*k/N, a1=2*Math.PI*(k+1)/N;
        const wedge=[[x,y],P2(ri,a0),P2(ri,a1)];
        for(const ci of pinCells[pi]){
          const ti=cellTile[ci];
          for(const [r0,z0,z1] of segs){const ring=[P2(r0,a0),P2(ro,a0),P2(ro,a1),P2(r0,a1)].reverse();
            const rr=clipConvex(ccw(ring),cpoly[ci]); if(rr.length>2&&polyArea(rr)>1e-4) tiles[ti].boxes.push({pts:rr,z0,z:z1,kind:"p"});}
          const ww=clipConvex(ccw(wedge),cpoly[ci]); if(ww.length>2&&polyArea(ww)>1e-4) tiles[ti].boxes.push({pts:ww,z0:0,z:cap,kind:"c"});
        }
      }
    });
    // bowtie key pads: each tile gets a dovetail-shaped pocket, open at the back, closed by a 1 mm front cap
    for(const k of keys){
      for(const ci of k.ed.cells){
        const c=Lt.cells[ci].c; let n=[-k.t[1],k.t[0]];
        if((c[0]-k.M[0])*n[0]+(c[1]-k.M[1])*n[1]<0) n=[-n[0],-n[1]];
        const W=(u,v)=>[k.M[0]+u*n[0]+v*k.t[0],k.M[1]+u*n[1]+v*k.t[1]];
        const ti=cellTile[ci], cp=cpoly[ci];
        const pieces=[[W(0,K.a0),W(K.d,K.a1),W(K.d,K.W),W(0,K.W)],[W(0,-K.W),W(K.d,-K.W),W(K.d,-K.a1),W(0,-K.a0)],[W(K.d,-K.W),W(K.L,-K.W),W(K.L,K.W),W(K.d,K.W)]];
        for(const pc of pieces){const r=clipConvex(ccw(pc),cp); if(r.length>2&&polyArea(r)>1e-4) tiles[ti].boxes.push({pts:r,z0:0,z:P.gh,kind:"p"});}
        const capP=clipConvex(ccw([W(0,-K.a0),W(K.d,-K.a1),W(K.d,K.a1),W(0,K.a0)]),cp);
        if(capP.length>2) tiles[ti].boxes.push({pts:capP,z0:0,z:Math.min(1,P.gh/3),kind:"c"});
      }
    }
    if(!P.sepb) for(const T of tiles){
      const {r,c,x0,x1,y0,y1}=T;
      if(c===0) T.boxes.push(rectBox(0,y0,P.b,y1,P.fh));
      if(c===L.nx-1) T.boxes.push(rectBox(P.W-P.b,y0,P.W,y1,P.fh));
      if(r===0) T.boxes.push(rectBox(x0,P.H-P.b,x1,P.H,P.fh));
      if(r===L.ny-1) T.boxes.push(rectBox(x0,0,x1,P.b,P.fh));
    }
  } else {
    for(let ti=0;ti<tiles.length;ti++){
      if(Lt.drawEdges) for(const ed of Lt.edges) addBar(ti,ed.a,ed.b,P.gw,P.gh,"g");
      for(const cl of Lt.cells) for(const [a,b] of cl.infill) addBar(ti,a,b,cl.kind==="g"?P.gw:P.iw,cl.kind==="g"?P.gh:P.ih,cl.kind);
      const T=tiles[ti],{r,c,x0,x1,y0,y1}=T;
      const wl=c===0?P.b:rail, wr=c===L.nx-1?P.b:rail, wt=r===0?P.b:rail, wb=r===L.ny-1?P.b:rail;
      T.boxes.push(rectBox(x0,y0,x0+wl,y1,P.fh),rectBox(x1-wr,y0,x1,y1,P.fh),rectBox(x0,y1-wt,x1,y1,P.fh),rectBox(x0,y0,x1,y0+wb,P.fh));
    }
  }

  for(const T of tiles){
    let a=1e9,b=-1e9,c=1e9,d=-1e9,vol=0,bars=0;
    for(const bx of T.boxes){for(const p of bx.pts){a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1]);} vol+=polyArea(bx.pts)*(bx.z-(bx.z0||0)); if(bx.kind!=="r"&&bx.kind!=="p"&&bx.kind!=="c") bars++;}
    Object.assign(T,{bx0:a,bx1:b,by0:c,by1:d,bw:b-a,bh:d-c,bars,grams:vol/1000*1.24,top:Math.max(...T.boxes.map(x=>x.z))});
    T.turn=!(T.bw<=L.ex+0.01&&T.bh<=L.ey+0.01)&&(T.bh<=L.ex+0.01&&T.bw<=L.ey+0.01);
    T.fits=(T.bw<=L.ex+0.01&&T.bh<=L.ey+0.01)||T.turn;
  }

  tiles.pins=pinPts.filter((p,i)=>!sockets.some(s=>s.p===p)); tiles.sockets=sockets; tiles.keys=keys; tiles.K=K; tiles.teeth=toothCount;
  return tiles;
}

/* ---------- separate border pieces with a one-row backing lattice ---------- */
function makeBorders(P,Lt,pegPts,sockets){
  if(!P.sepb) return [];
  const {W,H,b}=P, tri=isTri(P.pat), depth=(tri?P.cell*Math.sqrt(3)/2:P.cell)+P.gw;
  const zf0=P.gh, zf1=P.gh+P.bt;
  // floating mount: the frame is deep enough to hide a hook lip behind the lattice
  const C=cleatDims(P), Wd=WALL(P), bh=P.mount?Math.max(P.fh,zf1+C.lipT+C.clr+2):P.wall?(P.flt>0?Wd.fd:Math.max(Wd.zw,zf1)):Math.max(P.fh,zf1);
  const ex=P.bx-2*P.mg, ey=P.by-2*P.mg, maxL=Math.max(ex,ey);
  const fits=(w,h)=>(w<=ex&&h<=ey)||(w<=ey&&h<=ex);
  const strips=[ // [name, outer rect, flange band rect, along-x?]
    ["T",[0,H-b,W,H],[b,H-b-depth,W-b,H-b+0.5],true],
    ["B",[0,0,W,b],[b,b-0.5,W-b,b+depth],true],
    ["L",[0,b,b,H-b],[b-0.5,b+depth,b+depth,H-b-depth],false],
    ["R",[W-b,b,W,H-b],[W-b-depth,b+depth,W-b+0.5,H-b-depth],false]];
  const segs=[];
  if(Lt.drawEdges) for(const ed of Lt.edges) segs.push([ed.a,ed.b]);
  if(P.pat==="kikko") for(const cl of Lt.cells) for(const sg of cl.infill) segs.push(sg);
  const pieces=[];
  for(const [nm,o,f,ax] of strips){
    const len=ax?o[2]-o[0]:o[3]-o[1];
    let k=Math.ceil(len/maxL); while(k<20&&!fits(len/k,b+depth)) k++;
    for(let i=0;i<k;i++){
      const lo=(ax?o[0]:o[1])+len*i/k, hi=(ax?o[0]:o[1])+len*(i+1)/k;
      const R=ax?[lo,o[1],hi,o[3]]:[o[0],lo,o[2],hi];
      const boxes=[rectBox(R[0],R[1],R[2],R[3],bh)]; let pegs=0; const myPegs=[], feet=[];
      // flange stays inside this piece's span, inset at joints so neighbouring flanges don't touch
      const F=ax?[Math.max(f[0],lo+(i?0.2:0)),f[1],Math.min(f[2],hi-(i<k-1?0.2:0)),f[3]]:[f[0],Math.max(f[1],lo+(i?0.2:0)),f[2],Math.min(f[3],hi-(i<k-1?0.2:0))];
      if(F[2]>F[0]&&F[3]>F[1]){
        const fr=ccwRect(F);
        for(const [a,c] of segs){
          const cut=clipConvex(barBox(a,c,P.gw,0,"f").pts,fr);
          if(cut.length>2&&polyArea(cut)>0.01) boxes.push({pts:cut,z0:zf0,z:zf1,kind:"f"});
        }
        // a thin rail along the inner edge ties the flange bars together
        const rw=P.gw;
        const rail=nm==="T"?[F[0],F[1],F[2],F[1]+rw]:nm==="B"?[F[0],F[3]-rw,F[2],F[3]]:nm==="L"?[F[2]-rw,F[1],F[2],F[3]]:[F[0],F[1],F[0]+rw,F[3]];
        boxes.push({pts:ccwRect(rail),z0:zf0,z:zf1,kind:"f"});
        // connect flange to the border bar
        const tie=nm==="T"?[F[0],H-b-0.5,F[2],H-b+0.5]:nm==="B"?[F[0],b-0.5,F[2],b+0.5]:nm==="L"?[b-0.5,F[1],b+0.5,F[3]]:[W-b-0.5,F[1],W-b+0.5,F[3]];
        boxes.push({pts:ccwRect(tie),z0:zf0,z:zf1,kind:"f"});
        // pegs: drop from the backing lattice into the holes in the outer tiles, locking border to grid without glue
        const ro=P.hub/2, rp=(P.pin-P.fc)/2;
        for(const q of pegPts){
          if(q[0]<F[0]+ro||q[0]>F[2]-ro||q[1]<F[1]+ro||q[1]>F[3]-ro) continue;
          boxes.push(...snapPegBoxes(q[0],q[1],rp,P,SNAP(P).z0,zf0,zf1)); pegs++; myPegs.push(q);
        }
      }
      // hidden feet (wall-peg mode): the frame mounts to the wall on its own, behind the outer tiles.
      // Float = 0: feet are part of the frame; pop out an outer tile and screw through the foot.
      // Float > 0: the frame stops short of the wall (LED gap). Feet print separately as standoffs: screw them
      // to the wall, then the frame snaps onto them with the same barb latch as the tiles. The screw sits inside
      // the standoff, under the frame, so nothing shows.
      if(P.wall&&F[2]>F[0]&&F[3]>F[1]){
        const CV=COVE(P), outIn=CV.on?CV.off+CV.gW+0.5:1, pegOff=CV.on?(CV.off+CV.gW+b)/2:b/2;
        const R0=Wd.footR, cin=b+Wd.footIn, along=ax?[F[0]+R0+0.5,F[2]-R0-0.5]:[F[1]+R0+0.5,F[3]-R0-0.5];
        const L0=along[1]-along[0], targets=L0<=0?[]:(L0>110?[along[0]+L0*0.2,along[1]-L0*0.2]:[(along[0]+along[1])/2]);
        const footAt=s=>{
          const c=nm==="T"?[s,H-cin]:nm==="B"?[s,cin]:nm==="L"?[cin,s]:[W-cin,s];
          const rect=nm==="T"?[s-R0,H-cin-R0,s+R0,H-outIn]:nm==="B"?[s-R0,outIn,s+R0,cin+R0]:nm==="L"?[outIn,s-R0,cin+R0,s+R0]:[W-cin-R0,s-R0,W-outIn,s+R0];
          const pegs=[-4,4].map(d=>nm==="T"?[s+d,H-pegOff]:nm==="B"?[s+d,pegOff]:nm==="L"?[pegOff,s+d]:[W-pegOff,s+d]);
          return {c,rect,pegs};
        };
        const hitsRect=(r,q)=>!(r[2]<q[0]||q[2]<r[0]||r[3]<q[1]||q[3]<r[1]);
        const ok=f=>sockets.every(k=>!hitsRect(f.rect,[k.p[0]-19,k.p[1]-13,k.p[0]+19,k.p[1]+13]))&&myPegs.every(q=>!hitsRect(f.rect,[q[0]-P.hub/2-1,q[1]-P.hub/2-1,q[0]+P.hub/2+1,q[1]+P.hub/2+1]))&&feet.every(g=>Math.hypot(g.c[0]-f.c[0],g.c[1]-f.c[1])>2*R0+4);
        for(const t of targets){
          for(let d=0;d<=80;d+=2){let done=false;
            for(const s of d?[t+d,t-d]:[t]){ if(s<along[0]||s>along[1]) continue; const f=footAt(s); if(!ok(f)) continue;
              feet.push(f); done=true; break;}
            if(done) break;}
        }
        const cbH=Wd.cb/2+0.3, hH=Wd.hole/2+0.1;
        for(const f of feet){
          const [cx,cy]=f.c, sqC=[cx-cbH,cy-cbH,cx+cbH,cy+cbH], sqH=[cx-hH,cy-hH,cx+hH,cy+hH];
          if(!(P.flt>0)){
            // integral foot: open the screw column through the backing lattice, then build the block to the wall
            for(let bi=boxes.length-1;bi>=1;bi--){const bx=boxes[bi]; if(bx.kind!=="f") continue; const parts=polyMinusSq(bx.pts,sqC); boxes.splice(bi,1,...parts.map(pts=>({pts,z0:bx.z0,z:bx.z,kind:"f"})));}
            for(const r of rectMinus(f.rect,sqC)) boxes.push({pts:ccwRect(r),z0:zf0,z:zf0+Wd.cbD,kind:"ft"});
            for(const r of rectMinus(f.rect,sqH)) boxes.push({pts:ccwRect(r),z0:zf0+Wd.cbD,z:Wd.zw,kind:"ft"});
          } else {
            // standoff: block from the frame back (bh) to the wall, counterbore at its top, two snap pegs up into the frame bar
            const fb=[], S=SNAP(P), cF=1, rp=(P.pin-P.fc)/2, tip=cF+0.3;
            for(const r of rectMinus(f.rect,sqC)) fb.push({pts:ccwRect(r),z0:bh,z:bh+Wd.cbD,kind:"so"});
            for(const r of rectMinus(f.rect,sqH)) fb.push({pts:ccwRect(r),z0:bh+Wd.cbD,z:Wd.zw,kind:"so"});
            for(const q of f.pegs){
              const [x,y]=q;
              if(S.on){
                fb.push({pts:ccwRect([x-rp,y-rp,x-S.s/2,y+rp]),z0:tip,z:bh,kind:"sp"},{pts:ccwRect([x+S.s/2,y-rp,x+rp,y+rp]),z0:tip,z:bh,kind:"sp"});
                fb.push({pts:ccwRect([x-rp-S.bd,y-rp,x-S.s/2,y+rp]),z0:tip,z:tip+S.bh,kind:"sp"},{pts:ccwRect([x+S.s/2,y-rp,x+rp+S.bd,y+rp]),z0:tip,z:tip+S.bh,kind:"sp"});
              } else fb.push({pts:ccwRect([x-rp,y-rp,x+rp,y+rp]),z0:tip,z:bh,kind:"sp"});
            }
            f.boxes=fb;
          }
        }
        const pegsIn=P.flt>0?feet.flatMap(f=>f.pegs):[];
        if(pegsIn.length||CV.on){
          // frame bar, rebuilt in layers: snap sockets for the standoff pegs (blind from the back, undercut near
          // the front cap) and the LED cove (open to the wall, running the full length and turning the corners)
          const S=SNAP(P), cF=1, ri=P.pin/2, ru=S.on?(P.pin-P.fc)/2+S.bd+0.1:ri, uz=S.on?cF+0.3+S.bh+0.1:cF;
          const grooves=[];
          if(CV.on){
            const o=CV.off, g=CV.gW;
            if(nm==="T"){grooves.push([R[0],H-o-g,R[2],H-o]); if(lo<1)grooves.push([o,H-b,o+g,H-o]); if(hi>W-1)grooves.push([W-o-g,H-b,W-o,H-o]);}
            if(nm==="B"){grooves.push([R[0],o,R[2],o+g]); if(lo<1)grooves.push([o,o,o+g,b]); if(hi>W-1)grooves.push([W-o-g,o,W-o,b]);}
            if(nm==="L") grooves.push([o,R[1],o+g,R[3]]);
            if(nm==="R") grooves.push([W-o-g,R[1],W-o,R[3]]);
          }
          const zg=bh-CV.gD, zs=[...new Set([0,cF,uz,CV.on?zg:bh,bh].filter(z=>z>=0&&z<=bh))].sort((a,b)=>a-b);
          const RR=[R[0],R[1],R[2],R[3]], layers=[];
          for(let i=0;i+1<zs.length;i++){
            const z0=zs[i], z1=zs[i+1], zm=(z0+z1)/2; if(z1-z0<1e-6) continue;
            let L=[RR];
            const h=zm<cF?0:zm<uz?ru:ri;
            if(h) for(const q of pegsIn){const sq=[q[0]-h,q[1]-h,q[0]+h,q[1]+h];L=L.flatMap(r=>rectMinus(r,sq));}
            if(CV.on&&zm>zg) for(const gq of grooves) L=L.flatMap(r=>rectMinus(r,gq));
            for(const r of L) layers.push({pts:ccwRect(r),z0,z:z1,kind:"r"});
          }
          boxes.splice(0,1,...layers);
        }
      }
      // hidden hook: a lip hanging down from the top border, flush with the wall side, that drops behind a wall cleat
      let hook=null;
      if(P.mount&&nm==="T"){
        const cx=(lo+hi)/2, hw=Math.min(C.hookW/2,(hi-lo)/2-P.b-2);
        if(hw>8){
          boxes.push({pts:ccwRect([cx-hw,C.lipBottom(H,b),cx+hw,H-b+0.5]),z0:bh-C.lipT,z:bh,kind:"hk"});
          hook={x:cx};
        }
      }
      let a=1e9,bb=-1e9,c=1e9,d=-1e9,vol=0;
      for(const bx of boxes){for(const q of bx.pts){a=Math.min(a,q[0]);bb=Math.max(bb,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}vol+=polyArea(bx.pts)*(bx.z-bx.z0);}
      const bw=bb-a, bhh=d-c, topZ=Math.max(bh,...boxes.map(x=>x.z)), turn=!(bw<=ex&&bhh<=ey)&&(bhh<=ex&&bw<=ey);
      pieces.push({name:`Border ${nm}${k>1?i+1:""}`,pegs,hook,feet,boxes,bx0:a,by0:c,bw,bh:bhh,top:topZ,turn,fits:(bw<=ex&&bhh<=ey)||turn,grams:vol/1000*1.24});
    }
  }
  return pieces;
}
function cleatDims(P){
  // all in mm. r = height up the wall from the cleat's bottom, d = distance out from the wall
  const D={plateH:20,plateT:3,stepR:14,stepT:9,lipTop:28,lipT:5.5,clr:0.5,drop:30,len:60,hookW:44,screwR:6,screwDx:20,hole:4.5};
  D.lipBottom=(H,b)=>H-b-D.drop;            // where the hook's bottom edge sits on the panel
  D.cleatBottom=(H,b)=>H-b-D.drop-D.plateH;  // cleat bottom, in panel coordinates
  return D;
}
function cleatTris(n,P){
  // printed on its side: the cross-section lies on the bed and the cleat's length is the print height
  const C=cleatDims(P), out=[], L=C.len, g=C.lipT+C.clr; // slot between cleat lip and wall
  const lipD0=g, lipD1=g+3; // cleat's front lip sits in front of the hook
  const stepD=lipD1;
  const holes=[L/2-C.screwDx,L/2+C.screwDx];
  for(let i=0;i<n;i++){
    const ox=i*(C.lipTop+12);
    const R=(r0,d0,r1,d1)=>[[ox+r0,d0],[ox+r1,d0],[ox+r1,d1],[ox+r0,d1]];
    // plate on the wall, with two square screw holes through it
    const cuts=[0]; holes.forEach(h=>cuts.push(h-C.hole/2,h+C.hole/2)); cuts.push(L);
    for(let k=0;k<cuts.length-1;k++){
      const x0=cuts[k],x1=cuts[k+1], inHole=k%2===1;
      if(inHole){ boxTris(R(0,0,C.screwR-C.hole/2,C.plateT),x0,x1,out); boxTris(R(C.screwR+C.hole/2,0,C.plateH,C.plateT),x0,x1,out); }
      else boxTris(R(0,0,C.plateH,C.plateT),x0,x1,out);
    }
    boxTris(R(C.stepR,C.plateT,C.plateH,stepD),0,L,out);   // standoff step
    boxTris(R(C.stepR,lipD0,C.lipTop,lipD1),0,L,out);     // upturned lip
  }
  return out;
}
/* ---------- wall pucks: the swappable mount ---------- */
function WALL(P){
  // T = gap between wall and tile back (sets the float); peg goes into the tile's hidden socket
  // zw = wall plane, measured back from the panel face. Float > 0 lifts the frame off the wall for LED backlight;
  // hidden feet at each anchor reach back to the wall and hide the screws.
  const cap=Math.min(1,P.gh/3), fd=Math.max(P.fh,P.gh+P.bt), zw=P.flt>0?fd+P.flt:Math.max(P.gh+5,P.fh);
  const T=zw-P.gh, sock=8;
  return {T,zw,fd,sock,cap,pegL:Math.max(2,P.gh-cap-0.5),w:36,h:24,half:Math.hypot(18,12),hole:4.5,cb:9,cbD:3.2,dx:11,plateT:T>5.5?5:T,footR:8,footIn:5.3};
}
function puckTris(n,P){
  const Wd=WALL(P), out=[], fc=P.fc, gap=6;
  const xs=[-18,-Wd.dx-Wd.cb/2,-Wd.dx-Wd.hole/2,-Wd.dx+Wd.hole/2,-Wd.dx+Wd.cb/2,Wd.dx-Wd.cb/2,Wd.dx-Wd.hole/2,Wd.dx+Wd.hole/2,Wd.dx+Wd.cb/2,18];
  const ys=[-12,-Wd.cb/2,-Wd.hole/2,Wd.hole/2,Wd.cb/2,12];
  const per=Math.max(1,Math.floor((P.bx-2*P.mg)/(Wd.w+gap)));
  for(let i=0;i<n;i++){
    const ox=(i%per)*(Wd.w+gap)+18, oy=Math.floor(i/per)*(Wd.h+gap)+12;
    for(let a=0;a<xs.length-1;a++)for(let b=0;b<ys.length-1;b++){
      const x0=xs[a],x1=xs[a+1],y0=ys[b],y1=ys[b+1],cx=(x0+x1)/2,cy=(y0+y1)/2;
      const inCb=Math.min(Math.abs(cx-Wd.dx),Math.abs(cx+Wd.dx))<Wd.cb/2&&Math.abs(cy)<Wd.cb/2;
      const inHole=Math.min(Math.abs(cx-Wd.dx),Math.abs(cx+Wd.dx))<Wd.hole/2&&Math.abs(cy)<Wd.hole/2;
      if(inHole) continue;
      boxTris([[ox+x0,oy+y0],[ox+x1,oy+y0],[ox+x1,oy+y1],[ox+x0,oy+y1]],0,inCb?Wd.plateT-Wd.cbD:Wd.plateT,out);
    }
    if(Wd.T>Wd.plateT) boxTris([[ox-6,oy-6],[ox+6,oy-6],[ox+6,oy+6],[ox-6,oy+6]],Wd.plateT,Wd.T,out);
    // peg, printed pointing up from the puck's front face
    const r=(Wd.sock-fc)/2, c=[]; for(let k=0;k<32;k++){const t=2*Math.PI*k/32;c.push([ox+r*Math.cos(t),oy+r*Math.sin(t)]);}
    boxTris(c,Wd.T,Wd.T+Wd.pegL,out);
  }
  return out;
}
function allFeet(){return (model.borders||[]).flatMap(b=>(b.feet||[]).map(f=>({...f,piece:b.name})));}
function standoffTris(P){
  // each frame standoff prints wall side down; pegs point up
  const Wd=WALL(P), out=[], feet=allFeet().filter(f=>f.boxes), gap=6, ex=P.bx-2*P.mg;
  let x=0,y=0,row=0;
  for(const f of feet){
    const w=f.rect[2]-f.rect[0]+2, h=f.rect[3]-f.rect[1]+2;
    if(x+w>ex){x=0;y+=row+gap;row=0;}
    const ox=x-f.rect[0]+1, oy=y-f.rect[1]+1;
    for(const b of f.boxes) boxTris(b.pts.map(p=>[p[0]+ox,p[1]+oy]),Wd.zw-b.z,Wd.zw-b.z0,out);
    x+=w+gap; row=Math.max(row,h);
  }
  return out;
}
function pegTemplateSVG(){
  const {P,tiles,sockets}=model, Wd=WALL(P), m=20;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${P.W+2*m} ${P.H+2*m+30}" width="${P.W+2*m}mm" height="${P.H+2*m+30}mm"><rect x="${-m}" y="${-m}" width="${P.W+2*m}" height="${P.H+2*m+30}" fill="#fff"/>`;
  s+=`<rect x="0" y="0" width="${P.W}" height="${P.H}" fill="none" stroke="#888" stroke-dasharray="6 4"/>`;
  s+=`<text x="${P.W/2}" y="-6" font-family="sans-serif" font-size="8" text-anchor="middle">Top edge of panel — level this line</text>`;
  for(const k of sockets){
    const cx=k.p[0], cy=P.H-k.p[1];
    s+=`<rect x="${(cx-18).toFixed(1)}" y="${(cy-12).toFixed(1)}" width="36" height="24" fill="none" stroke="#2F4B7C" stroke-width="0.4"/>`;
    s+=`<text x="${cx.toFixed(1)}" y="${(cy+17).toFixed(1)}" font-family="sans-serif" font-size="4" text-anchor="middle">${tiles[k.tile].name}</text>`;
    for(const dx of [-Wd.dx,Wd.dx]){const x=cx+dx;
      s+=`<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.2" fill="#C00"/><line x1="${x-5}" y1="${cy}" x2="${x+5}" y2="${cy}" stroke="#C00" stroke-width="0.3"/><line x1="${x}" y1="${cy-5}" x2="${x}" y2="${cy+5}" stroke="#C00" stroke-width="0.3"/>`;}
  }
  for(const f of allFeet()){
    const [cx,cy0]=f.c, cy=P.H-cy0, r=f.rect;
    s+=`<rect x="${r[0].toFixed(1)}" y="${(P.H-r[3]).toFixed(1)}" width="${(r[2]-r[0]).toFixed(1)}" height="${(r[3]-r[1]).toFixed(1)}" fill="none" stroke="#B45F06" stroke-width="0.4"/>`;
    s+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.2" fill="#B45F06"/><line x1="${cx-5}" y1="${cy}" x2="${cx+5}" y2="${cy}" stroke="#B45F06" stroke-width="0.3"/><line x1="${cx}" y1="${cy-5}" x2="${cx}" y2="${cy+5}" stroke="#B45F06" stroke-width="0.3"/>`;
  }
  const nf=allFeet().length;
  s+=`<text x="0" y="${P.H+16}" font-family="sans-serif" font-size="6">Print at 100% (actual size). Red crosses: drill, then screw a tile puck over each blue box, peg pointing out.</text>`;
  if(nf) s+=`<text x="0" y="${P.H+25}" font-family="sans-serif" font-size="6">Orange crosses (${nf}): frame screws. ${P.flt>0?"Screw a frame standoff over each orange box first, pegs pointing out.":"Drill now; drive the screws through the frame's hidden feet after the frame is up."}</text>`;
  return s+"</svg>";
}

/* ---------- test kit: small coupons that check fit before a full print ---------- */
const TEST_FITS=[0.05,0.10,0.15,0.20];
function lapCoupon(P,fc){
  // one straight 40 mm seam with two teeth, built exactly like a frame seam
  const L=40, g=P.gw/2, half=P.gh/2, wall=Math.min(0.8,P.gw*0.35), td=Math.max(0.6,half-0.6), z1=half-td;
  const bd=0.25, bh=0.6, snap=P.snap&&wall-bd-fc>=0.35&&td>=bh+0.8, zr=z1+0.2+bh+0.1;
  const R=(s0,s1,u0,u1)=>[[s0,u0],[s1,u0],[s1,u1],[s0,u1]];
  const base=[], add=[], tl=6, teeth=[[12,1],[28,-1]];
  base.push({pts:R(0,L,-g,g),z0:0,z:z1});
  let cur=0;
  for(const [c,dir] of teeth){
    const ns=c-tl/2, ne=c+tl/2;
    base.push({pts:R(cur,ns,-g,g),z0:z1,z:half});
    if(snap){
      base.push({pts:dir>0?R(ns,ne,-g,-g+wall-bd-fc):R(ns,ne,g-wall+bd+fc,g),z0:z1,z:zr});
      base.push({pts:dir>0?R(ns,ne,-g,-g+wall):R(ns,ne,g-wall,g),z0:zr,z:half});
    } else base.push({pts:dir>0?R(ns,ne,-g,-g+wall):R(ns,ne,g-wall,g),z0:z1,z:half});
    cur=ne;
    add.push({pts:dir>0?R(ns+fc,ne-fc,-g+wall+fc,g):R(ns+fc,ne-fc,-g,g-wall-fc),z0:z1+0.2,z:half});
    if(snap){const inset=Math.min(0.5,tl/4); add.push({pts:dir>0?R(ns+fc+inset,ne-fc-inset,-g+wall-bd,-g+wall+fc):R(ns+fc+inset,ne-fc-inset,g-wall-fc,g-wall+bd),z0:z1+0.2,z:z1+0.2+bh});}
  }
  base.push({pts:R(cur,L,-g,g),z0:z1,z:half});
  add.push({pts:R(0,L,-g,g),z0:half,z:P.gh});
  // a full-height grip block on each side, so the coupon is easy to hold and behaves like a tile
  base.push({pts:R(0,L,g,g+12),z0:0,z:P.gh});
  add.push({pts:R(0,L,-g-12,-g),z0:0,z:P.gh});
  return {base,add};
}
function dots(n,x0,y0,z0,z1){
  const out=[];
  for(let k=0;k<n;k++){const cx=x0+k*4, cy=y0, c=[];for(let a=0;a<12;a++){const t=2*Math.PI*a/12;c.push([cx+1.1*Math.cos(t),cy+1.1*Math.sin(t)]);}out.push({pts:c,z0,z:z1});}
  return out;
}
function testKit(P){
  const files={};
  // lap testers: bases print face down, additions print flipped like the real tiles
  if(P.lap){
    const bt=[], at=[];
    TEST_FITS.forEach((fc,i)=>{
      const {base,add}=lapCoupon(P,fc), oy=i*(P.gw+30);
      for(const b of base) boxTris(b.pts.map(p=>[p[0],p[1]+oy]),b.z0,b.z,bt);
      for(const d of dots(i+1,4,P.gw/2+6+oy,P.gh,P.gh+0.8)) boxTris(d.pts,d.z0,d.z,bt);
      // flip additions: z' = top - z, mirror y so it prints back side down
      const top=P.gh;
      for(const b of add) boxTris(b.pts.map(p=>[p[0],-(p[1])+oy]),top-b.z,top-b.z0,at);
      for(const d of dots(i+1,4,P.gw/2+6+oy,0,0.8)) boxTris(d.pts,top,top+0.8,at);
    });
    files["test_lap_bases.stl"]=stl(bt,"lap bases"); files["test_lap_additions.stl"]=stl(at,"lap additions");
  }
  // peg tester: four hubs with blind holes, and a strip with four pegs, one per fit
  if(P.pins&&P.sepb){
    const ro=P.hub/2, ri=P.pin/2, cap=Math.min(1,P.gh/3), ht=[], pt=[], N=24;
    TEST_FITS.forEach((fc,i)=>{
      const cx=6+i*(P.hub+6), cy=ro;
      const ru=SNAP(P).on?(P.pin-fc)/2+SNAP(P).bd+0.1:0;
      for(let k=0;k<N;k++){const a0=2*Math.PI*k/N,a1=2*Math.PI*(k+1)/N,Q=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
        for(const [r0,z0,z1] of hubSegs(P,ri,ru)) boxTris([Q(r0,a0),Q(ro,a0),Q(ro,a1),Q(r0,a1)],z0,z1,ht); boxTris([[cx,cy],Q(ri,a0),Q(ri,a1)],0,cap,ht);}
      if(i<3) boxTris([[cx+ro-0.5,cy-1.5],[cx+P.hub+6-ro+0.5,cy-1.5],[cx+P.hub+6-ro+0.5,cy+1.5],[cx+ro-0.5,cy+1.5]],0,P.gh,ht);
      for(const d of dots(i+1,cx-((i)*2),cy+ro+3,0,0.8)) boxTris(d.pts,0,0.8,ht);
      // peg strip printed flange down: flange 0..bt, peg rises from it
      const rp=(P.pin-fc)/2, zf1=P.gh+P.bt;
      for(const b of snapPegBoxes(cx,cy,rp,P,SNAP(P).z0,P.gh,zf1)) boxTris(b.pts,zf1-b.z,zf1-b.z0,pt);
      for(const d of dots(i+1,cx-((i)*2),cy+ro+3,P.bt,P.bt+0.8)) boxTris(d.pts,d.z0,d.z,pt);
    });
    const w=6+3*(P.hub+6)+ro+6;
    boxTris([[0,-1],[w,-1],[w,P.hub+8],[0,P.hub+8]],0,P.bt,pt);
    files["test_peg_holes.stl"]=stl(ht,"peg holes"); files["test_pegs.stl"]=stl(pt,"pegs");
  }
  // wall cleat tester: a 25 mm cleat and a hook block cut from a top border
  if(P.mount){
    const C=cleatDims(P), out=[];
    const L=25, g=C.lipT+C.clr, R=(r0,d0,r1,d1)=>[[r0,d0],[r1,d0],[r1,d1],[r0,d1]];
    boxTris(R(0,0,C.plateH,C.plateT),0,L,out); boxTris(R(C.stepR,C.plateT,C.plateH,g+3),0,L,out); boxTris(R(C.stepR,g,C.lipTop,g+3),0,L,out);
    files["test_cleat.stl"]=stl(out,"cleat");
    const zf1=P.gh+P.bt, bh=Math.max(P.fh,zf1+C.lipT+C.clr+2), hb=[];
    // border block (b deep in y) + hook lip; printed back side down so the hook is on the bed
    const H=P.b+C.drop, map=pts=>pts.map(p=>[p[0],H-p[1]]);
    boxTris(map([[0,H-P.b],[25,H-P.b],[25,H],[0,H]]),0,bh,hb);
    boxTris(map([[0,H-P.b-C.drop],[25,H-P.b-C.drop],[25,H-P.b+0.5],[0,H-P.b+0.5]]),0,C.lipT,hb);
    files["test_hook.stl"]=stl(hb,"hook");
  }
  // wall socket tester: four tile sockets and four pucks, one per fit
  if(P.wall){
    const Wd=WALL(P), ri=Wd.sock/2, ro=ri+2.6, ht=[], N=32;
    TEST_FITS.forEach((fc,i)=>{
      const cx=ro+2+i*(2*ro+6), cy=ro;
      for(let k=0;k<N;k++){const a0=2*Math.PI*k/N,a1=2*Math.PI*(k+1)/N,Q=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
        boxTris([Q(ri,a0),Q(ro,a0),Q(ro,a1),Q(ri,a1)],0,P.gh,ht); boxTris([[cx,cy],Q(ri,a0),Q(ri,a1)],0,Wd.cap,ht);}
      if(i<3) boxTris([[cx+ro-0.5,cy-1.5],[cx+ro+6.5,cy-1.5],[cx+ro+6.5,cy+1.5],[cx+ro-0.5,cy+1.5]],0,P.gh,ht);
      for(const d of dots(i+1,cx-i*2,cy+ro+3,0,0.8)) boxTris(d.pts,0,0.8,ht);
    });
    files["test_wall_sockets.stl"]=stl(ht,"wall sockets");
    const pk=[];
    TEST_FITS.forEach((fc,i)=>{ const one=puckTris(1,{...P,fc}); const ox=i*42; for(const [a,b2,c] of one) pk.push([[a[0]+ox,a[1],a[2]],[b2[0]+ox,b2[1],b2[2]],[c[0]+ox,c[1],c[2]]]);
      for(const d of dots(i+1,ox+4,3,Wd.plateT,Wd.plateT+0.8)) boxTris(d.pts,d.z0,d.z,pk); });
    files["test_wall_pucks.stl"]=stl(pk,"wall pucks");
  }
  files["TEST_KIT_README.txt"]=`TEST KIT — print these before a full frame (one plate, under an hour, about 15 g).

Dots mark the fit clearance: 1 dot = 0.05 mm, 2 = 0.10, 3 = 0.15, 4 = 0.20. Pick the best one and set Fit clearance to that value.

1. Lap joint (test_lap_bases.stl + test_lap_additions.stl)
   Pair each base with the addition that has the same number of dots. Press the addition onto the base from its back.
   Best fit: firm thumb pressure, a clear click, no wobble, and it won't pull straight off. Set Fit clearance to that value.
   Too hard to close = clearance too small. Loose or no click = too big.
2. Pegs (test_peg_holes.stl + test_pegs.stl)
   Push each peg into the hub with the same number of dots. Best fit: snug, goes in by hand, doesn't drop out upside down.
3. Wall pucks (test_wall_pucks.stl + test_wall_sockets.stl), if you use the swappable wall mount
   Push each socket onto the puck peg with the same dots. Best fit: slides on by hand, holds its weight upside down, pulls off without tools.
4. Wall cleat (test_cleat.stl + test_hook.stl), if you use the hidden cleat
   Hold the cleat flat on a table, lip up. Lower the hook block onto it: the hook should drop behind the lip with a little play, and lift out only by raising it about 8 mm first.

Print settings: same as the frame — 0.2 mm layers, 0.4 nozzle, PLA or PETG. Bases face down, everything else as exported (already oriented).
`;
  return files;
}
function wallTemplateSVG(){
  const {P,borders}=model, C=cleatDims(P), hooks=borders.filter(b=>b.hook);
  const yTop=0, cb=P.H-C.cleatBottom(P.H,P.b); // distance from panel top down to cleat bottom
  const m=20;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${P.W+2*m} ${P.H+2*m+30}" width="${P.W+2*m}mm" height="${P.H+2*m+30}mm"><rect x="${-m}" y="${-m}" width="${P.W+2*m}" height="${P.H+2*m+30}" fill="#fff"/>`;
  s+=`<rect x="0" y="0" width="${P.W}" height="${P.H}" fill="none" stroke="#888" stroke-dasharray="6 4"/>`;
  s+=`<text x="${P.W/2}" y="-6" font-family="sans-serif" font-size="8" text-anchor="middle">Top edge of panel — level this line</text>`;
  for(const h of hooks){
    const x0=h.hook.x-C.len/2, y0=cb-C.plateH;
    s+=`<rect x="${x0.toFixed(1)}" y="${(P.H-C.cleatBottom(P.H,P.b)-C.lipTop).toFixed(1)}" width="${C.len}" height="${C.lipTop}" fill="none" stroke="#2F4B7C"/>`;
    for(const dx of [-C.screwDx,C.screwDx]){
      const cx=h.hook.x+dx, cy=cb-C.screwR;
      s+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.2" fill="#C00"/><line x1="${cx-5}" y1="${cy}" x2="${cx+5}" y2="${cy}" stroke="#C00" stroke-width="0.3"/><line x1="${cx}" y1="${cy-5}" x2="${cx}" y2="${cy+5}" stroke="#C00" stroke-width="0.3"/>`;
    }
    s+=`<text x="${h.hook.x.toFixed(1)}" y="${(cb+8).toFixed(1)}" font-family="sans-serif" font-size="5" text-anchor="middle">Cleat, ${h.hook.x.toFixed(0)} mm from left edge</text>`;
  }
  s+=`<text x="0" y="${P.H+16}" font-family="sans-serif" font-size="6">Print at 100% (actual size). Drill the red crosses. Screw holes sit ${(cb-C.screwR).toFixed(0)} mm below the panel's top edge.</text>`;
  return s+"</svg>";
}
function ccwRect(r){return [[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]];}
function rectMinus(R,H){
  const x0=Math.max(R[0],H[0]),x1=Math.min(R[2],H[2]),y0=Math.max(R[1],H[1]),y1=Math.min(R[3],H[3]);
  if(x0>=x1||y0>=y1) return [R];
  const o=[]; if(R[0]<x0)o.push([R[0],R[1],x0,R[3]]); if(x1<R[2])o.push([x1,R[1],R[2],R[3]]);
  if(R[1]<y0)o.push([x0,R[1],x1,y0]); if(y1<R[3])o.push([x0,y1,x1,R[3]]); return o;
}
function polyMinusSq(pts,H){
  // convex polygon minus an axis-aligned square: up to four convex pieces
  const B=1e5, out=[];
  for(const r of [[-B,-B,H[0],B],[H[2],-B,B,B],[H[0],-B,H[2],H[1]],[H[0],H[3],H[2],B]]){const c=clipConvex(pts,ccwRect(r)); if(c.length>2&&polyArea(c)>1e-4) out.push(c);}
  return out;
}
/* ---------- LED cove: a channel in the back of the frame bar; the strip sits in it facing the wall ---------- */
function COVE(P){
  const off=1.6, gW=P.lw+0.6, gD=3, ru=P.pin/2+0.35, need=off+gW+2*(ru+1.0), fd=Math.max(P.fh,P.gh+P.bt);
  const want=P.cove&&P.wall&&P.sepb&&P.flt>0;
  return {want,on:want&&P.b>=need&&fd-gD>=3,off,gW,gD,need,depthNeed:gD+3};
}
/* ---------- snap pegs: same click-lock as the lap teeth (0.25 mm barb, 0.6 mm tall) ---------- */
function SNAP(P){const cap=Math.min(1,P.gh/3); return {on:P.snap&&P.pin>=2.5&&P.gh-cap>=3,bd:0.25,bh:0.6,s:0.8,cap,z0:cap+0.3};}
function circ(cx,cy,r,N=24){const c=[];for(let k=0;k<N;k++){const a=2*Math.PI*k/N;c.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return c;}
function snapPegBoxes(cx,cy,rp,P,z0,zs,z1){
  // split peg: two prongs (slot 0.8 mm) from the tip back to zs, solid from zs to z1, barb ring at the tip
  const S=SNAP(P), B=1e5, out=[];
  if(!S.on){out.push({pts:circ(cx,cy,rp),z0,z:z1,kind:"g"});return out;}
  for(const half of [[-B,-B,cx-S.s/2,B],[cx+S.s/2,-B,B,B]]){
    const pr=clipConvex(circ(cx,cy,rp),ccwRect(half)); if(pr.length>2) out.push({pts:pr,z0,z:zs,kind:"g"});
    const bb=clipConvex(circ(cx,cy,rp+S.bd),ccwRect(half)); if(bb.length>2) out.push({pts:bb,z0,z:z0+S.bh,kind:"g"});
  }
  out.push({pts:circ(cx,cy,rp),z0:zs,z:z1,kind:"g"});
  return out;
}
function hubSegs(P,ri,ru){
  // [inner radius, z0, z1] layers of a hub ring; the undercut is the pocket the barb clicks into
  const S=SNAP(P), cap=S.cap;
  if(!(ru>ri)) return [[ri,0,P.gh]];
  const uz=S.z0+S.bh+0.1;
  return [[ri,0,cap],[ru,cap,uz],[ri,uz,P.gh]];
}

/* ---------- render ---------- */
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
function render(){
  const {P,L,tiles,plates}=model, cv=$("cv");
  const box=cv.parentElement.clientWidth-28, dpr=window.devicePixelRatio||1;
  const pad=24, cw=Math.max(260,box), sc=(cw-2*pad)/P.W, ch=P.H*sc+2*pad;
  cv.width=cw*dpr; cv.height=ch*dpr; cv.style.height=ch+"px";
  const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0);
  g.fillStyle=css("--sheet"); g.fillRect(0,0,cw,ch);
  const X=x=>pad+x*sc, Y=y=>pad+(P.H-y)*sc;
  g.fillStyle=css("--paper"); g.fillRect(X(0),Y(P.H),P.W*sc,P.H*sc);
  const ink=css("--ink"), alt=css("--muted"), sel=css("--indigo"), wood=css("--wood");
  tiles.forEach((t,i)=>{
    const base=i===selected?sel:((t.r+t.c)%2?alt:ink);
    for(const bx of t.boxes){
      if(bx.kind==="c") continue;
      g.fillStyle=bx.kind==="i"?(i===selected?sel:wood):base;
      g.beginPath(); bx.pts.forEach((p,k)=>k?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1]))); g.closePath(); g.fill();
    }
  });
  for(const bp of model.borders){
    for(const bx of bp.boxes){
      g.globalAlpha=bx.kind==="f"?0.45:bx.kind==="hk"?0.6:1; g.fillStyle=bx.kind==="f"?sel:bx.kind==="hk"?ink:wood;
      g.beginPath(); bx.pts.forEach((p,k)=>k?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1]))); g.closePath(); g.fill();
    }
    g.globalAlpha=1;
  }
  if(model.borders.length){
    g.strokeStyle=css("--sheet"); g.lineWidth=2;
    for(const bp of model.borders){const r=bp.boxes[0].pts; g.strokeRect(X(r[0][0]),Y(r[2][1]),(r[2][0]-r[0][0])*sc,(r[2][1]-r[0][1])*sc);}
  }
  if(!P.zig){
    g.strokeStyle=sel; g.lineWidth=1.5; g.setLineDash([6,4]);
    for(let c=1;c<L.nx;c++){g.beginPath();g.moveTo(X(c*L.tw),Y(0));g.lineTo(X(c*L.tw),Y(P.H));g.stroke();}
    for(let r=1;r<L.ny;r++){g.beginPath();g.moveTo(X(0),Y(r*L.th));g.lineTo(X(P.W),Y(r*L.th));g.stroke();}
    g.setLineDash([]);
  }
  g.font="600 13px "+css("--f-mono");
  tiles.forEach((t,i)=>{const cx=X((t.x0+t.x1)/2),cy=Y((t.y0+t.y1)/2);const w=g.measureText(t.name).width+12;
    g.fillStyle=i===selected?wood:sel;g.fillRect(cx-w/2,cy-11,w,22);g.fillStyle=css("--sheet");g.textAlign="center";g.textBaseline="middle";g.fillText(t.name,cx,cy+1);});
  g.fillStyle=alt; g.font="12px "+css("--f-mono"); g.textAlign="center"; g.textBaseline="alphabetic";
  g.fillText(P.W+" × "+P.H+" mm",cw/2,ch-6);

  const total=tiles.reduce((s,t)=>s+t.grams,0), bars=tiles.reduce((s,t)=>s+t.bars,0);
  const mw=Math.max(...tiles.map(t=>Math.max(t.bw,t.bh))), mh=Math.max(...tiles.map(t=>Math.min(t.bw,t.bh)));
  $("stats").innerHTML=
    `<div><b>${L.nx} × ${L.ny}</b>tiles (${tiles.length} prints)</div>`+
    `<div><b>${mw.toFixed(0)} × ${mh.toFixed(0)}</b>largest tile, mm</div>`+
    `<div><b>${bars.toLocaleString()}</b>lattice bars</div>`+
    `<div><b>≈ ${Math.round(total)} g</b>PLA, upper bound</div>`+
    (plates.length?`<div><b>${plates.length}</b>splice plates</div>`:"")+
    (model.keys.length?`<div><b>${model.keys.length}</b>bowtie keys</div>`:"")+
    (model.teeth?`<div><b>${model.teeth}</b>locking teeth</div>`:"")+
    (model.pegs?`<div><b>${model.pegs}</b>border pegs</div>`:"")+
    (model.borders.length?`<div><b>${model.borders.length}</b>border pieces</div>`:"")+
    (P.wall?`<div><b>${model.sockets.length}</b>wall pucks (2 per tile)</div><div><b>${WALL(P).T.toFixed(0)} mm</b>float off the wall</div>`:"")+
    (P.mount?`<div><b>${model.borders.filter(b=>b.hook).length}</b>hidden wall cleats</div><div><b>${model.borders[0]?model.borders[0].top.toFixed(0):"–"} mm</b>frame depth</div>`:"");

  $("tiles").innerHTML=tiles.map((t,i)=>`<tr class="tile-row${i===selected?" sel":""}" data-i="${i}" tabindex="0"><td><b>${t.name}</b></td><td class="n">${t.bw.toFixed(1)} × ${t.bh.toFixed(1)}</td><td class="n">${t.bars}</td><td class="n">≈ ${Math.round(t.grams)} g</td><td>${!t.fits?"Too big":(t.role==="addition"?"Back down":t.role==="base"?"Face down":"")+(t.turn?(t.role?", turned":"Turned 90°"):(t.role?"":"As shown"))}</td></tr>`).join("")+
    model.borders.map(t=>`<tr><td><b>${t.name}</b></td><td class="n">${t.bw.toFixed(1)} × ${t.bh.toFixed(1)}</td><td class="n">—</td><td class="n">≈ ${Math.round(t.grams)} g</td><td>${!t.fits?"Too big":t.turn?"Turned 90°":"Flange down"}</td></tr>`).join("");

  const W=[], maxw=Math.max(P.gw,P.iw);
  const big=tiles.concat(model.borders).filter(t=>!t.fits);
  if(big.length) W.push(`Tile${big.length>1?"s":""} ${big.map(t=>t.name).join(", ")} won't fit the bed. Reduce the edge margin, use a smaller cell size, or switch to straight seams.`);
  if(P.b/2 < maxw+0.5) W.push(`Border width ${P.b} mm is too thin. Use at least ${(2*maxw+1).toFixed(1)} mm so bar ends embed in the border.`);
  [["Grid bar",P.gw],["Infill bar",P.iw]].forEach(([n,w])=>{const k=w/0.4;if(Math.abs(k-Math.round(k))>0.01)W.push(`${n} width ${w} mm isn't a multiple of 0.4 mm. With a 0.4 nozzle that leaves gaps or thin fill inside the bar; ${(Math.round(k)*0.4).toFixed(1)} mm prints cleaner.`);});
  if(P.zig){const k=P.gw/2/0.4; if(Math.abs(k-Math.round(k))>0.01||P.gw/2<0.8) W.push(`Seam bars print at half the grid width (${(P.gw/2).toFixed(1)} mm). Use a grid width that halves to a multiple of 0.4 mm, like 1.6, 2.4 or 3.2 mm.`);}
  if(P.zig&&P.pat==="kikko") W.push("Kikkō has no bars along the triangle grid, so zigzag seams add thin seam bars that show as faint lines. Straight seams hide better for this pattern.");
  if(P.pins){
    if(P.hub<P.pin+2.4) W.push(`Hub diameter ${P.hub} mm leaves less than 1.2 mm of wall around a ${P.pin} mm peg hole. Use a hub of at least ${(P.pin+2.4).toFixed(1)} mm.`);
    if(P.sepb&&model.borders.some(b=>!b.pegs)) W.push("Some border pieces have no pegs, so they'd rely on the backing lattice alone. Use a larger cell size or a thicker border.");
    if(P.hub>P.cell*0.45) W.push(`Hubs of ${P.hub} mm are large next to ${P.cell} mm cells and will crowd the pattern. Try ${Math.floor(P.cell*0.3)} mm or less.`);
    if(P.pin<2.5) W.push("Pegs under 2.5 mm snap easily. Use 2.5–3.5 mm.");
    if(P.gh<4) W.push(P.lap?"Lap seams split the bar height in two. Below 4 mm the halves and teeth get too thin; 6–12 mm works well.":"Bowtie keys need bars at least 4 mm tall to hold. Raise the grid bar height.");
    if(P.lap&&P.snap&&P.fc>0.2) W.push("Fit clearance above 0.20 mm leaves the notch wall too thin for the snap barb, so teeth are plain press-fit. Use 0.20 mm or less.");
    if(P.lap&&P.snap&&P.gw<2.4) W.push("Snap-fit teeth need a grid bar width of at least 2.4 mm; below that the notch wall is too thin, so teeth are plain press-fit.");
    if(P.lap&&P.gw<2.4) W.push("Locking teeth are cut into the seam bar's width. Use a grid bar width of at least 2.4 mm (3.2 mm is sturdier).");
  }
  if(P.sepb&&P.pins&&P.snap&&!SNAP(P).on) W.push("Snap pegs need pegs of at least 2.5 mm and grid bars at least "+(3+Math.min(1,P.gh/3)).toFixed(1)+" mm tall, so the frame pegs are plain press-fit.");
  if(P.sepb&&SNAP(P).on&&P.hub<P.pin+2.4) W.push("The snap undercut leaves the hub wall thin. Use a hub at least 2.4 mm bigger than the peg.");
  if(P.wall&&model.borders.length&&model.borders.some(b=>!(b.feet||[]).length)) W.push("Some frame pieces got no wall feet (no room clear of the tile pucks). They'll hang only from the tiles. Try a larger cell size or fewer tiles.");
  if(P.flt>0&&P.wall&&P.b<2*(P.pin/2+SNAP(P).bd+0.1)+3) W.push(`A floating frame snaps onto its standoffs through pegs in the border bar. Use a border of at least ${(2*(P.pin/2+0.35)+3).toFixed(1)} mm.`);
  if(P.flt>0&&!P.wall) W.push("Float off the wall only works with the Wall pegs mount. With hidden cleats the frame already hangs off the wall by its frame height.");
  {const CV=COVE(P); if(CV.want&&!CV.on) W.push(P.b<CV.need?`The LED cove needs a border of at least ${CV.need.toFixed(1)} mm for a ${P.lw} mm strip (cove plus room for the snap pegs). Widen the border or use a narrower strip; the cove is off for now.`:`The LED cove needs a frame at least ${CV.depthNeed} mm deep. Raise Frame height; the cove is off for now.`);
   if(P.cove&&P.flt===0&&P.wall) W.push("The LED cove only applies when the frame floats off the wall. Set Float off wall to 15–25 mm.");}
  if(P.flt>40) W.push(`A ${P.flt} mm float puts a lot of leverage on each standoff screw. 15–25 mm is plenty for LED strip.`);
  if(P.wall&&P.lap) W.push("Lap seams overlap, so an addition tile can only come off after its base neighbors. To swap any tile on its own, set Seam style to Zigzag.");
  if(P.wall){const few=tiles.filter(t=>(t.sockets||0)<2); if(few.length) W.push(`Tile${few.length>1?"s":""} ${few.map(t=>t.name).join(", ")} got fewer than 2 sockets (not enough room clear of the border). Use a smaller cell size or a larger panel.`);}
  if($("mount").value==="cleat"&&!P.mount) W.push("The hidden wall mount needs the separate border, so it's off. Turn on \"Print border separately\" and use a lap or zigzag seam.");
  if(P.mount&&model.borders.length&&!model.borders.some(b=>b.hook)) W.push("Top border pieces are too short for a hook. Use a wider panel.");
  if(P.mount&&P.H<cleatDims(P).drop+cleatDims(P).plateH+3*P.b) W.push("The panel is too short for the hidden cleat. Make it at least "+(cleatDims(P).drop+cleatDims(P).plateH+3*P.b)+" mm tall.");
  if(P.iw<1.2) W.push("Infill bars under 1.2 mm are only two extrusion lines wide and snap when you remove the brim.");
  if(Math.max(P.gh,P.ih)/Math.min(P.gw,P.iw)>5) W.push("Bars are more than 5× taller than wide. Expect wobble and layer shift on tall thin walls; lower the height or widen the bars.");
  const opening=P.cell*(["kaku","hishi"].includes(P.pat)?1:0.35);
  if(opening<4*maxw) W.push(`Cell size ${P.cell} mm makes the openings tiny relative to the bars. The panel will read as solid; try ${Math.ceil(maxw*12)} mm or more.`);
  if(tiles.length>12) W.push(`${tiles.length} tiles is a long assembly. Check a bigger bed or a larger cell size.`);
  if(L.ex<60||L.ey<60) W.push("Edge margin leaves almost no usable bed. Reduce the margin.");
  $("warns").innerHTML=W.length?W.map(w=>`<div class="warn">${w}</div>`).join(""):`<div class="okline">No print risks flagged for these settings.</div>`;
  const lines=k=>Math.round(k/0.4);
  $("lineHint").textContent=`0.4 nozzle: grid ≈ ${lines(P.gw)} lines, infill ≈ ${lines(P.iw)} lines`;
  $("seamHint").textContent=P.lap?`Seam bars split by depth: base tiles keep the front ${(P.gh/2).toFixed(1)} mm (${Math.round(P.gh/2/0.2)} layers), addition tiles the back ${(P.gh/2).toFixed(1)} mm, with teeth that drop into notches. No glue.`:P.zig?`Seam bars print ${(P.gw/2).toFixed(1)} mm wide and meet face to face; bowtie keys lock them. No glue.`:"Tiles cut straight; seam rails glue edge to edge, with splice plates on the back.";
  $("plates").disabled=$("pt").disabled=$("pl").disabled=P.zig;
  $("pins").disabled=$("pd").disabled=$("hd").disabled=$("sepb").disabled=$("bt").disabled=!P.zig;
}

/* ---------- STL ---------- */
function boxTris(p,z0,z,out){
  let ar=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];ar+=a[0]*b[1]-b[0]*a[1];}
  if(ar<0) p=p.slice().reverse();
  const n=p.length, B=p.map(q=>[q[0],q[1],z0]), T=p.map(q=>[q[0],q[1],z]);
  for(let i=1;i<n-1;i++){out.push([T[0],T[i],T[i+1]],[B[0],B[i+1],B[i]]);}
  for(let i=0;i<n;i++){const j=(i+1)%n;out.push([B[i],B[j],T[j]],[B[i],T[j],T[i]]);}
}
function tileTris(t){
  const out=[];
  if(t.role==="addition"){
    // printed back-side down so the lap layer and teeth build up from the bed without supports
    const Z=t.top, map=(x,y)=>{const lx=x-t.bx0, ly=(t.by0+t.bh)-y; return t.turn?[ly,t.bw-lx]:[lx,ly];};
    for(const bx of t.boxes) boxTris(bx.pts.map(q=>map(q[0],q[1])),Z-bx.z,Z-(bx.z0||0),out);
    return out;
  }
  const map=(x,y)=>{const lx=x-t.bx0, ly=y-t.by0; return t.turn?[ly,t.bw-lx]:[lx,ly];};
  for(const bx of t.boxes) boxTris(bx.pts.map(q=>map(q[0],q[1])),bx.z0||0,bx.z,out);
  return out;
}
function plateTris(plates,P){
  const out=[], gap=5, maxX=P.bx-2*P.mg; let x=0,y=0,rowH=0;
  for(const pl of plates){
    if(x+pl.len>maxX){x=0;y+=rowH+gap;rowH=0;}
    boxTris([[x,y],[x+pl.len,y],[x+pl.len,y+pl.wid],[x,y+pl.wid]],0,P.pt,out);
    x+=pl.len+gap; rowH=Math.max(rowH,pl.wid);
  }
  return out;
}
function borderTris(t){
  const out=[], Z=t.top, map=(x,y)=>{const lx=x-t.bx0, ly=(t.by0+t.bh)-y; return t.turn?[ly,t.bw-lx]:[lx,ly];};
  for(const bx of t.boxes) boxTris(bx.pts.map(q=>map(q[0],q[1])),Z-bx.z,Z-(bx.z0||0),out);
  return out;
}
function keyTris(n,P,K){
  const out=[], c=P.fc, a0=K.a0-c, a1=K.a1-c, d=K.d-c, h=Math.max(1,P.gh-Math.min(1,P.gh/3)-0.3);
  const gx=2*d+5, gy=2*a1+5, per=Math.max(1,Math.floor((P.bx-2*P.mg)/gx));
  for(let i=0;i<n;i++){
    const x=(i%per)*gx+d, y=Math.floor(i/per)*gy+a1;
    boxTris([[x-0.05,y-a0],[x+d,y-a1],[x+d,y+a1],[x-0.05,y+a0]],0,h,out);
    boxTris([[x-d,y-a1],[x+0.05,y-a0],[x+0.05,y+a0],[x-d,y+a1]],0,h,out);
  }
  return out;
}
function pinTris(n,P){
  const out=[], d=P.pin-0.2, h=Math.max(1,P.gh-Math.min(1,P.gh/3)-0.3), gap=d+4, per=Math.max(1,Math.floor((P.bx-2*P.mg)/gap)), N=24;
  for(let i=0;i<n;i++){
    const cx=(i%per)*gap+d/2, cy=Math.floor(i/per)*gap+d/2;
    const pts=[];for(let k=0;k<N;k++){const a=2*Math.PI*k/N;pts.push([cx+d/2*Math.cos(a),cy+d/2*Math.sin(a)]);}
    boxTris(pts,0,h,out);
  }
  return out;
}
function stl(tris,name){
  const buf=new ArrayBuffer(84+tris.length*50), dv=new DataView(buf);
  const hdr=("kumiko "+name).slice(0,79); for(let i=0;i<hdr.length;i++) dv.setUint8(i,hdr.charCodeAt(i));
  dv.setUint32(80,tris.length,true); let o=84;
  for(const [a,b,c] of tris){
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const l=Math.hypot(nx,ny,nz)||1;
    for(const v of [[nx/l,ny/l,nz/l],a,b,c]){dv.setFloat32(o,v[0],true);dv.setFloat32(o+4,v[1],true);dv.setFloat32(o+8,v[2],true);o+=12;}
    dv.setUint16(o,0,true); o+=2;
  }
  return buf;
}
function layoutSVG(){
  const {P,tiles}=model;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${P.W+20} ${P.H+20}" width="${P.W+20}mm" height="${P.H+20}mm"><rect x="-10" y="-10" width="${P.W+20}" height="${P.H+20}" fill="#fff"/>`;
  for(const t of tiles){const col=(t.r+t.c)%2?"#5C6670":"#1D2329";
    for(const b of t.boxes){if(b.kind==="c")continue;s+=`<polygon fill="${b.kind==="i"?"#8A6A45":col}" points="${b.pts.map(p=>p[0].toFixed(2)+","+(P.H-p[1]).toFixed(2)).join(" ")}"/>`;}
    s+=`<text x="${((t.x0+t.x1)/2).toFixed(1)}" y="${(P.H-(t.y0+t.y1)/2).toFixed(1)}" font-family="monospace" font-size="16" text-anchor="middle" fill="#2F4B7C" font-weight="bold">${t.name}</text>`;}
  for(const bp of model.borders){for(const b of bp.boxes){s+=`<polygon fill="${b.kind==="f"?"#2F4B7C":"#8A6A45"}" fill-opacity="${b.kind==="f"?0.4:1}" points="${b.pts.map(p=>p[0].toFixed(2)+","+(P.H-p[1]).toFixed(2)).join(" ")}"/>`;}}
  return s+"</svg>";
}
function readme(){
  const {P,L,tiles,plates}=model;
  const turned=tiles.filter(t=>t.turn).map(t=>t.name);
  const seamName=P.lap?"half-lap seams along the lattice, with locking teeth":P.zig?"zigzag along the lattice (half-width bars on each side)":"straight cut with half-width seam rails";
  const steps=["Dry-fit all tiles face down on a flat surface, using layout.svg."];
  if(P.lap){
    const bases=tiles.filter(t=>t.role==="base").map(t=>t.name).join(", "), adds=tiles.filter(t=>t.role==="addition").map(t=>t.name).join(", ");
    steps.push(`Seams are half-lap joints. Base tiles (${bases}) keep the front half of each seam bar and print face down. Addition tiles (${adds}) keep the back half; their STLs are flipped so they print back side down and the teeth build up without supports.`);
    steps.push(`Lay all base tiles face down. Lower each addition tile onto them from the back: its seam layer rests on the base's seam layer and its teeth (${model.teeth} in total) drop into the notches. Teeth alternate direction, so tiles can't slide apart.${P.snap?" Each tooth has a small barb that clicks under a lip in its notch, so tiles also can't pull apart front to back. Press until you feel the click. To take a tile off, flex the seam bar gently.":""} No glue.`);
  } else if(P.zig){
    steps.push("Neighboring tiles nest along their zigzag edges."+(model.keys.length?` Press the ${model.keys.length} bowtie keys into the dovetail pockets on the back of each seam. Their flared ends hook both tiles so they can't pull apart. No glue.`:""));
  } else {
    steps.push("Glue seam rails edge to edge (CA glue or 2-part epoxy). Clamp against a straight edge.");
    steps.push(plates.length?`Glue ${plates.length} splice plates across the seams on the back, centred on the doubled rail.`:"Splice plates are off; consider a backing board for strength.");
  }
  const sn=SNAP(P).on;
  if(model.borders.length) steps.push(`Frame: ${model.borders.length} separate pieces with ${model.pegs} ${sn?"snap ":""}pegs on their backing lattice. The outer tiles' hidden hub holes press onto these pegs${sn?": each peg is split with a small barb at the tip, the same click-lock as the lap teeth, so tiles snap in from the front and pop out with a firm pull":""}. Frame STLs are flipped so the backing lattice and pegs print flat on the bed.`);
  if(P.wall){const Wd=WALL(P), feet=allFeet(), nf=feet.length;
    steps.push(`Mark the wall: print wall_template.svg at 100% (actual size), tape it up with its top line level, and drill the red crosses (tile pucks, 2 screws each) and the ${nf} orange crosses (frame feet, 1 screw each). Use #8 pan-head screws with anchors.`);
    const CV=COVE(P);
    if(P.flt>0&&CV.on) steps.push(`Backlight: press a ${P.lw} mm LED strip into the cove on the back of each frame piece, LEDs facing the wall (cove is ${CV.gW.toFixed(1)} mm wide x ${CV.gD} mm deep, so the strip sits below the surface). The cove runs the full length and turns every corner, so one strip goes all the way round; bend it flat at the corners or use L-connectors. Leave a short tail at one bottom corner and run the cable out through the ${P.flt} mm gap. The light bounces off the wall: a halo around the frame and a glow through the lattice, with no strip visible. COB strip gives an even line with no dots.`);
    if(model.borders.length&&P.flt>0) steps.push(`Frame first: screw the ${nf} frame standoffs over the orange boxes (screw through the square counterbore, pegs pointing out). Press each frame piece onto its standoffs until the pegs click. The frame now floats ${P.flt} mm off the wall; only the standoffs touch it, and each screw is buried inside its standoff under the frame.`);
    else if(model.borders.length) steps.push(`Frame first: hold each frame piece in place and drive a screw through each of its hidden feet (${nf} in total; the square holes just inside the frame's inner edge). The heads sit below the backing lattice, behind where the outer tiles go.`);
    steps.push(`Screw on the ${model.sockets.length} tile pucks over the blue boxes, pegs pointing out. Then press each tile in: it pushes onto its two puck pegs, and outer tiles also click onto the frame's snap pegs. Zigzag edges nest with the neighbors.`);
    steps.push(`Swap or add later: pull any tile straight out (outer tiles release from the frame with a firm pull) and press another in. The frame stays on the wall. Tiles float ${Wd.T.toFixed(0)} mm off the wall.`);
    if(P.flt>0&&!COVE(P).on) steps.push(`Backlight: there is a ${P.flt} mm gap behind the frame and ${Wd.T.toFixed(0)} mm behind the tiles. Stick an 8–10 mm LED strip to the wall about 25 mm inside the frame outline (behind the outer tiles), routing around pucks and standoffs. Run the cable out through the bottom gap.`);}
  if(P.mount){const C=cleatDims(P), n=model.borders.filter(b=>b.hook).length;
    steps.push(`Hang it: print wall_template.svg at 100% (actual size), tape it to the wall with its top line level, and drill the ${n*2} red crosses. Screw the ${n} printed wall cleats on, open lip facing up (#8 pan-head screws with anchors). Lift the panel, hold it flat against the wall about 15 mm above its final spot, and lower it: the hidden hooks drop behind the cleat lips. The panel stands ${model.borders[0].top.toFixed(0)} mm off the wall and nothing shows.`);}
  if(!P.wall) steps.push(P.zig?"Flip the panel carefully, supporting the middle, and hang it. Fit is set by Fit clearance: if teeth, keys or pegs are too tight, raise it 0.05 mm; if loose, lower it.":"Lightly sand the front of each seam, then finish.");
  return `KUMIKO FRAME — ${P.W} x ${P.H} mm, pattern: ${$("pat").selectedOptions[0].text}
Cell ${P.cell} mm · grid bar ${P.gw} x ${P.gh} mm · infill bar ${P.iw} x ${P.ih} mm · border ${P.b} mm x ${P.fh} mm
Seams: ${seamName}

TILES: ${L.nx} columns x ${L.ny} rows = ${tiles.length} prints
Rows are lettered from the top (A = top row), columns numbered from the left. See layout.svg.
${turned.length?`Tiles ${turned.join(", ")} are rotated 90 degrees in their STL to fit the bed. Rotate back when assembling.\n`:""}
PRINT
- 0.4 nozzle, 0.2 mm layers. Brim 5 mm (or brim ears).
- Bars should print solid: enough wall loops to fill each bar width.
- PLA or PETG on textured PEI.
- STLs contain overlapping bars. Bambu Studio, Orca and PrusaSlicer merge them; if not, use repair / merge parts.

ASSEMBLE
${steps.map((x,i)=>`${i+1}. ${x}`).join("\n")}
`;
}
async function saveBlob(name,blob){
  // claude.ai artifact: use the downloads capability. Anywhere else (local file, Cursor preview): plain browser download.
  if(typeof claude!=="undefined"&&claude.use){const dl=await claude.use("downloads"); if(!dl) return false; await dl.save({filename:name,data:blob}); return true;}
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000); return true;
}
async function exportZip(list,label){
  const st=$("status"); st.textContent="Building STLs…";
  try{
    if(typeof JSZip==="undefined") throw {message:"The zip library didn't load. Reload the page and try again."};
    const zip=new JSZip(), {P}=model;
    const parts3mf=[]; // same meshes go into a Bambu Studio .3mf when Bambu3mf is loaded
    const add=(name,tris)=>{ zip.file(`${name}.stl`, stl(tris,name)); parts3mf.push({name,tris}); };
    for(const t of list) add(`tile_${t.name}`, tileTris(t));
    if(list.length===model.tiles.length && model.plates.length) add("splice_plates", plateTris(model.plates,P));
    if(list.length===model.tiles.length) for(const bp of model.borders) add(bp.name.replace(" ","_").toLowerCase(), borderTris(bp));
    if(list.length===model.tiles.length && model.keys.length) add(`bowtie_keys_x${model.keys.length}`, keyTris(model.keys.length,P,model.K));
    if(model.P.wall&&model.sockets.length){
      const ids=new Set(list.map(t=>model.tiles.indexOf(t))), n=model.sockets.filter(k=>ids.has(k.tile)).length;
      if(n) add(`wall_pucks_x${n}`, puckTris(n,P));
      zip.file("wall_template.svg", pegTemplateSVG());
      {const nf=allFeet().filter(f=>f.boxes).length; if(nf) add(`frame_standoffs_x${nf}`, standoffTris(P));}
    }
    if(list.length===model.tiles.length&&model.P.mount){const n=model.borders.filter(b=>b.hook).length; if(n){add(`wall_cleats_x${n}`, cleatTris(n,P)); zip.file("wall_template.svg", wallTemplateSVG());}}
    zip.file("layout.svg", layoutSVG()); zip.file("README.txt", readme());
    if(typeof Bambu3mf!=="undefined" && parts3mf.length){
      st.textContent="Building Bambu Studio .3mf…";
      const template=await loadBambuTemplate();
      const objSet=Bambu3mf.latticeObjectSettings(P);
      for(const p of parts3mf) p.obj_settings={...objSet};
      const proj=Bambu3mf.latticeProjectOverrides(P);
      const bed=proj._bed; delete proj._bed;
      const pack=Bambu3mf.buildBambuPackage(parts3mf, proj, {bed, template});
      const mf=new JSZip();
      for(const [n,d] of Object.entries(pack.files)) mf.file(n,d);
      zip.file(`kumiko_${P.W}x${P.H}.3mf`, await mf.generateAsync({type:"uint8array",compression:"DEFLATE"}));
    }
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
    st.textContent="Waiting for you to confirm the save…";
    if(!(await saveBlob(label,blob))){st.textContent="Saving isn't available in this view.";return;}
    st.textContent=`Saved ${label} (${(blob.size/1048576).toFixed(1)} MB).`;
  }catch(err){
    const c=err&&err.code;
    st.textContent = c==="declined"?"Save cancelled.":c==="rate_limited"?"A save prompt is already open. Finish that one first.":
      (c==="unavailable"||c==="not_granted")?"Saving isn't available in this view. Open the page in claude.ai.":("Export failed: "+(err&&err.message||err));
  }
}
let _bambuTemplate=null;
async function loadBambuTemplate(){
  if(_bambuTemplate) return _bambuTemplate;
  const r=await fetch("cli/bambu_profile_template.json");
  if(!r.ok) throw {message:"Couldn't load the Bambu print-settings template (cli/bambu_profile_template.json)."};
  _bambuTemplate=await r.json();
  return _bambuTemplate;
}

/* ---------- wiring ---------- */
let tmr; const queue=()=>{clearTimeout(tmr);tmr=setTimeout(build,120)};
ids.forEach(id=>$(id).addEventListener("input",()=>{
  if(id==="preset"&&$("preset").value!=="custom"){const [x,y]=$("preset").value.split("x");$("bx").value=x;$("by").value=y;}
  if(id==="bx"||id==="by") $("preset").value="custom";
  queue();
}));
$("tiles").addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr)return;selected=+tr.dataset.i;render();});
$("tiles").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){const tr=e.target.closest("tr");if(!tr)return;e.preventDefault();selected=+tr.dataset.i;render();}});
$("exportAll").addEventListener("click",()=>exportZip(model.tiles,`kumiko-frame-${model.P.W}x${model.P.H}.zip`));
$("exportTest").addEventListener("click",async()=>{
  const st=$("status"); st.textContent="Building test kit…";
  try{
    const zip=new JSZip(), f=testKit(model.P);
    for(const [n,d] of Object.entries(f)) zip.file(n,d);
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
    st.textContent="Waiting for you to confirm the save…";
    if(!(await saveBlob("kumiko-test-kit.zip",blob))){st.textContent="Saving isn't available in this view.";return;}
    st.textContent="Saved kumiko-test-kit.zip.";
  }catch(err){const c=err&&err.code; st.textContent=c==="declined"?"Save cancelled.":c==="rate_limited"?"A save prompt is already open. Finish that one first.":"Export failed: "+(err&&err.message||err);}
});
$("exportOne").addEventListener("click",()=>{const t=model.tiles[selected];exportZip([t],`kumiko-tile-${t.name}.zip`);});
window.addEventListener("resize",()=>model&&render());
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>model&&render());}catch(e){}
new MutationObserver(()=>model&&render()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
build();
