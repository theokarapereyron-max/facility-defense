"use client";
import {ArrowUpRight,Shield,Wrench,Heart,Target,Check,MousePointer2,X} from 'lucide-react';
export function FieldDirective({intel,onLocate}:any){
 const o=intel?.objective;if(!o)return null;const Icon=o.kind==='repair'?Wrench:o.kind==='medical'?Heart:o.kind==='contact'?Target:Shield;
 return <button className={'field-directive '+o.kind} onClick={()=>onLocate(o)} title={o.detail+' Cliquez pour tracer un itinéraire.'}><span className="directive-kicker">PRIORITÉ DE TERRAIN <b>NIV. {o.level}</b></span><span className="directive-title"><Icon size={17}/><strong>{o.label}</strong><ArrowUpRight size={15}/></span><small>{o.detail}</small></button>;
}
export function CombatCoach({mouseAim,onDismiss}:any){return <div className="combat-coach"><MousePointer2 size={18}/><span>{mouseAim?<><b>Visez à la souris.</b> Clic maintenu pour tirer. Cliquez sur un allié pour le sélectionner.</>:<><b>ZQSD pour avancer.</b> Flèches pour viser, Espace pour tirer.</>}<small>E pour interagir · E maintenu pour réparer · M pour la carte</small></span><button onClick={onDismiss} aria-label="Masquer l’aide de combat"><X size={16}/></button></div>;}
export function Commendation({value}:any){if(!value)return null;return <div key={value.time} className="combat-commendation" role="status"><Check size={21}/><span><small>SÉRIE CONFIRMÉE · {value.count}</small><b>{value.label}</b></span></div>;}
