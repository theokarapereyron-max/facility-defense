'use client';
import {useEffect,useState} from 'react';
import {gameSave} from '@/lib/accounts/game-save.mjs';

export function AccountSave({game,onRecords,owner}:{game:any,onRecords:(records:any)=>void,owner:string}){
 const [remote,setRemote]=useState<any>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('Chargement de la sauvegarde…');
 async function load(){const response=await fetch('/api/account/save',{cache:'no-store'});if(!response.ok)throw new Error();const data:any=await response.json();setRemote(data.save);return data.save;}
 async function enableAuto(save:any){const response=await fetch('/api/account/session',{cache:'no-store'});if(!response.ok)throw new Error();const session:any=await response.json();if(!session.profile?.public_id)throw new Error();localStorage.setItem('facility-cloud-sync-'+session.profile.public_id,JSON.stringify({revision:save.revision,data:JSON.stringify(save.data)}));}
 useEffect(()=>{load().then(()=>setStatus('Sauvegarde distante chargée.')).catch(()=>setStatus('Sauvegarde distante indisponible.'));},[]);
 async function upload(){if(!game||!remote)return;setBusy(true);setStatus('Synchronisation…');try{
  const data=gameSave(game.records,game.settings);
  const response=await fetch('/api/account/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner,revision:remote.revision,data})});
  if(response.status===409){await load();setStatus('Un autre appareil a modifié la sauvegarde. Compare les données avant de réessayer.');return;}
  if(!response.ok)throw new Error();const saved=await load();await enableAuto(saved);localStorage.setItem('facility-local-data-owner',owner);setStatus('Sauvegardé sur le compte. Sauvegarde automatique activée sur cet appareil.');
 }catch{setStatus(navigator.onLine?'Échec de sauvegarde. Tes données locales sont conservées.':'Hors ligne. Tes données locales sont conservées.');}finally{setBusy(false);}}
 function apply(){if(!game||!remote)return;try{
  if(remote.data?.version!==1)throw new Error();const data=gameSave(remote.data.records,remote.data.preferences);
  // Retain the previous local values until the user has confirmed the import.
  localStorage.setItem('facility-cloud-import-backup-v1',JSON.stringify({records:game.records,settings:game.settings}));
  localStorage.setItem('facility-records-v1',JSON.stringify(data.records));game.records={...data.records};game.setSettings(data.preferences);onRecords({...data.records});setStatus('Données du compte appliquées. Copie locale précédente conservée.');
 }catch{setStatus('Sauvegarde incompatible : aucune donnée du compte appliquée.');}}
 return <section><strong>Données du jeu</strong><p role="status">{status}</p><p>Les batailles en cours et les réglages graphiques restent sur cet appareil.</p>{remote&&<p>Révision {remote.revision} · Meilleur score distant : {remote.data?.records?.best??'aucun'} · Meilleur score local : {game?.records?.best??0}</p>}<button type="button" disabled={busy||!remote||!game} onClick={upload}>Enregistrer les records et préférences de cet appareil sur mon compte</button><button type="button" disabled={busy||remote?.data?.version!==1||!game} onClick={apply}>Utiliser les données de mon compte sur cet appareil</button></section>;
}
