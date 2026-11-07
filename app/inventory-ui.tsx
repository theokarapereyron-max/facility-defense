"use client";
import type {CSSProperties} from "react";
import {Backpack,Bomb,Sun,Bandage,BriefcaseMedical,Utensils,Package,FlaskConical,BookOpen,Radio,Wrench,Shield,DoorOpen,Radar,ArrowDownToLine,ArrowUpFromLine,Box,ChevronDown,ChevronUp,Coins,Snowflake,ShieldPlus,HeartPulse,Zap,Crosshair,Flame,Cloud,PlugZap, type LucideIcon} from 'lucide-react';
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from '@/components/ui/collapsible';
import {ITEMS,SLOT_KEYS} from '@/lib/facility/items.mjs';
type ItemKey=keyof typeof ITEMS;
type Stack={item:ItemKey;count:number}|null;
const icons:Record<string,LucideIcon>={Bomb,Sun,Bandage,BriefcaseMedical,Utensils,Package,FlaskConical,BookOpen,Radio,Wrench,Shield,DoorOpen,Radar,Snowflake,ShieldPlus,HeartPulse,Zap,Crosshair,Flame,Cloud,PlugZap};
export function ItemIcon({item,size=23}:{item:ItemKey;size?:number}){const d=ITEMS[item],Icon=icons[d.icon]||Package;return <Icon size={size} style={{color:d.color}} aria-hidden="true"/>;}
export function InventoryBelt({s,game,onOpen,collapsed=false,onCollapsedChange}:any){
 const slots:Stack[]=s.inventory||Array(3).fill(null);
 return <Collapsible open={!collapsed} onOpenChange={open=>onCollapsedChange(!open)} asChild><section className={'inventory-belt '+(collapsed?'is-collapsed':'')} aria-label="Objets rapides">
  <div className="inventory-heading"><button className="inventory-open" onClick={onOpen} aria-label="Ouvrir le sac complet"><Backpack size={17}/> SAC <b>{s.inventoryUsed||0}/{s.inventoryCapacity||3}</b><kbd>Tab</kbd></button><CollapsibleTrigger asChild><button className="inventory-collapse" aria-label={collapsed?'Déplier l’inventaire rapide':'Replier l’inventaire rapide'} title="Fn si votre clavier la transmet ; F9 fonctionne aussi."><span>{collapsed?'DÉPLIER':'REPLIER'}</span><kbd>F9</kbd>{collapsed?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></CollapsibleTrigger></div>
  <CollapsibleContent>
  <div className="quick-slots" style={{gridTemplateColumns:`repeat(${Math.min(5,slots.length)},minmax(0,1fr))`}}>{slots.map((stack,index)=><button key={index} className={'quick-slot '+(!stack?'empty':'')} disabled={!stack||s.health<=0||s.status!=='running'} onClick={()=>game?.useItem(index)} aria-label={'Case '+(index+1)+' · '+(stack?ITEMS[stack.item].name+' × '+stack.count:'vide')+' · '+SLOT_KEYS[index]} title={stack?ITEMS[stack.item].description:'Case libre'}><kbd>{SLOT_KEYS[index]}</kbd>{stack?<><ItemIcon item={stack.item}/><span>{ITEMS[stack.item].short}</span><b>×{stack.count}</b></>:<><span className="empty-slot-mark">+</span><span>Libre</span></>}</button>)}</div>
  <div className="inventory-effects">{s.armor>0&&<span><Shield size={13}/>{s.armor} protection</span>}{s.regeneration>0&&<span>Ration · {s.regeneration}s</span>}{s.scanRemaining>0&&<span>Détection · {s.scanRemaining}s</span>}{!s.armor&&!s.regeneration&&!s.scanRemaining&&<span>E près d’un meuble pour échanger.</span>}</div>
  </CollapsibleContent>
 </section></Collapsible>;
}
function StorageSlot({stack,index,hotkey,container,disabled,onUse,onTransfer}: {stack:Stack;index:number;hotkey?:string;container?:boolean;disabled:boolean;onUse?:()=>void;onTransfer:(amount?:number)=>void}){
 if(!stack)return <article className="storage-slot empty"><div className="slot-index">CASE {index+1}{hotkey&&<kbd>{hotkey}</kbd>}</div><Box size={25}/><strong>Emplacement libre</strong><span>Un type d’objet par case</span></article>;
 const d=ITEMS[stack.item];
 return <article className="storage-slot"><div className="slot-index">CASE {index+1}{hotkey&&<kbd>{hotkey}</kbd>}</div><div className="slot-item"><ItemIcon item={stack.item} size={29}/><div><strong>{d.name}</strong><span>{d.stack>1?stack.count+' / '+d.stack+' par pile':'Non empilable'}</span></div></div><p>{d.description}</p><div className="slot-actions">{onUse&&<button className="item-use" disabled={disabled} onClick={onUse}>UTILISER {hotkey&&<kbd>{hotkey}</kbd>}</button>}{container&&<><button disabled={disabled} onClick={()=>onTransfer(1)}>{onUse?<ArrowUpFromLine size={14}/>:<ArrowDownToLine size={14}/>} {onUse?'Déposer':'Prendre'}{stack.count>1?' 1':''}</button>{stack.count>1&&<button disabled={disabled} onClick={()=>onTransfer()}>Pile ×{stack.count}</button>}</>}</div></article>;
}
export function InventoryView({s,game,onChange}:any){
 const c=s.container,disabled=s.health<=0||s.status!=='running';
 const transfer=(direction:string,index:number,amount?:number)=>{game.sim.transferItem(direction,index,amount);onChange();};
 const nearby=!c&&s.context?.type==='furniture';
 return <div className="inventory-view">
  <div className="inventory-summary"><span><Backpack size={18}/>{s.inventoryUsed}/{s.inventoryCapacity} cases occupées</span><span>+1 case tous les 2 grades · maximum 17</span></div>
  <div className={'storage-layout '+(c?'with-container':'')}>
   {c&&<section className="storage-section"><header><div><span className="storage-kicker">RANGEMENT À PORTÉE</span><h3>{c.name}</h3><p>{c.roomName} · {c.used}/{c.capacity} cases · {c.status.toLowerCase()}</p></div><button className="outlined-button" disabled={(!c.used&&!c.credits)||disabled} onClick={()=>{game.sim.takeAll();onChange();}}>PRENDRE LE POSSIBLE <ArrowDownToLine size={15}/></button></header><div className="furniture-credits"><span><Coins size={17}/>{c.credits||0} CR dans ce meuble</span><button disabled={!c.credits||disabled} onClick={()=>{game.sim.collectCredits();onChange();}}>RÉCUPÉRER LES CRÉDITS</button></div><div className="storage-grid">{c.items.map((stack:Stack,index:number)=><StorageSlot key={index} stack={stack} index={index} container disabled={disabled} onTransfer={amount=>transfer('take',index,amount)}/>)}</div><p className="storage-note">{c.solid?'Ce meuble bloque les déplacements et les tirs : il peut servir de couverture.':'Ce rangement au sol peut être traversé.'} Les dépôts restent dans ce meuble pendant la partie.</p></section>}
   <section className="storage-section player-storage"><header><div><span className="storage-kicker">ÉQUIPEMENT PERSONNEL</span><h3>Votre inventaire</h3><p>Grade {s.rankNumber} · {s.inventoryCapacity} cases · raccourcis AZERTY</p></div></header><div className="storage-grid" style={{"--slot-columns":Math.min(4,s.inventoryCapacity||3)} as CSSProperties}>{(s.inventory||[]).map((stack:Stack,index:number)=><StorageSlot key={index} stack={stack} index={index} hotkey={SLOT_KEYS[index]} container={!!c} disabled={disabled} onUse={()=>{game.useItem(index);onChange();}} onTransfer={amount=>transfer('store',index,amount)}/>)}</div>{nearby&&<button className="outlined-button nearby-storage" onClick={()=>{game.sim.openFurniture(s.context.id);onChange();}}>OUVRIR LE MEUBLE À PROXIMITÉ <Box size={16}/></button>}<p className="storage-note">En jeu, une touche ou un clic sur une case utilise un objet. Ici, utilisez les boutons ; Tab permet de parcourir l’interface. Échap pour retourner au combat. Les grenades sont lancées dans votre direction de visée.</p></section>
  </div>
  <p className={'inventory-feedback '+(s.itemFeedback?.ok===false?'warning':'')} role="status" aria-live="polite">{s.itemFeedback?.message||'Les échanges respectent les places et les limites de pile. Un objet inutilisable reste dans votre sac.'}</p>
 </div>;
}
