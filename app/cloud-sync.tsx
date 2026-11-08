'use client';
import {useEffect,useState} from 'react';
import {gameSave} from '@/lib/accounts/game-save.mjs';

export function CloudSync({game}:{game:any}){
 const [status,setStatus]=useState('');
 useEffect(()=>{
  if(!game)return;let stopped=false,running=false;
  async function sync(){
   if(running||stopped)return;running=true;
   try{
    const sessionResponse=await fetch('/api/account/session',{cache:'no-store'});
    if(!sessionResponse.ok)return;const session:any=await sessionResponse.json();
    const id=session.profile?.public_id;if(!id){setStatus('');return;}
    if(localStorage.getItem('facility-local-data-owner')!==id){setStatus('Compte : choisir les données dans le profil');return;}
    const key='facility-cloud-sync-'+id,stored=localStorage.getItem(key);if(!stored){setStatus('');return;}
    const marker=JSON.parse(stored),data=gameSave(game.records,game.settings),encoded=JSON.stringify(data);
    if(marker.data===encoded){setStatus('Compte : sauvegardé');return;}
    setStatus('Compte : synchronisation…');
    const response=await fetch('/api/account/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:id,revision:marker.revision,data})});
    if(stopped)return;
    if(response.status===409){setStatus('Compte : conflit entre appareils — ouvre ton profil');return;}
    if(!response.ok)throw new Error();const result:any=await response.json();
    if(!result.saved||!Number.isSafeInteger(result.revision))throw new Error();
    localStorage.setItem(key,JSON.stringify({revision:result.revision,data:encoded}));setStatus('Compte : sauvegardé');
   }catch{if(!stopped)setStatus(navigator.onLine?'Compte : erreur de sauvegarde':'Compte : hors ligne');}finally{running=false;}
  }
  const timer=setInterval(sync,30000);sync();return()=>{stopped=true;clearInterval(timer);};
 },[game]);
 return status?<span className="cloud-sync-status" role="status">{status}</span>:null;
}
