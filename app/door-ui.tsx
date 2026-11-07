"use client";
import {useState} from 'react';
import {Lock,Unlock,Shield,DoorOpen,Radio,CheckCheck,Clock,Zap} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';

export function DoorControls({s,game,interaction}:any){
 const [selected,setSelected]=useState<string[]>([interaction.id]),[mode,setMode]=useState('hostile'),[message,setMessage]=useState('');
 const panel=interaction.floor===s.floor?game?.sim.doorPanel(interaction.roomIndex):null;
 if(!panel)return <p>Vous avez quitté ce niveau.</p>;
 const eligible=panel.doors.filter((d:any)=>selected.includes(d.id)&&d.ok);
 const apply=(action?:string)=>{
  const results=eligible.map((d:any)=>action?game.sim.setDoorAction(d.id,action):game.sim.setDoorLock(d.id,mode)),ok=results.filter((r:any)=>r.ok).length;
  setMessage(ok?`${ok} porte(s) modifiée(s). ${results.find((r:any)=>r.ok).reason}`:results[0]?.reason||'Approchez-vous d’une porte contrôlée par votre équipe.');
  game.callbacks.onUpdate?.(game.snapshot());
 };
 return <div className="door-controls">
  <p className={'room-ownership '+panel.owner}><Shield size={16}/> {panel.owner==='ally'?'CONTRÔLE ALLIÉ':'CONTRÔLE ENNEMI'} · {panel.allies} allié(s) / {panel.enemies} ennemi(s){panel.contested?' · COMBAT DANS LA SALLE':''}</p>
  <div className="door-selection"><span>{eligible.length} porte(s) sélectionnée(s) à portée</span><button className="outlined-button" onClick={()=>setSelected(panel.doors.filter((d:any)=>d.ok).map((d:any)=>d.id))}><CheckCheck size={15}/> Toutes à portée</button></div>
  <div className="door-list">{panel.doors.map((d:any)=><article key={d.id} className={'door-card '+(!d.ok?'unavailable':'')+(selected.includes(d.id)?' chosen':'')}>
   <label><input type="checkbox" checked={selected.includes(d.id)} disabled={!d.ok} onChange={e=>setSelected(e.target.checked?[...selected,d.id]:selected.filter(id=>id!==d.id))}/><span><strong>{d.label}<b>{d.destroyed?'DÉTRUITE':d.open>=.72?'OUVERTE':'FERMÉE'}</b></strong><small>{d.type==='armored'?'Blindée · ':d.type==='secured'?'Sécurisée · ':'Standard · '}{d.opening?'Ouverture temporaire · '+d.opening+' s':d.mode==='all'?'Verrouillée pour tous':d.mode==='hostile'?'Accès '+(d.team==='ally'?'allié':'ennemi'):'Accès libre'}</small></span>{d.mode==='none'||d.opening?<Unlock size={20}/>:<Lock size={20}/>}</label>
   <div className="door-authority">{d.remote?<Radio size={14}/>:<Shield size={14}/>}<span>{d.remote?'Commande distante : ':'Commande locale : '}{d.controller}</span></div>
   <div className="door-hardware"><span><Zap size={13}/>Commande locale</span><span>{Math.max(0,d.health)} / {d.maxHealth} PV</span></div><progress value={Math.max(0,d.health)} max={d.maxHealth} aria-label={'Résistance de '+d.label}/>
   {d.manual>0&&<small><Clock size={12}/> Commande manuelle respectée encore {d.manual} s</small>}{!d.ok&&<p className="door-reason">{d.reason}</p>}
  </article>)}</div>
  <div className="door-quick-actions"><button className="outlined-button" disabled={!eligible.length} onClick={()=>apply('open')}><DoorOpen size={17}/> Ouvrir 10 s</button><button className="outlined-button" disabled={!eligible.length} onClick={()=>apply('auto')}><Shield size={17}/> Réserver à notre camp</button></div>
  <RadioGroup value={mode} onValueChange={setMode} className="door-modes" aria-label="Mode de verrouillage">
   {[['hostile','Bloquer les ennemis','Ouverture automatique pour votre équipe.'],['all','Bloquer tout le monde','Même votre équipe doit déverrouiller la porte.'],['none','Déverrouiller','Ouverture automatique pour les deux camps.']].map(([id,title,detail])=><label key={id}><RadioGroupItem value={id} aria-label={title}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}
  </RadioGroup>
  <button className="deploy-button small" disabled={!eligible.length||s.health<=0} onClick={()=>apply()}>APPLIQUER À {eligible.length} PORTE(S)</button>
  {message&&<p role="status" className="door-feedback">{message}</p>}
  <p className="dialog-note">À chaque changement de camp, les anciennes commandes sont annulées et un verrouillage total devient un accès réservé au nouveau propriétaire. Les portes suivent uniquement leur salle. Aucun battant ne se referme sur un soldat. La bataille continue.</p>
 </div>;
}
