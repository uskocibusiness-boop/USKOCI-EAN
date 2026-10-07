import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { CaretDown, CaretRight, CaretUp } from 'phosphor-react-native';
import type { WorkerAiPatch, WorkerAiProfile, WorkerAiReview } from '../../data/workerAiClientService';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { countryCode } from '../../lib/market';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { sys, card, inset, field } from '../system/tokens';
import { useAiDraftDisclosure } from '../aiFirst/AiConversationShell';
import { V2Action } from '../v2/V2Action';
import { ResolvedPinMap } from '../location/ResolvedPinMap';
import { displayedPinPosition } from '../location/ResolvedPinMap.types';
import { civilClock, civilDay, scheduleZone, weekdays } from '../calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';
import { plural } from '../system/plural';

/** One word for nothing given (2026-09-24): three different empty words read as three different states. */
const EMPTY='Nije navedeno';
const list=(values:readonly string[])=>values.length?values.join(' · '):EMPTY;
const artRole=(kind:FactArtKind):FactArtRole => kind==='pin'||kind==='map'||kind==='remote'?'location'
  :kind==='clock'||kind==='calendar'?'time':kind==='tool'||kind==='vehicle'||kind==='tasks'?'skills'
    :kind==='person'||kind==='users'?'people':'ai';
/** Live card of the worker profile proposal beside the conversation. */
export function WorkerAiCard({profile,compact,review,disabled,reviewInFooter=false,showReview=true,reviewReason}:{
  profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean;reviewInFooter?:boolean;
  showReview?:boolean;reviewReason?:string;
}){
  const { expanded, toggle } = useAiDraftDisclosure();
  const skills = profile.skills.length ? profile.skills.join(' · ') : 'Šta možeš da preuzmeš?';
  const place = `${profile.location.city || 'Područje nije navedeno'}${profile.location.operatingCountryCode ? ` · ${profile.location.operatingCountryCode}` : ''}`;
  const availability = profile.availability.availableNow ? 'Mogu odmah' : 'Mogu odmah: isključeno';
  const schedule = `${plural(profile.availability.rules.length, 'redovan termin', 'redovna termina', 'redovnih termina')} · ${plural(profile.availability.windows.length, 'poseban termin', 'posebna termina', 'posebnih termina')}`;
  const DisclosureCaret = expanded ? CaretUp : CaretDown;
  return <View testID="worker-draft-summary"
    style={[s.card,compact&&s.cardCompact]}>
    <Press testID="worker-draft-disclosure" accessibilityRole="button"
      accessibilityLabel={expanded ? 'Sakrij detalje radnog profila' : 'Pokaži detalje radnog profila'}
      accessibilityValue={{text:skills}} accessibilityState={{expanded}}
      accessibilityHint="Prikazuje sažetak unetih podataka u razgovoru."
      onPress={toggle} haptic="select" style={s.previewHead}>
      <View style={[s.grow,s.previewSummary]}>
        <T variant="label" tone="muted">Radni profil</T>
        <T variant="cardTitleCompact" numberOfLines={expanded?undefined:2} style={s.skillHeading}>{skills}</T>
      </View>
      <DisclosureCaret size={20} color={sys.color.muted}/>
    </Press>
      {showReview&&!reviewInFooter?<View style={s.reviewAction}>
        <Press testID="worker-draft-review" accessibilityRole="button" accessibilityLabel="Pregledaj profil"
          accessibilityHint={disabled&&reviewReason?reviewReason:'Otvara sve podatke pre završnog čuvanja.'}
          accessibilityState={{disabled}} disabled={disabled}
          onPress={() => { if (!disabled) review(); }} haptic={disabled?'none':'select'} style={s.reviewLink}>
          <T variant="note" style={[s.reviewLabel,disabled&&s.muted]}>Pregledaj profil</T>
          <ReviewCue disabled={disabled}/>
        </Press>
        {disabled&&reviewReason?<T accessibilityLiveRegion="polite" variant="note" tone="muted">{reviewReason}</T>:null}
      </View>:null}
    {expanded?<View testID="worker-draft-details" style={s.previewFacts}>
        <PreviewFact art="pin">{`${place} · ${profile.location.radiusKm} km`}</PreviewFact>
        <PreviewFact art="clock">{availability}</PreviewFact>
        {profile.tools.length?<PreviewFact art="tool">{list(profile.tools)}</PreviewFact>:null}
        {profile.vehicles.length?<PreviewFact art="vehicle">{list(profile.vehicles)}</PreviewFact>:null}
        {profile.availability.rules.length||profile.availability.windows.length?<PreviewFact art="calendar">{schedule}</PreviewFact>:null}
      </View>:null}
  </View>;
}
function ReviewCue({disabled}:{disabled:boolean}){
  return <View style={[s.reviewCue,disabled&&s.reviewCueDisabled]}>
    <CaretRight size={18} weight="bold" color={disabled?sys.color.muted:sys.color.onGreen}/>
  </View>;
}
function PreviewFact({art,children}:{art:FactArtKind;children:string}){
  return <View style={s.previewFact}>{art === 'clock' ? <ClockArt size={24} /> : <FactArt kind={art} size={24} cut="art" role={artRole(art)}/>}<T variant="note" style={[s.grow,s.ink]}>{children}</T></View>;
}
function Row({label,value,quiet=false}:{label:string;value:string;quiet?:boolean}){
  return <View style={s.row}><T variant="meta" tone="muted">{label}</T><T selectable variant="body" style={quiet?s.muted:s.ink}>{value}</T></View>;
}
function ReviewSection({title,art,children}:{title:string;art:FactArtKind;children:ReactNode}){
  return <View style={s.reviewSection}>
    <View style={s.sectionHead}><View style={s.sectionIcon}><FactArt kind={art} size={40} role={artRole(art)}/></View>
      <T accessibilityRole="header" variant="heading" style={[s.grow,s.skillHeading]}>{title}</T></View>
    <View style={s.reviewRows}>{children}</View>
  </View>;
}
/** Owner 2026-10-07: the interview ends by saying what the profile is for — ink with the bell, not grey small print. */
// "novim i već otvorenim": publishing queues new tasks, and saving the profile re-queues the open ones (requeue_open_needs_for_worker_v5).
export const WORKER_PROFILE_NOTIFICATIONS_NOTE='Podaci iz tvog radnog profila koriste se za obaveštenja o novim i već otvorenim zadacima koji odgovaraju tvojim veštinama, području i vremenu.';
export function WorkerAiNotificationsNote(){
  return <View style={s.previewFact}><FactArt kind="bell" size={24} cut="art"/>
    <T testID="worker-review-notifications-note" variant="body" style={[s.grow,s.ink]}>{WORKER_PROFILE_NOTIFICATIONS_NOTE}</T></View>;
}
/** Frozen personal-profile review. Legacy wire fields remain stored, but the personal-profile save no longer writes them. */
export function WorkerAiReviewDetails({review}:{review:WorkerAiReview}){
  const p=review.profile;
  const point=displayedPinPosition(p.location.approximatePosition,true);
  return <View style={s.review}>
    <View style={s.reviewIntro}>
      <View style={s.sectionHead}><View style={s.introIcon}><FactArt kind="person" size={48} role="people"/></View>
        <T accessibilityRole="header" variant="title" style={[s.grow,s.skillHeading]}>{p.displayName||'Radni profil'}</T></View>
      <T variant="note" tone="muted">Ovako izgleda tvoj radni profil. Proveri podatke pre čuvanja.</T>
    </View>
    {review.missingRequired.length?<View style={s.reviewNotice}><FactArt kind="info" size={24} cut="art" role="waiting"/>
      <T accessibilityRole="alert" variant="body" style={[s.grow,s.ink]}>Dopuni: {review.missingRequired.join(', ')}.</T></View>:null}
    <ReviewSection title="Šta radiš" art="tasks">
      <Row label="Veštine i usluge" value={list(p.skills)} />
      {p.bio?<Row label="O tebi" value={p.bio} />:null}
    </ReviewSection>
    <ReviewSection title="Tvoja oprema" art="tool">
      <Row label="Alat i oprema" value={list(p.tools)} /><Row label="Vozila" value={list(p.vehicles)} />
    </ReviewSection>
    <ReviewSection title="Područje rada" art="map">
      <Row label="Grad i država" value={`${p.location.city||EMPTY}${p.location.operatingCountryCode?' · '+p.location.operatingCountryCode:''}`} />
      <Row label="Radijus rada" value={`${p.location.radiusKm} km`} />
      {point?<ResolvedPinMap coarse disabled height={220} position={point}
        scopeKey={`worker-review:${review.accountId}:${review.profileId}:${review.reviewId}:${review.revision}`}
        onChoose={()=>{ /* Frozen review, never a location editor. */ }}/>:null}
      <T variant="note" tone="muted">{point?'Približan centar tvog područja rada.':'Približnu tačku na mapi dodaješ posle čuvanja, u delu Područje rada.'}</T>
    </ReviewSection>
    <ReviewSection title="Kada možeš da radiš" art="clock">
      <Row label="Dostupnost" value={p.availability.availableNow?'Mogu odmah, dok to ne isključiš':'Status „Mogu odmah“ je isključen'} />
      {p.availability.rules.length?<View style={s.scheduleGroup}>
        <T variant="bodyStrong">Redovna nedelja</T>
        {p.availability.rules.map(rule=><Row key={rule.id} quiet={!rule.active}
          label={weekdays.filter(day=>rule.weekdays.includes(day.day)).map(day=>day.name).join(' · ')}
          value={`${civilClock(rule.startTime)}–${civilClock(rule.endTime)} · od ${civilDay(rule.startsOn)}${rule.endsOn?' do '+civilDay(rule.endsOn):''}${rule.active?'':' · pauzirano'}${rule.label?' · '+rule.label:''}`} />)}
      </View>:<T variant="note" tone="muted">Redovni termini nisu podešeni.</T>}
      {p.availability.windows.length?<View style={s.scheduleGroup}>
        <T variant="bodyStrong">Posebni datumi</T>
        {p.availability.windows.map(w=><Row key={w.id} label={w.state==='AVAILABLE'?'Slobodno za rad':'Zauzeto'}
          value={`${raspon(w.startsAt,w.endsAt,{zona:p.availability.timezone})}${w.label?' · '+w.label:''}`} />)}
      </View>:null}
      <T variant="note" tone="muted">{scheduleZone(p.availability.timezone)}. Postojeći Dogovori ostaju obaveze.</T>
    </ReviewSection>
    <T testID="worker-matching-explanation" variant="note" tone="muted">Za preporuke su važni veštine, područje rada i dostupnost. Alat i vozila pomažu da se provere uslovi zadatka. Ime i predstavljanje ne menjaju poklapanje.</T>
  </View>;
}
function Field({label,value,change,disabled,numeric=false,multiline=false}:{label:string;value:string;change:(v:string)=>void;disabled:boolean;numeric?:boolean;multiline?:boolean}){
  return <View style={{gap:6}}><T variant="meta" tone="muted">{label}</T><TextInput accessibilityLabel={label} style={[s.input,multiline&&s.multiline]}
    value={value} editable={!disabled} onChangeText={v=>{if(!disabled)change(v);}} multiline={multiline} keyboardType={numeric?'number-pad':'default'} maxLength={numeric?3:multiline?25500:160}/></View>;
}
/** Manual correction of the proposal; applied to the proposal, saved only through the final review. */
export type WorkerAiManualDraft={name:string;bio:string;city:string;country:string;radius:string;skills:string;tools:string;vehicles:string};
export function WorkerAiManual({profile,disabled,apply,initialDraft,onDraftChange}:{profile:WorkerAiProfile;disabled:boolean;apply:(patch:WorkerAiPatch)=>void;
  initialDraft?:WorkerAiManualDraft;onDraftChange?:(value:WorkerAiManualDraft,dirty:boolean)=>void}){
  const initial=useRef({name:profile.displayName,bio:profile.bio,city:profile.location.city,country:profile.location.operatingCountryCode??'',
    radius:String(profile.location.radiusKm),skills:profile.skills.join('\n'),tools:profile.tools.join('\n'),vehicles:profile.vehicles.join('\n')});
  const [values,setValues]=useState(initialDraft??initial.current),latest=useRef(values),notify=useRef(onDraftChange);notify.current=onDraftChange;
  const alive=useRef(true),editable=useRef(!disabled);editable.current=!disabled;
  const {name,bio,city,country,radius,skills,tools,vehicles}=values;
  // A fresh revision mounts a fresh form. Report edits synchronously so Back in
  // the same event batch cannot discard a keystroke before an effect runs.
  const dirty=(value:WorkerAiManualDraft)=>(Object.keys(value) as (keyof WorkerAiManualDraft)[]).some(field=>value[field]!==initial.current[field]);
  useEffect(()=>{alive.current=true;notify.current?.(latest.current,dirty(latest.current));return()=>{alive.current=false;};},[]);
  const change=(key:keyof typeof values,value:string)=>{
    if(!alive.current||!editable.current)return;
    const next={...latest.current,[key]:value};latest.current=next;setValues(next);
    notify.current?.(next,dirty(next));
  };
  const [error,setError]=useState<string|null>(null);
  const submit=()=>{
    if(!alive.current||!editable.current)return;
    const {name,bio,city,country,radius,skills,tools,vehicles}=latest.current;
    // Match the canonical ASCII btrim; Unicode whitespace is part of an authored term.
    const arrays=[skills,tools,vehicles].map(v=>capabilityTerms(v.split('\n').map(x=>x.replace(/^ +| +$/g,'')).filter(Boolean)));
    const countryValue=country.trim()?countryCode(country.trim().toUpperCase()):null;
    if(!arrays.every(Boolean)||!/^\d{1,3}$/.test(radius)||Number(radius)<1||Number(radius)>200
      ||(country.trim()&&!countryValue)||bio.length>4000){setError('Proveri liste, državu i radijus 1–200 km. Predstavljanje može imati do 4.000 znakova.');return;}
    apply({displayName:name,bio,skills:arrays[0]!,tools:arrays[1]!,vehicles:arrays[2]!,
      location:{city,operatingCountryCode:countryValue,radiusKm:Number(radius)}});
  };
  return <><T variant="meta" tone="muted">Izmene ostaju u predlogu do završnog pregleda i čuvanja. U liste unesi jednu stavku po redu.</T>
    <View style={s.section}><T variant="heading" style={s.ink}>Ko si i šta radiš</T>
      <Field disabled={disabled} label="Ime na profilu" value={name} change={v=>change('name',v)}/><Field disabled={disabled} label="Veštine i usluge" value={skills} change={v=>change('skills',v)} multiline/>
      <Field disabled={disabled} label="Alat i oprema" value={tools} change={v=>change('tools',v)} multiline/><Field disabled={disabled} label="Vozila" value={vehicles} change={v=>change('vehicles',v)} multiline/>
      <Field disabled={disabled} label="Kratko predstavljanje" value={bio} change={v=>change('bio',v)} multiline/></View>
    <View style={s.section}><T variant="heading" style={s.ink}>Područje rada</T>
      <Field disabled={disabled} label="Država rada (npr. RS)" value={country} change={v=>change('country',v)}/>
      <Field disabled={disabled} label="Grad ili mesto rada" value={city} change={v=>change('city',v)}/><Field disabled={disabled} label="Radijus rada u km" value={radius} change={v=>change('radius',v)} numeric/></View>
    {error?<View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T></View>:null}<V2Action tone="neutral" label="Primeni na pregled profila" disabled={disabled} onPress={submit}/>
  </>;
}
export function WorkerAiActivation({activate,disabled,change}:{activate:boolean;disabled:boolean;change:(v:boolean)=>void}){
  return <View style={s.activation}><View style={{flex:1}}><T variant="bodyStrong" style={s.ink}>Aktiviraj profil posle čuvanja</T><T variant="meta" tone="muted">Isključeno: profil ostaje nacrt.</T></View>
    <Switch accessibilityLabel="Aktiviraj profil posle čuvanja" value={activate} disabled={disabled} onValueChange={change} trackColor={{true:sys.color.ink,false:sys.color.lineStrong}} thumbColor={sys.color.surface}/></View>;
}
const s=StyleSheet.create({
  ink:{color:sys.color.ink},
  muted:{color:sys.color.muted},
  grow:{flex:1,minWidth:0},
  card:{...card,paddingHorizontal:sys.space.base,paddingVertical:8,gap:4,minHeight:48,
    backgroundColor:sys.conversation.summary,borderColor:sys.conversation.edge},
  cardCompact:{paddingVertical:6,borderRadius:sys.radius.cardCompact},
  previewHead:{minHeight:48,flexDirection:'row',alignItems:'center',gap:sys.space.md},
  previewSummary:{gap:sys.space.xs},
  skillHeading:{color:sys.color.ink},
  previewFacts:{gap:sys.space.sm},
  previewFact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm},
  reviewAction:{gap:4},
  reviewLink:{minHeight:48,flexDirection:'row',alignItems:'center',gap:sys.space.sm},
  reviewLabel:{flex:1,minWidth:0,color:sys.color.ink,fontWeight:'700'},
  reviewCue:{flexShrink:0,width:28,height:28,borderRadius:sys.radius.pill,backgroundColor:sys.color.ink,alignItems:'center',justifyContent:'center'},
  reviewCueDisabled:{backgroundColor:sys.conversation.iconWell},
  review:{gap:sys.space.xl},
  reviewIntro:{gap:sys.space.md,paddingBottom:sys.space.sm},
  introIcon:{width:56,height:56,alignItems:'center',justifyContent:'center'},
  reviewSection:{gap:sys.space.base,paddingTop:sys.space.lg,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:sys.color.line},
  sectionHead:{flexDirection:'row',alignItems:'center',gap:sys.space.md},
  sectionIcon:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  reviewRows:{gap:sys.space.base},
  reviewNotice:{padding:sys.space.base,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft,flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  section:{gap:sys.space.base,paddingVertical:sys.space.base},
  scheduleGroup:{gap:sys.space.md},
  row:{gap:sys.space.xs,minWidth:0},
  notice:{padding:14,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft},
  input:{...field},
  multiline:{minHeight:96,textAlignVertical:'top'},
  // A flat tint, not the orange budget (critique B19): the one orange on the review is not a switch row.
  activation:{...inset,padding:16,backgroundColor:sys.color.wash,flexDirection:'row',gap:12,alignItems:'center'},
});
