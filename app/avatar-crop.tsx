'use client';
import {useEffect, useRef, useState} from 'react';

export function AvatarCrop() {
 const [url,setUrl]=useState(''),[zoom,setZoom]=useState(1),[x,setX]=useState(50),[y,setY]=useState(50),[error,setError]=useState('');
 const image=useRef<HTMLImageElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>()=>{if(url) URL.revokeObjectURL(url);},[url]);
 function choose(file?:File){
  setError('');
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3*1024*1024){setError('Choisis une image PNG, JPEG ou WebP de 3 Mo maximum.');return;}
  setZoom(1);setX(50);setY(50);setUrl(URL.createObjectURL(file));
 }
 function draw(){
  const img=image.current,c=canvas.current;if(!img||!c||!img.naturalWidth||!img.naturalHeight)return;
  if(img.naturalWidth>8192||img.naturalHeight>8192||img.naturalWidth*img.naturalHeight>25000000){setError('Image trop grande en dimensions.');return;}
  const side=Math.min(img.naturalWidth,img.naturalHeight)/zoom;
  const sx=(img.naturalWidth-side)*x/100,sy=(img.naturalHeight-side)*y/100;
  c.getContext('2d')?.drawImage(img,sx,sy,side,side,0,0,c.width,c.height);
 }
 useEffect(()=>{draw();},[url,zoom,x,y]);
 return <section className="avatar-crop"><label>Image personnelle <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>choose(e.target.files?.[0])}/></label>
 {url&&<><img ref={image} src={url} alt="" hidden onLoad={draw} onError={()=>setError('Impossible de lire cette image.')} /><canvas ref={canvas} width={256} height={256} aria-label="Aperçu de l’avatar recadré"/><label>Zoom <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><label>Position horizontale <input type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label><label>Position verticale <input type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label><button type="button" onClick={()=>setUrl('')}>Annuler</button><p>La sauvegarde de cette image n’est pas encore disponible.</p></>}
 {error&&<p role="alert">{error}</p>}</section>;
}
