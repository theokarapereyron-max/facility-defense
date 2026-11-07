import * as THREE from 'three';

// CPU triangle rasterisation of the same Three.js scene used by WebGL.
// This is a compatibility renderer for machines without a usable GPU context.
const world=new THREE.Matrix4(),instance=new THREE.Matrix4(),mvp=new THREE.Matrix4(),vp=new THREE.Matrix4();
const baseColor=new THREE.Color(),tint=new THREE.Color(),normal=new THREE.Vector3(),light=new THREE.Vector3(-.35,.85,.45).normalize();

function clipNear(vertices, closed) {
 const clipped = [];
 const count = closed ? vertices.length : vertices.length - 1;
 if(!closed && vertices[0].z + vertices[0].w >= 0) clipped.push(vertices[0]);
 for(let i = 0; i < count; i++) {
  const a = vertices[i], b = vertices[(i + 1) % vertices.length];
  const da = a.z + a.w, db = b.z + b.w;
  if((da < 0) !== (db < 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
  if(db >= 0) clipped.push(b);
 }
 return clipped;
}

function toScreen(v,w,h) {
 return {x:(1+v.x/v.w)*w/2, y:(1-v.y/v.w)*h/2, z:v.z/v.w};
}
export class Canvas3DRenderer {
 constructor({canvas}) {
  this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.isSoftware=true;this.pixelRatio=1;this.width=1;this.height=1;
  this.shadowMap={enabled:false};this.info={render:{calls:0,triangles:0}};
 }
 setPixelRatio(value) {this.pixelRatio=Math.min(1.25,value);}
 setSize(w,h) {this.width=w;this.height=h;this.domElement.width=Math.ceil(w*this.pixelRatio);this.domElement.height=Math.ceil(h*this.pixelRatio);}
 render(scene,camera) {
  const c=this.ctx,w=this.width,h=this.height,triangles=[];this.info.render.calls=0;
  c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);c.fillStyle=scene.background?.isColor?'#'+scene.background.getHexString():'#091620';c.fillRect(0,0,w,h);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const bounds=new THREE.Vector3(),scale=w/(camera.right-camera.left);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(vp),sphere=new THREE.Sphere();
  const perspective=camera.isPerspectiveCamera;
  const addTriangle=(a,b,c,material,order,fill)=>{
   const {x:ax,y:ay,z:az}=a,{x:bx,y:by,z:bz}=b,{x:cx,y:cy,z:cz}=c;
   if(!Number.isFinite(ax+ay+bx+by+cx+cy)||Math.max(ax,bx,cx)<0||Math.min(ax,bx,cx)>w||Math.max(ay,by,cy)<0||Math.min(ay,by,cy)>h||Math.max(az,bz,cz)<-1.001||Math.min(az,bz,cz)>1) return;
   const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
   if(material.side===THREE.FrontSide&&area>=0||material.side===THREE.BackSide&&area<=0||Math.abs(area)<.04)return;
   triangles.push({order,ax,ay,bx,by,cx,cy,z:(az+bz+cz)/3,fill,alpha:material.opacity??1});
  };
  scene.traverseVisible(object=>{
   if(object.isLineSegments) {
    const positions=object.geometry.attributes.position,colors=object.geometry.attributes.color;
    mvp.multiplyMatrices(vp,object.matrixWorld);
    if(positions)for(let i=0;i<positions.count;i+=2){
     const segment=[i,i+1].map(j=>new THREE.Vector4(positions.getX(j),positions.getY(j),positions.getZ(j),1).applyMatrix4(mvp));
     const clipped=clipNear(segment,false);
     if(clipped.length!==2)continue;
     const [a,b]=clipped.map(v=>toScreen(v,w,h));
     if(Math.max(a.x,b.x)<0||Math.min(a.x,b.x)>w||Math.max(a.y,b.y)<0||Math.min(a.y,b.y)>h||Math.min(a.z,b.z)>1)continue;
     const tint=colors?new THREE.Color(colors.getX(i),colors.getY(i),colors.getZ(i)):object.material.color;
     triangles.push({kind:'line',order:object.renderOrder,ax:a.x,ay:a.y,bx:b.x,by:b.y,z:(a.z+b.z)/2,fill:'#'+tint.getHexString(),alpha:object.material.opacity??1});
    }
    return;
   }
   if(!object.isMesh||!object.geometry)return;
   const material=Array.isArray(object.material)?object.material[0]:object.material;
   if(!material||material.visible===false||material.map&&material.transparent)return;
   const geometry=object.geometry,position=geometry.attributes.position,normals=geometry.attributes.normal,index=geometry.index;
   if(!position)return;
   if(!geometry.boundingSphere)geometry.computeBoundingSphere();
   const count=object.isInstancedMesh?object.count:1;
   for(let part=0;part<count;part++) {
    if(object.isInstancedMesh){object.getMatrixAt(part,instance);world.multiplyMatrices(object.matrixWorld,instance);baseColor.copy(material.color);if(object.instanceColor){object.getColorAt(part,tint);baseColor.multiply(tint);}}
    else {world.copy(object.matrixWorld);baseColor.copy(material.color);}
    if(perspective){
     sphere.copy(geometry.boundingSphere).applyMatrix4(world);
     if(!frustum.intersectsSphere(sphere))continue;
    }else{
     bounds.copy(geometry.boundingSphere.center).applyMatrix4(world).project(camera);
     const radius=geometry.boundingSphere.radius*world.getMaxScaleOnAxis()*scale;
     const bx=(bounds.x+1)*w/2,by=(1-bounds.y)*h/2;
     if(bx+radius<0||bx-radius>w||by+radius<0||by-radius>h)continue;
    }
    this.info.render.calls++;mvp.multiplyMatrices(vp,world);
    const e=mvp.elements,projected=new Array(position.count),screen=new Array(position.count);
    for(let v=0;v<position.count;v++) {
     const x=position.getX(v),y=position.getY(v),z=position.getZ(v);
     const clip=new THREE.Vector4(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14],e[3]*x+e[7]*y+e[11]*z+e[15]);
     if(perspective)projected[v]=clip;
     if(!perspective||clip.z+clip.w>=0)screen[v]=toScreen(clip,w,h);
    }
    const length=index?index.count:position.count;
    tint.copy(baseColor).convertLinearToSRGB();
    for(let t=0;t<length;t+=3) {
     const ia=index?index.getX(t):t,ib=index?index.getX(t+1):t+1,ic=index?index.getX(t+2):t+2;
     const a=projected[ia],b=projected[ib],c=projected[ic];
     if(!screen[ia]&&!screen[ib]&&!screen[ic])continue;
     let shade=1;
     if(!material.isMeshBasicMaterial&&normals){normal.set(normals.getX(ia),normals.getY(ia),normals.getZ(ia)).transformDirection(world);shade=.49+Math.max(0,normal.dot(light))*.6;}
     const red=Math.min(255,Math.round(tint.r*255*shade)),green=Math.min(255,Math.round(tint.g*255*shade)),blue=Math.min(255,Math.round(tint.b*255*shade));
     const fill=`rgb(${red},${green},${blue})`;
     if(screen[ia]&&screen[ib]&&screen[ic])addTriangle(screen[ia],screen[ib],screen[ic],material,object.renderOrder,fill);
     else{
      const vertices=clipNear([a,b,c],true).map(v=>toScreen(v,w,h));
      for(let i=1;i<vertices.length-1;i++)addTriangle(vertices[0],vertices[i],vertices[i+1],material,object.renderOrder,fill);
     }
    }
   }
  });
  triangles.sort((a,b)=>(a.order-b.order)||b.z-a.z);
  for(const triangle of triangles) {
   if(triangle.kind==='line'){c.globalAlpha=triangle.alpha;c.strokeStyle=triangle.fill;c.lineWidth=1.4;c.beginPath();c.moveTo(triangle.ax,triangle.ay);c.lineTo(triangle.bx,triangle.by);c.stroke();continue;}
   c.globalAlpha=triangle.alpha;c.fillStyle=triangle.fill;c.beginPath();c.moveTo(triangle.ax,triangle.ay);c.lineTo(triangle.bx,triangle.by);c.lineTo(triangle.cx,triangle.cy);c.closePath();c.fill();if(triangle.alpha===1){c.strokeStyle=triangle.fill;c.lineWidth=.55;c.lineJoin="round";c.stroke();}
  }
  c.globalAlpha=1;this.info.render.triangles=triangles.length;
 }
 dispose() {this.domElement.width=1;this.domElement.height=1;}
}
