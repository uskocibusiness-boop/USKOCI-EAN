import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import type { WorkerAiPatch, WorkerAiProfile, WorkerAiReview } from '../../data/workerAiClientService';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { countryCode } from '../../lib/market';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { useLayoutClass } from '../system/textScale';
import { layout } from '../system/layout';
import { Surface } from '../system/Surface';
import { sys, field, brandAction } from '../system/tokens';
import { useAiDraftDisclosure } from '../aiFirst/AiConversationShell';
import { FactListEditor } from '../aiFirst/FactValueEditors';
import { V2Action } from '../v2/V2Action';
import { cityLabel } from '../profile/cityLabel';
import { ResolvedPinMap } from '../location/ResolvedPinMap';
import { displayedPinPosition } from '../location/ResolvedPinMap.types';
import { civilClock, civilDay, scheduleZone, weekdays } from '../calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';
import { plural } from '../system/plural';
import { WORKER_PART_TITLE, capturedParts, capturedSpeech, toolsAndVehiclesNote, type WorkerAiPart } from './workerProfileFacts';

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
  const place = `${profile.location.city.trim() ? cityLabel(profile.location.city) : 'Područje nije navedeno'}${profile.location.operatingCountryCode ? ` · ${profile.location.operatingCountryCode}` : ''}`;
  const availability = profile.availability.availableNow ? 'Mogu odmah' : 'Mogu odmah: isključeno';
  const schedule = `${plural(profile.availability.rules.length, 'redovan termin', 'redovna termina', 'redovnih termina')} · ${plural(profile.availability.windows.length, 'poseban termin', 'posebna termina', 'posebnih termina')}`;
  return <Surface kind="panel" testID="worker-draft-summary"
    style={[s.card,compact&&s.cardCompact]}>
    <WorkerAiProgress profile={profile}/>
    <Press testID="worker-draft-disclosure" accessibilityRole="button"
      accessibilityLabel={expanded ? 'Sakrij detalje radnog profila' : 'Pokaži detalje radnog profila'}
      accessibilityValue={{text:skills}} accessibilityState={{expanded}}
      accessibilityHint="Prikazuje sažetak unetih podataka u razgovoru."
      onPress={toggle} haptic="select" style={s.previewHead}>
      <View style={[s.grow,s.previewSummary]}>
        <T variant="cardTitleCompact" numberOfLines={expanded?undefined:2} style={s.skillHeading}>{skills}</T>
      </View>
      <Glyph name={expanded?'caret-up':'caret-down'} tone="muted"/>
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
  </Surface>;
}
function ReviewCue({disabled}:{disabled:boolean}){
  return <View style={[s.reviewCue,disabled&&s.reviewCueDisabled]}>
    <Glyph name="caret-right" size={16} tone={disabled?'muted':'onGreen'}/>
  </View>;
}
/**
 * What the conversation has understood so far, from the draft itself: four parts, a green bar for each one the draft
 * holds. It is not "question 2 of 5": the assistant asks what is missing and has no fixed number of questions, so the
 * strip never counts them. A part with nothing in it is simply not green; tools and vehicles are optional.
 */
export function WorkerAiProgress({profile}:{profile:WorkerAiProfile}){
  const parts=capturedParts(profile),speech=capturedSpeech(parts);
  // At a large text size four labels do not fit in a row: two by two.
  const {stacked}=useLayoutClass();
  return <View testID="worker-draft-progress" accessible accessibilityRole="progressbar" accessibilityLabel={speech}
    accessibilityValue={{min:0,max:parts.length,now:parts.filter(part=>part.done).length}} style={[s.progress,stacked&&s.progressStacked]}>
    {parts.map(part=><View key={part.key} style={[s.progressPart,stacked&&s.progressPartStacked]}>
      <View testID={`worker-draft-progress-${part.key}`} style={[s.progressBar,part.done&&s.progressBarDone]}/>
      <T variant="meta" numberOfLines={1} style={part.done?s.ink:s.muted}>{part.label}</T>
    </View>)}
  </View>;
}
function PreviewFact({art,children}:{art:FactArtKind;children:string}){
  return <View style={s.previewFact}>{art === 'clock' ? <ClockArt size={24} /> : <FactArt kind={art} size={24} cut="art" role={artRole(art)}/>}<T variant="note" style={[s.grow,s.ink]}>{children}</T></View>;
}
function Row({label,value,quiet=false}:{label:string;value:string;quiet?:boolean}){
  return <View style={s.row}><T variant="meta" tone="muted">{label}</T><T selectable variant="body" style={quiet?s.muted:s.ink}>{value}</T></View>;
}
/** A fact of the review beside its picture, at reading size. */
function Fact({art,children,quiet=false}:{art:FactArtKind;children:string;quiet?:boolean}){
  return <View style={s.fact}>{art==='clock'?<ClockArt size={24}/>:<FactArt kind={art} size={24} cut="art" role={artRole(art)}/>}
    <T selectable variant="body" style={[s.grow,quiet?s.muted:s.ink]}>{children}</T></View>;
}
/**
 * One part of the review (M2): its title with "Izmeni" at its side, and what the conversation understood under it.
 * "Izmeni" is a 44 dp target that names the part it opens ("Izmeni: Veštine"); without `onEdit` (the design gallery) the
 * group is only read.
 */
function ReviewGroup({part,onEdit,editDisabled=false,children}:{part:WorkerAiPart;
  onEdit?:(part:WorkerAiPart)=>void;editDisabled?:boolean;children:ReactNode}){
  const title=WORKER_PART_TITLE[part];
  return <View testID={`worker-review-${part}`} style={s.group}>
    <View style={s.groupHead}>
      <T accessibilityRole="header" variant="bodyStrong" style={[s.grow,s.ink]}>{title}</T>
      {onEdit?<Press accessibilityRole="button" accessibilityLabel={`Izmeni: ${title}`} accessibilityState={{disabled:editDisabled}}
        disabled={editDisabled} haptic={editDisabled?'none':'select'} onPress={()=>{if(!editDisabled)onEdit(part);}} style={s.edit}>
        <T variant="tab" style={editDisabled?s.muted:s.editText}>Izmeni</T>
      </Press>:null}
    </View>
    <View style={s.groupBody}>{children}</View>
  </View>;
}
/** Owner 2026-10-07: the interview ends by saying what the profile is for — ink with the bell, not grey small print. */
// "novim i već otvorenim": publishing queues new tasks, and saving the profile re-queues the open ones (requeue_open_needs_for_worker_v5).
export const WORKER_PROFILE_NOTIFICATIONS_NOTE='Podaci iz tvog radnog profila koriste se za obaveštenja o novim i već otvorenim zadacima koji odgovaraju tvojim veštinama, području i vremenu.';
export function WorkerAiNotificationsNote(){
  return <Surface kind="note" style={s.noteBox}><FactArt kind="bell" size={24} cut="art"/>
    <T testID="worker-review-notifications-note" variant="note" style={[s.grow,s.ink]}>{WORKER_PROFILE_NOTIFICATIONS_NOTE}</T></Surface>;
}
/** The server names the missing name "Ime"; it is the name of the ACCOUNT now (owner, 8 Oct 2026), so that is what the person is told to add. */
const missingLabel=(label:string)=>label==='Ime'?'Ime naloga':label;
/**
 * Frozen personal-profile review (M2): what the conversation understood, in parts, each with "Izmeni" at its side. Legacy
 * wire fields remain stored, but the personal-profile save no longer writes them. Nothing here is a location editor: the
 * map is the frozen approximate centre, and every correction goes through the part's own editor and a fresh review.
 *
 * There is no row for the name: the profile is saved under the name of the account (owner, 8 Oct 2026: one name for everything), which the route puts into
 * the proposal before the review is made. Only when the account has no name at all does the review say so, with `onAddName` leading to the one place
 * it is written ("Lični podaci").
 */
export function WorkerAiReviewDetails({review,onEdit,editDisabled=false,onAddName}:{review:WorkerAiReview;
  /** Opens the editor of one part. Absent (the design gallery): the review is only read. */
  onEdit?:(part:WorkerAiPart)=>void;editDisabled?:boolean;
  /** The way to "Lični podaci" when the account has no name; without it the missing name is only said. */ onAddName?:()=>void}){
  const p=review.profile;
  const point=displayedPinPosition(p.location.approximatePosition,true);
  const place=[p.location.city.trim()?cityLabel(p.location.city):null,p.location.operatingCountryCode].filter(Boolean).join(' · ');
  const group={onEdit,editDisabled};
  return <View style={s.review}>
    {review.missingRequired.length?<View style={s.reviewNotice}><FactArt kind="info" size={24} cut="art" role="waiting"/>
      <T accessibilityRole="alert" variant="body" style={[s.grow,s.ink]}>Dopuni: {review.missingRequired.map(missingLabel).join(', ')}.</T></View>:null}
    {review.missingRequired.includes('Ime')&&onAddName?<V2Action label="Dodaj ime" kind="secondary" compact onPress={onAddName} style={s.addName}/>:null}
    <ReviewGroup part="skills" {...group}>
      {p.skills.length?<View style={s.chips}>{p.skills.map((skill,index)=><View key={`${index}:${skill}`} style={s.chip}>
        <T selectable variant="note" style={s.chipText}>{skill}</T></View>)}</View>:<T variant="body" tone="muted">{EMPTY}</T>}
    </ReviewGroup>
    <ReviewGroup part="area" {...group}>
      <Fact art="pin" quiet={!place}>{place?`${place} · do ${p.location.radiusKm} km`:EMPTY}</Fact>
      {point?<ResolvedPinMap coarse disabled height={220} position={point}
        scopeKey={`worker-review:${review.accountId}:${review.profileId}:${review.reviewId}:${review.revision}`}
        onChoose={()=>{ /* Frozen review, never a location editor. */ }}/>:null}
      <T variant="note" tone="muted">{point?'Približan centar tvog područja rada.':'Približnu tačku na mapi dodaješ posle čuvanja, u delu Područje rada.'}</T>
    </ReviewGroup>
    <ReviewGroup part="time" {...group}>
      <Fact art="clock">{p.availability.availableNow?'Mogu odmah, dok to ne isključiš':'Status „Mogu odmah“ je isključen'}</Fact>
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
    </ReviewGroup>
    <ReviewGroup part="tools" {...group}>
      {p.tools.length?<Fact art="tool">{list(p.tools)}</Fact>:null}
      {p.vehicles.length?<Fact art="vehicle">{list(p.vehicles)}</Fact>:null}
      {p.tools.length||p.vehicles.length?null:<T variant="body" tone="muted">{EMPTY}</T>}
      <T testID="worker-tools-note" variant="note" tone="muted">{toolsAndVehiclesNote()}</T>
    </ReviewGroup>
    <ReviewGroup part="identity" {...group}>
      {p.bio?<Row label="O meni" value={p.bio} />:<T variant="body" tone="muted">{EMPTY}</T>}
      {p.bio?<T testID="worker-matching-explanation" variant="note" tone="muted">„O meni“ vide osobe koje otvore tvoj profil.</T>:null}
    </ReviewGroup>
  </View>;
}
function Field({label,value,change,disabled,numeric=false,multiline=false}:{label:string;value:string;change:(v:string)=>void;disabled:boolean;numeric?:boolean;multiline?:boolean}){
  return <View style={{gap:sys.space.sm}}><T variant="meta" tone="muted">{label}</T><TextInput accessibilityLabel={label} style={[s.input,multiline&&s.multiline]}
    value={value} editable={!disabled} onChangeText={v=>{if(!disabled)change(v);}} multiline={multiline} keyboardType={numeric?'number-pad':'default'} maxLength={numeric?3:multiline?25500:160}/></View>;
}
/** Manual correction of the proposal; applied to the proposal, saved only through the final review. */
export type WorkerAiManualDraft={bio:string;city:string;country:string;radius:string;skills:string;tools:string;vehicles:string};
/** The part a focused editor corrects; the week has the calendar form of its own. */
export type WorkerAiManualPart=Exclude<WorkerAiPart,'time'>;
/** The patch is built field by field here; the wire type is read-only. */
type Writable<T>={-readonly [K in keyof T]:T[K]};
/** A list in the draft is one item per line; the canonical btrim removes ASCII spaces only. */
const lines=(value:string)=>value.split('\n').map(x=>x.replace(/^ +| +$/g,'')).filter(Boolean);
type ListKey='skills'|'tools'|'vehicles';
/**
 * Manual correction of the proposal; applied to the proposal, saved only through the final review.
 *
 * Without `only` it is the whole form ("Ručno uredi podatke" behind "···"): lists are text, one item per line. With `only`
 * it is the editor of ONE part (what "Izmeni" in the review and "+" in the conversation open): lists use the app's list
 * editor (`FactListEditor`, a word left in its box is kept), and the patch carries only that part's fields, so an
 * untouched field is never written back.
 */
export function WorkerAiManual({profile,disabled,apply,initialDraft,onDraftChange,only}:{profile:WorkerAiProfile;disabled:boolean;apply:(patch:WorkerAiPatch)=>void;
  initialDraft?:WorkerAiManualDraft;onDraftChange?:(value:WorkerAiManualDraft,dirty:boolean)=>void;only?:WorkerAiManualPart}){
  const initial=useRef({bio:profile.bio,city:profile.location.city,country:profile.location.operatingCountryCode??'',
    radius:String(profile.location.radiusKm),skills:profile.skills.join('\n'),tools:profile.tools.join('\n'),vehicles:profile.vehicles.join('\n')});
  const [values,setValues]=useState(initialDraft??initial.current),latest=useRef(values),notify=useRef(onDraftChange);notify.current=onDraftChange;
  const alive=useRef(true),editable=useRef(!disabled);editable.current=!disabled;
  // What was typed into a list's box and not yet added: the list editor reports it, and saving keeps it.
  const boxes=useRef<Record<ListKey,string>>({skills:'',tools:'',vehicles:''});
  const {bio,city,country,radius,skills,tools,vehicles}=values;
  // A fresh revision mounts a fresh form. Report edits synchronously so Back in
  // the same event batch cannot discard a keystroke before an effect runs.
  const dirty=(value:WorkerAiManualDraft)=>(Object.keys(value) as (keyof WorkerAiManualDraft)[]).some(field=>value[field]!==initial.current[field])
    ||Object.values(boxes.current).some(word=>word.trim().length>0);
  useEffect(()=>{alive.current=true;notify.current?.(latest.current,dirty(latest.current));return()=>{alive.current=false;};},[]);
  const change=(key:keyof typeof values,value:string)=>{
    if(!alive.current||!editable.current)return;
    const next={...latest.current,[key]:value};latest.current=next;setValues(next);
    notify.current?.(next,dirty(next));
  };
  const changeList=(key:ListKey)=>(items:string[],word:string)=>{
    if(!alive.current||!editable.current)return;
    boxes.current={...boxes.current,[key]:word};change(key,items.join('\n'));
  };
  const [error,setError]=useState<string|null>(null);
  const submit=()=>{
    if(!alive.current||!editable.current)return;
    const {bio,city,country,radius,skills,tools,vehicles}=latest.current;
    const all=!only,patch:Writable<WorkerAiPatch>={};
    const fail=(focused:string)=>{setError(all?'Proveri veštine, alat, vozila, državu i radijus (1–200 km). Tekst „O meni“ može imati do 4.000 znakova.':focused);};
    // Match the canonical ASCII btrim; Unicode whitespace is part of an authored term.
    const terms=(key:ListKey,text:string)=>{const base=lines(text),word=boxes.current[key].trim();
      return capabilityTerms(word&&!base.includes(word)?[...base,word]:base);};
    if(all||only==='identity'){
      if(bio.length>4000)return fail('O meni može imati do 4.000 znakova.');
      patch.bio=bio;
    }
    if(all||only==='skills'){
      const list=terms('skills',skills);if(!list)return fail('Lista može imati do 50 stavki, do 500 znakova po stavci.');
      patch.skills=list;
    }
    if(all||only==='tools'){
      const toolList=terms('tools',tools),vehicleList=terms('vehicles',vehicles);
      if(!toolList||!vehicleList)return fail('Lista može imati do 50 stavki, do 500 znakova po stavci.');
      patch.tools=toolList;patch.vehicles=vehicleList;
    }
    if(all||only==='area'){
      const countryValue=country.trim()?countryCode(country.trim().toUpperCase()):null;
      if(!/^\d{1,3}$/.test(radius)||Number(radius)<1||Number(radius)>200||(country.trim()&&!countryValue))return fail('Proveri državu i radijus 1–200 km.');
      patch.location={city,operatingCountryCode:countryValue,radiusKm:Number(radius)};
    }
    apply(patch);
  };
  const listEditor=(key:ListKey,label:string,text:string)=><View key={key} style={s.listEditor}>
    <T variant="bodyStrong" style={s.ink}>{label}</T>
    <FactListEditor label={label} items={lines(text)} disabled={disabled} onChange={changeList(key)}/></View>;
  const area=<View style={s.section}>{!only?<T variant="heading" style={s.ink}>Područje rada</T>:null}
    <Field disabled={disabled} label="Država rada (npr. RS)" value={country} change={v=>change('country',v)}/>
    <Field disabled={disabled} label="Grad ili mesto rada" value={city} change={v=>change('city',v)}/>
    <Field disabled={disabled} label="Radijus rada u km" value={radius} change={v=>change('radius',v)} numeric/></View>;
  const body=!only?<>
    <T variant="meta" tone="muted">Izmene ostaju u predlogu do završnog pregleda i čuvanja. U polja sa više stavki upiši jednu stavku po redu.</T>
    <View style={s.section}><T variant="heading" style={s.ink}>Šta radiš</T>
      <Field disabled={disabled} label="Veštine i usluge" value={skills} change={v=>change('skills',v)} multiline/>
      <Field disabled={disabled} label="Alat i oprema" value={tools} change={v=>change('tools',v)} multiline/><Field disabled={disabled} label="Vozila" value={vehicles} change={v=>change('vehicles',v)} multiline/>
      <Field disabled={disabled} label="O meni" value={bio} change={v=>change('bio',v)} multiline/></View>
    {area}
  </>:<>
    <T variant="meta" tone="muted">Izmena ostaje u predlogu do završnog pregleda i čuvanja.</T>
    {only==='identity'?<View style={s.section}>
      <Field disabled={disabled} label="O meni" value={bio} change={v=>change('bio',v)} multiline/></View>:null}
    {only==='skills'?listEditor('skills','Veštine i usluge',skills):null}
    {only==='tools'?<>{listEditor('tools','Alat i oprema',tools)}{listEditor('vehicles','Vozila',vehicles)}</>:null}
    {only==='area'?area:null}
  </>;
  return <>{body}
    {error?<View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T></View>:null}
    <V2Action label="Primeni na pregled profila" disabled={disabled} onPress={submit} style={brandAction}/>
  </>;
}
export function WorkerAiActivation({activate,disabled,change}:{activate:boolean;disabled:boolean;change:(v:boolean)=>void}){
  return <Surface kind="note" style={s.activation}><View style={{flex:1}}><T variant="bodyStrong" style={s.ink}>Aktiviraj profil posle čuvanja</T><T variant="meta" tone="muted">Isključeno: profil ostaje nacrt.</T></View>
    <Switch accessibilityLabel="Aktiviraj profil posle čuvanja" value={activate} disabled={disabled} onValueChange={change} trackColor={{true:sys.color.green,false:sys.color.muted}} thumbColor={sys.color.surface}/></Surface>;
}
const s=StyleSheet.create({
  ink:{color:sys.color.ink},
  muted:{color:sys.color.muted},
  grow:{flex:1,minWidth:0},
  card:{paddingHorizontal:sys.space.base,paddingVertical:sys.space.sm,gap:sys.space.xs,minHeight:layout.touch,
    backgroundColor:sys.conversation.summary,borderColor:sys.conversation.edge},
  cardCompact:{paddingVertical:sys.space.sm,borderRadius:sys.radius.cardCompact},
  previewHead:{minHeight:48,flexDirection:'row',alignItems:'center',gap:sys.space.md},
  previewSummary:{gap:sys.space.xs},
  skillHeading:{color:sys.color.ink},
  previewFacts:{gap:sys.space.sm},
  previewFact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm},
  reviewAction:{gap:sys.space.xs},
  reviewLink:{minHeight:48,flexDirection:'row',alignItems:'center',gap:sys.space.sm},
  reviewLabel:{flex:1,minWidth:0,color:sys.color.ink,fontWeight:'700'},
  reviewCue:{flexShrink:0,width:28,height:28,borderRadius:sys.radius.pill,backgroundColor:sys.color.ink,alignItems:'center',justifyContent:'center'},
  reviewCueDisabled:{backgroundColor:sys.conversation.iconWell},
  progress:{flexDirection:'row',gap:sys.space.sm,paddingTop:sys.space.xs,paddingBottom:sys.space.xs},
  progressStacked:{flexWrap:'wrap',rowGap:sys.space.sm},
  progressPart:{flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,gap:sys.space.xs},
  progressPartStacked:{flexBasis:'45%'},
  progressBar:{height:4,borderRadius:2,backgroundColor:sys.color.line},
  progressBarDone:{backgroundColor:sys.color.green},
  review:{gap:layout.section},
  addName:{alignSelf:'flex-start'},
  // A part of the review: title and "Izmeni" on one line, the facts under it; the parts are parted by the gap between them, not by a line.
  group:{gap:sys.space.xs},
  groupHead:{flexDirection:'row',alignItems:'center',gap:sys.space.sm,minHeight:44},
  groupBody:{gap:sys.space.md},
  edit:{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'flex-end',paddingLeft:sys.space.md},
  editText:{color:sys.color.green},
  fact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:sys.space.sm},
  chip:{minHeight:36,maxWidth:'100%',justifyContent:'center',paddingHorizontal:sys.space.md,paddingVertical:sys.space.xs,borderRadius:sys.radius.pill,backgroundColor:sys.color.wash},
  chipText:{color:sys.color.ink,flexShrink:1},
  // The constant sentence of the review: a flat tint, ink words, the bell (owner 2026-10-07).
  noteBox:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  listEditor:{gap:sys.space.sm},
  reviewNotice:{padding:sys.space.base,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft,flexDirection:'row',alignItems:'flex-start',gap:sys.space.md,marginBottom:sys.space.sm},
  section:{gap:sys.space.base,paddingVertical:sys.space.base},
  scheduleGroup:{gap:sys.space.md},
  row:{gap:sys.space.xs,minWidth:0},
  notice:{padding:sys.space.base,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft},
  input:{...field},
  multiline:{minHeight:96,textAlignVertical:'top'},
  // A flat tint, not the orange budget (critique B19): the one orange on the review is not a switch row.
  activation:{flexDirection:'row',gap:sys.space.md,alignItems:'center'},
});
