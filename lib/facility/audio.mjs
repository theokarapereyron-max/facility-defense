const MIDI=n=>440*2**((n-69)/12);
const HARMONY=[[38,53,57,60],[34,50,53,57],[41,53,57,60],[36,52,55,59]];
export class AudioSystem{
 constructor(){
  this.context=null;this.volume=.35;this.enabled=true;this.musicEnabled=true;this.musicVolume=.7;this.voices=false;
  this.lastShot=-1;this.active=0;this.nodes=new Set();this.layers={};this.scene={playing:false,music:'calm',coreAlarm:0};
  this.musicStep=0;this.nextNote=0;this.nextAlarm=0;this.alarmLevel=0;this.timers=new Set();this.destroyed=false;
 }
 unlock(){
  if(this.destroyed)return;
  if(!this.context){
   const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
   this.context=new A();const c=this.context;
   this.master=c.createGain();this.master.gain.value=this.enabled?this.volume:0;
   const limiter=c.createDynamicsCompressor();limiter.threshold.value=-13;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.18;
   this.master.connect(limiter);limiter.connect(c.destination);this.limiter=limiter;
   this.sfx=c.createGain();this.sfx.connect(this.master);this.music=c.createGain();this.music.gain.value=0;this.music.connect(this.master);
   this.alarmBus=c.createGain();this.alarmBus.gain.value=0;this.alarmBus.connect(this.master);
   for(const name of ['bed','threat','combat']){const g=c.createGain();g.gain.value=0;g.connect(this.music);this.layers[name]=g;}
   this.noise=c.createBuffer(1,c.sampleRate*.2,c.sampleRate);const samples=this.noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   this.nextNote=c.currentTime+.04;this.scheduler=setInterval(()=>this.schedule(),35);
  }
  this.context.resume().catch(()=>{});
 }
 setSettings(s){
  this.enabled=s.sound!==false;this.volume=Math.max(0,Math.min(1,(s.volume??35)/100));this.voices=s.voices;
  this.musicEnabled=s.music!==false;this.musicVolume=Math.max(0,Math.min(1,(s.musicVolume??70)/100));
  if(this.context){this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.03);this.mix();}
  if(!this.enabled)window.speechSynthesis?.cancel();
 }
 update(scene){
  const changed=this.scene.playing!==scene.playing||this.scene.music!==scene.music||this.scene.coreAlarm!==scene.coreAlarm;
  this.scene=scene;if(changed)this.mix();this.updateRotor();
 }
 updateRotor(){
  if(!this.context)return;
  const level=this.scene.playing&&this.enabled?(this.scene.rotor||0):0,c=this.context,t=c.currentTime;
  if(level>0&&!this.rotor){
   const bus=c.createGain(),filter=c.createBiquadFilter(),mod=c.createGain(),lfo=c.createOscillator();filter.type='lowpass';filter.frequency.value=360;bus.gain.value=0;filter.connect(bus);bus.connect(this.sfx);
   const oscillators=[56,89].map((frequency,i)=>{const o=c.createOscillator();o.type=i?'sawtooth':'triangle';o.frequency.value=frequency;o.connect(filter);o.start();this.nodes.add(o);return o;});
   lfo.frequency.value=11;lfo.connect(mod);mod.connect(bus.gain);mod.gain.value=0;lfo.start();this.nodes.add(lfo);this.rotor={bus,filter,mod,oscillators,lfo};
  }
  if(this.rotor){this.rotor.bus.gain.setTargetAtTime(level*.25,t,.18);this.rotor.mod.gain.setTargetAtTime(level*.07,t,.18);}
 }
 mix(){
  if(!this.context)return;const t=this.context.currentTime,s=this.scene,playing=s.playing&&this.enabled;
  this.music.gain.setTargetAtTime(playing&&this.musicEnabled?this.musicVolume:0,t,playing?.3:.08);
  this.layers.bed.gain.setTargetAtTime(s.music==='calm'?.82:.58,t,.65);
  this.layers.threat.gain.setTargetAtTime(s.music==='calm'?0:.8,t,.5);
  this.layers.combat.gain.setTargetAtTime(s.music==='combat'?.85:0,t,.35);
  this.alarmBus.gain.setTargetAtTime(playing&&s.coreAlarm?1:0,t,.025);
  if(s.coreAlarm!==this.alarmLevel){this.alarmLevel=s.coreAlarm;this.nextAlarm=t+.025;}
  if(!playing)window.speechSynthesis?.cancel();
 }
 voice(freq,duration,gain,type,bus,when,attack=.005,end=null){
  const c=this.context;if(!c||this.nodes.size>=90)return;
  const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,when);
  if(end)o.frequency.exponentialRampToValueAtTime(end,when+duration);
  g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),when+Math.min(attack,duration*.3));g.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(g);g.connect(bus);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};o.start(when);o.stop(when+duration+.015);
 }
 tone(freq,duration,gain=.2,type='sine',end=null){
  if(!this.context||!this.enabled||this.active>=12)return;
  this.active++;this.voice(freq,duration,gain,type,this.sfx,this.context.currentTime,.004,end);
  this.later(()=>{this.active=Math.max(0,this.active-1);},duration*1000+20);
 }
 later(fn,ms){const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.destroyed)fn();},ms);this.timers.add(timer);}
 percussion(when,gain,kind,bus){
  if(kind==='kick'){this.voice(110,.19,gain,'sine',bus,when,.003,42);return;}
  const c=this.context,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),duration=kind==='hat'?.045:.13;
  n.buffer=this.noise;f.type='highpass';f.frequency.value=kind==='hat'?6500:1600;
  g.gain.setValueAtTime(gain,when);g.gain.exponentialRampToValueAtTime(.0001,when+duration);n.connect(f);f.connect(g);g.connect(bus);
  this.nodes.add(n);n.onended=()=>{this.nodes.delete(n);n.disconnect();f.disconnect();g.disconnect();};n.start(when);n.stop(when+duration);
 }
 schedule(){
  const c=this.context;if(!c||c.state!=='running')return;
  const now=c.currentTime,s=this.scene;
  if(!s.playing||!this.enabled){this.nextNote=now+.05;this.nextAlarm=now+.05;return;}
  // One shared 84 BPM clock keeps the harmony aligned through every transition.
  if(this.nextNote<now-.2)this.nextNote=now+.025;
  while(this.nextNote<now+.14){if(this.musicEnabled)this.score(this.musicStep,this.nextNote);this.musicStep=(this.musicStep+1)%64;this.nextNote+=60/84/4;}
  if(s.coreAlarm&&now>=this.nextAlarm){
   const urgency=s.coreAlarm,count=urgency,frequency=[0,720,940,1180][urgency],gain=[0,.095,.16,.22][urgency];
   for(let i=0;i<count;i++)this.voice(frequency+i*65,.08,gain,'sine',this.alarmBus,now+.012+i*.13,.006);
   this.nextAlarm=now+[0,2.5,1.25,.65][urgency];
  }
 }
 score(step,t){
  const bar=Math.floor(step/16),beat=step%16,chord=HARMONY[bar],{bed,threat,combat}=this.layers;
  if(beat===0){
   for(const note of chord.slice(1))this.voice(MIDI(note),3.25,.09,'sine',bed,t,.55);
   this.voice(MIDI(chord[0]),1.8,.11,'triangle',bed,t,.13);
  }
  if(beat===6||beat===14)this.voice(MIDI(chord[beat===6?2:3]+12),1.05,.045,'sine',bed,t,.035);
  if(step%2===0){
   this.voice(MIDI(chord[0]+(beat%8===6?12:0)),.22,.115,'triangle',threat,t,.008);
   this.percussion(t,.027,'hat',threat);
  }
  if(beat%4===0)this.percussion(t,beat%8===0?.25:.12,'kick',threat);
  if(beat===4||beat===12)this.percussion(t,.07,'snare',threat);
  const pattern=[1,2,3,2,1,3,2,3];this.voice(MIDI(chord[pattern[step%8]]+12),.13,.047,'triangle',combat,t,.007);
  if(beat%2===1)this.percussion(t,.023,'hat',combat);
  if([0,3,8,10,14].includes(beat))this.percussion(t,.18,'kick',combat);
  if([4,12,15].includes(beat))this.percussion(t,.095,'snare',combat);
 }
 sound(type,u,p){
  if(!this.context||!this.enabled||!this.scene.playing)return;
  const d=u&&p?Math.hypot(u.x-p.x,u.y-p.y):0;if(u&&p&&(u.floor!==p.floor||d>1300))return;
  const gain=Math.max(.025,1-d/1300);
  if(type==='shot'){const now=this.context.currentTime;if(now-this.lastShot<.045&&u?.role!=='player')return;this.lastShot=now;this.tone(110+Math.random()*80,.065,gain*.16,'sawtooth',35);this.tone(900,.02,gain*.035,'square',100);}
  else if(type==='reload'){this.tone(360,.09,.09,'square',180);this.later(()=>this.scene.playing&&this.tone(500,.06,.08,'square'),180);}
  else if(type==='explosion'){this.tone(95,.5,gain*.22,'sawtooth',25);this.tone(48,.65,gain*.2,'sine',22);}
  else if(type==='flash')this.tone(980,.17,gain*.1,'triangle',230);
  else if(type==='door')this.tone(180,.25,.05,'sawtooth',65);
  else if(type==='supply'){this.tone(620,.1,.1);this.later(()=>this.scene.playing&&this.tone(830,.13,.1),130);}
  else if(type==='console')this.tone(720,.07,.07,'sine',960);
  else if(type==='alarm')this.tone(520,.18,.09,'sine',760);
 }
 announce(e){
  // Core alarms have their own global cadence, without overlapping sirens.
  if(e.severity==='critical'&&e.title!=='CORE UNDER ATTACK')this.sound('alarm');
  if(this.enabled&&this.voices&&window.speechSynthesis&&['critical','danger','order'].includes(e.severity)&&!window.speechSynthesis.speaking){const u=new SpeechSynthesisUtterance(e.title);u.lang='fr-FR';u.rate=1.02;u.volume=this.volume*.6;window.speechSynthesis.speak(u);}
 }
 reset(){this.musicStep=0;this.nextNote=(this.context?.currentTime||0)+.04;this.nextAlarm=0;this.alarmLevel=0;for(const n of this.nodes){try{n.stop();}catch{}}if(this.rotor){this.rotor.bus.disconnect();this.rotor.filter.disconnect();this.rotor.mod.disconnect();this.rotor=null;}this.nodes.clear();}
 destroy(){this.destroyed=true;clearInterval(this.scheduler);for(const t of this.timers)clearTimeout(t);this.timers.clear();this.reset();this.context?.close().catch(()=>{});window.speechSynthesis?.cancel();}
}
