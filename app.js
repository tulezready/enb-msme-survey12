// ENB Economic & MSME Survey — app.js
// All constants defined here; supabase client comes from index.html

const TABLE = "msme_surveys";

const STEP_TITLE = {A:"Location",B:"Employment & Education",C:"Business Background",D:"Business Dev. Assistance",E:"Economic Output",F:"Cash Crops",G:"Informal Business"};

const BUSINESS_ACTIVITY_CATEGORIES = [
  {key:"general",label:"General",items:["Trade store","Wholesale","Fast food outlet","Second hand clothing shop","Liquor / Bottle shop","Bakery","Service station","PMV/Transport/Taxi services","Pest Control","Professional services","Tailoring","Coffin Making","Mechanical Workshop","Contracting services","Communication Towers"]},
  {key:"dpi",label:"DPI",items:["Cocoa Buying / Cocoa dealer","Livestock / Poultry / Cattle","Fresh produce","Cocoa / coconut nursery"]},
  {key:"tourism",label:"Tourism",items:["Arts and craft","Guest house / hospitality","Restaurant","Tour operators","Tourism product owners","Sport tourism","Hiking","Bird watching","Homestay"]},
  {key:"nrmd",label:"NRMD",items:["Nursery","Sawmilling","Mini down streaming","Furniture","Logging"]},
  {key:"fisheries",label:"Fisheries",items:["Coastal fishing","Sea cucumber dealer","Inland fish farming"]},
];

const IPA_FORMS      = ["Company","Business Name","Business Group","Association","Co-operative","Other – specify"];
const LICENSE_TYPES  = ["Trading License","Liquor","Cocoa Dealers License","Frozen Goods License","Second hand License","Inflammable Liquids","Dangerous Goods License","Paddlers license","Others"];
const TRAIN_TYPES    = ["Start Your Business (SYB)","Improve Your Business (IYB)","Business Awareness","Financial Literacy Training","Others"];
const TRAIN_REQUIRED = ["SIYB","Bookkeeping","Cost/Pricing & Financial Planning","Cash flows/Budgeting","Financial Literacy Training"];
const ASSIST_TYPES   = ["General Business Advice","Bookkeeping & Business Records","Costing/Pricing & Financial Planning","Cash flows","IPA Registration/Statutory Returns","IRC Statutory Returns","Financial Statement","Business Plan/Loan Proposals"];
const CASH_CROP_BASE = ["Cocoa","Coconut","Balsa","Coffee","Vanilla"];

// ── State ──────────────────────────────────────────────────
let allSurveys = [];
let currentStepIndex = 0;
let activeSteps = ["A","B"];

function freshState(){
  return {
    id: null,
    businessStatus: null,
    ipaRegisteredValue: null,
    hasLoanValue: null,
    employedMembers: [],
    unemployedMembers: [],
    businessActivities: {selected:[], others:{}},
    ipaRegistrations: IPA_FORMS.map(f => ({form:f,date_reg:"",reg_no:"",expiry:""})),
    licenses: LICENSE_TYPES.map(t => ({type:t,ticked:false,receipt_no:"",expiry:""})),
    businessLoans: [],
    trainingsAttended: TRAIN_TYPES.map(t => ({type:t,attended:"",facilitator:""})),
    trainingsRequired: {selected:[]},
    assistanceRequired: {selected:[]},
    cashCrops: CASH_CROP_BASE.map(c => ({crop:c,blocks:"",trees:"",fixed:true})),
    informalBusinesses: [],
  };
}
let state = freshState();

// ── Helpers ────────────────────────────────────────────────
function esc(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(d){ if(!d) return '—'; try{return new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}catch{return d;} }
function fmtK(n){ if(n===null||n===undefined||n==='') return '—'; const x=Number(n); return isNaN(x)?'—':'K '+x.toLocaleString(undefined,{maximumFractionDigits:2}); }
let _toastTimer;
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>t.classList.remove('show'),2800); }

// ── Dynamic section renderers ──────────────────────────────
function withAllPanelsVisible(fn){
  const panels=[...document.querySelectorAll('.step-panel')];
  const prev=panels.map(p=>p.style.display);
  panels.forEach(p=>p.style.display='block');
  fn();
  panels.forEach((p,i)=>p.style.display=prev[i]);
}

function renderBusinessActivities(){
  const el=document.getElementById('businessActivities');
  el.innerHTML=BUSINESS_ACTIVITY_CATEGORIES.map(cat=>`
    <div class="category-block">
      <span class="cat-label">${esc(cat.label)}</span>
      <div class="check-grid">${cat.items.map(item=>`
        <label class="check-item${state.businessActivities.selected.includes(item)?' checked':''}">
          <input type="checkbox" data-activity="${esc(item)}" ${state.businessActivities.selected.includes(item)?'checked':''}/>${esc(item)}</label>`).join('')}
      </div>
      <input type="text" placeholder="Others — specify" data-activity-other="${cat.key}" value="${esc(state.businessActivities.others[cat.key]||'')}" style="margin-top:8px;"/>
    </div>`).join('');
  el.querySelectorAll('[data-activity]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const item=cb.dataset.activity, sel=state.businessActivities.selected, i=sel.indexOf(item);
      cb.checked&&i===-1?sel.push(item):!cb.checked&&i!==-1?sel.splice(i,1):null;
      cb.closest('.check-item').classList.toggle('checked',cb.checked);
    });
  });
  el.querySelectorAll('[data-activity-other]').forEach(inp=>{
    inp.addEventListener('input',()=>{state.businessActivities.others[inp.dataset.activityOther]=inp.value;});
  });
}

function renderFlatChecklist(containerId, items, selectedArr){
  const el=document.getElementById(containerId);
  el.innerHTML=`<div class="check-grid">${items.map(item=>`
    <label class="check-item${selectedArr.includes(item)?' checked':''}">
      <input type="checkbox" value="${esc(item)}" ${selectedArr.includes(item)?'checked':''}/>${esc(item)}</label>`).join('')}</div>`;
  el.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const i=selectedArr.indexOf(cb.value);
      cb.checked&&i===-1?selectedArr.push(cb.value):!cb.checked&&i!==-1?selectedArr.splice(i,1):null;
      cb.closest('.check-item').classList.toggle('checked',cb.checked);
    });
  });
}

function renderIpaTable(){
  document.querySelector('#tbl_ipa tbody').innerHTML=state.ipaRegistrations.map((r,i)=>`
    <tr data-idx="${i}"><td>${esc(r.form)}</td>
    <td><input type="date" data-key="date_reg" value="${esc(r.date_reg)}"/></td>
    <td><input type="text" data-key="reg_no" value="${esc(r.reg_no)}"/></td>
    <td><input type="date" data-key="expiry" value="${esc(r.expiry)}"/></td></tr>`).join('');
  bindFixed(document.querySelector('#tbl_ipa tbody'), state.ipaRegistrations);
}

function renderLicensesTable(){
  document.querySelector('#tbl_licenses tbody').innerHTML=state.licenses.map((r,i)=>`
    <tr data-idx="${i}"><td>${esc(r.type)}</td>
    <td style="text-align:center"><input type="checkbox" data-key="ticked" data-bool="1" ${r.ticked?'checked':''}></td>
    <td><input type="text" data-key="receipt_no" value="${esc(r.receipt_no)}"/></td>
    <td><input type="date" data-key="expiry" value="${esc(r.expiry)}"/></td></tr>`).join('');
  bindFixed(document.querySelector('#tbl_licenses tbody'), state.licenses);
}

function renderTrainingsTable(){
  document.querySelector('#tbl_trainings_attended tbody').innerHTML=state.trainingsAttended.map((r,i)=>`
    <tr data-idx="${i}"><td>${esc(r.type)}</td>
    <td><select data-key="attended"><option value="">—</option><option value="Y" ${r.attended==='Y'?'selected':''}>Yes</option><option value="N" ${r.attended==='N'?'selected':''}>No</option></select></td>
    <td><input type="text" data-key="facilitator" value="${esc(r.facilitator)}"/></td></tr>`).join('');
  bindFixed(document.querySelector('#tbl_trainings_attended tbody'), state.trainingsAttended);
}

function bindFixed(tbody, arr){
  tbody.querySelectorAll('[data-key]').forEach(inp=>{
    inp.addEventListener(inp.tagName==='SELECT'?'change':'input',()=>{
      const idx=+inp.closest('tr').dataset.idx;
      arr[idx][inp.dataset.key]=inp.dataset.bool?inp.checked:inp.value;
    });
  });
}

function renderAddable(tbodySel, arr, rowFn, rerender){
  document.querySelector(tbodySel+' tbody').innerHTML=arr.map((r,i)=>rowFn(r,i)).join('');
  document.querySelector(tbodySel+' tbody').querySelectorAll('[data-key]').forEach(inp=>{
    inp.addEventListener(inp.tagName==='SELECT'?'change':'input',()=>{
      arr[+inp.closest('tr').dataset.idx][inp.dataset.key]=inp.value;
    });
  });
  document.querySelector(tbodySel+' tbody').querySelectorAll('.rm-row').forEach(btn=>{
    btn.addEventListener('click',()=>{arr.splice(+btn.closest('tr').dataset.idx,1);rerender();});
  });
}

function renderEmployedTable(){
  renderAddable('#tbl_employed', state.employedMembers, (r,i)=>`
    <tr data-idx="${i}">
      <td><input type="text" data-key="name" value="${esc(r.name)}"/></td>
      <td><input type="text" data-key="qualification" value="${esc(r.qualification)}"/></td>
      <td><input type="text" data-key="institution" value="${esc(r.institution)}"/></td>
      <td><input type="text" data-key="year_graduated" value="${esc(r.year_graduated)}" style="min-width:55px"/></td>
      <td><input type="text" data-key="employer_location" value="${esc(r.employer_location)}"/></td>
      <td><input type="number" data-key="gross_monthly_pay" value="${esc(r.gross_monthly_pay)}" style="min-width:80px"/></td>
      <td><button type="button" class="rm-row">&times;</button></td></tr>`, renderEmployedTable);
}

function renderUnemployedTable(){
  renderAddable('#tbl_unemployed', state.unemployedMembers, (r,i)=>`
    <tr data-idx="${i}">
      <td><input type="text" data-key="name" value="${esc(r.name)}"/></td>
      <td><input type="text" data-key="qualification" value="${esc(r.qualification)}"/></td>
      <td><input type="text" data-key="institution" value="${esc(r.institution)}"/></td>
      <td><input type="text" data-key="year_graduated" value="${esc(r.year_graduated)}" style="min-width:55px"/></td>
      <td><input type="text" data-key="comments" value="${esc(r.comments)}"/></td>
      <td><button type="button" class="rm-row">&times;</button></td></tr>`, renderUnemployedTable);
}

function renderLoansTable(){
  renderAddable('#tbl_loans', state.businessLoans, (r,i)=>`
    <tr data-idx="${i}">
      <td><input type="text" data-key="bank" value="${esc(r.bank)}"/></td>
      <td><input type="number" data-key="amount" value="${esc(r.amount)}" style="min-width:80px"/></td>
      <td><input type="date" data-key="date" value="${esc(r.date)}"/></td>
      <td><select data-key="on_schedule"><option value="">—</option><option value="Y" ${r.on_schedule==='Y'?'selected':''}>Yes</option><option value="N" ${r.on_schedule==='N'?'selected':''}>No</option></select></td>
      <td><input type="text" data-key="comments" value="${esc(r.comments)}"/></td>
      <td><button type="button" class="rm-row">&times;</button></td></tr>`, renderLoansTable);
}

function renderCashCropsTable(){
  renderAddable('#tbl_cash_crops', state.cashCrops, (r,i)=>`
    <tr data-idx="${i}">
      <td>${r.fixed?esc(r.crop):`<input type="text" data-key="crop" value="${esc(r.crop)}" placeholder="Crop name"/>`}</td>
      <td><input type="number" data-key="blocks" value="${esc(r.blocks)}" style="min-width:70px"/></td>
      <td><input type="number" data-key="trees" value="${esc(r.trees)}" style="min-width:70px"/></td>
      <td>${r.fixed?'':'<button type="button" class="rm-row">&times;</button>'}</td></tr>`, renderCashCropsTable);
}

function renderInformalTable(){
  renderAddable('#tbl_informal', state.informalBusinesses, (r,i)=>`
    <tr data-idx="${i}">
      <td><input type="text" data-key="owner_name" value="${esc(r.owner_name)}"/></td>
      <td><input type="text" data-key="activity_type" value="${esc(r.activity_type)}"/></td>
      <td><input type="text" data-key="year_established" value="${esc(r.year_established)}" style="min-width:60px"/></td>
      <td><input type="number" data-key="monthly_turnover" value="${esc(r.monthly_turnover)}" style="min-width:80px"/></td>
      <td><button type="button" class="rm-row">&times;</button></td></tr>`, renderInformalTable);
}

function renderAllDynamic(){
  withAllPanelsVisible(()=>{
    renderBusinessActivities();
    renderFlatChecklist('trainingsRequired', TRAIN_REQUIRED, state.trainingsRequired.selected);
    renderFlatChecklist('assistanceRequired', ASSIST_TYPES, state.assistanceRequired.selected);
    renderIpaTable(); renderLicensesTable(); renderTrainingsTable();
    renderEmployedTable(); renderUnemployedTable();
    renderLoansTable(); renderCashCropsTable(); renderInformalTable();
  });
}

// ── Add row buttons ────────────────────────────────────────
const ADD_FACTORIES = {
  employedMembers:   ()=>({name:'',qualification:'',institution:'',year_graduated:'',employer_location:'',gross_monthly_pay:''}),
  unemployedMembers: ()=>({name:'',qualification:'',institution:'',year_graduated:'',comments:''}),
  businessLoans:     ()=>({bank:'',amount:'',date:'',on_schedule:'',comments:''}),
  cashCrops:         ()=>({crop:'',blocks:'',trees:'',fixed:false}),
  informalBusinesses:()=>({owner_name:'',activity_type:'',year_established:'',monthly_turnover:''}),
};
const ADD_RENDERS = {
  employedMembers:renderEmployedTable, unemployedMembers:renderUnemployedTable,
  businessLoans:renderLoansTable, cashCrops:renderCashCropsTable, informalBusinesses:renderInformalTable,
};
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-add]');
  if(!btn) return;
  const k=btn.dataset.add;
  state[k].push(ADD_FACTORIES[k]());
  ADD_RENDERS[k]();
});

// ── Radio pills ────────────────────────────────────────────
function wireRadioPills(containerId, onChange){
  document.getElementById(containerId).querySelectorAll('input[type=radio]').forEach(r=>{
    r.addEventListener('change',()=>{
      document.getElementById(containerId).querySelectorAll('.radio-pill').forEach(p=>p.classList.remove('checked'));
      r.closest('.radio-pill').classList.add('checked');
      onChange(r.value);
    });
  });
}
function setRadioPillValue(containerId, value){
  const el=document.getElementById(containerId);
  el.querySelectorAll('.radio-pill').forEach(p=>p.classList.remove('checked'));
  el.querySelectorAll('input[type=radio]').forEach(r=>r.checked=false);
  if(value===null||value===undefined) return;
  const r=el.querySelector(`input[value="${value}"]`);
  if(r){r.checked=true;r.closest('.radio-pill').classList.add('checked');}
}

// ── Conditional visibility ─────────────────────────────────
function computeActiveSteps(status){
  if(status==='formal')   return ['A','B','C','D','E','F','G'];
  if(status==='informal') return ['A','B','C','F','G'];
  if(status==='none')     return ['A','B','F','G'];
  return ['A','B'];
}
function applyBusinessStatus(status){
  state.businessStatus=status;
  document.getElementById('formalOnlyC').style.display=(status==='formal')?'':'none';
  document.getElementById('informalNoteC').style.display=(status==='informal')?'block':'none';
  activeSteps=computeActiveSteps(status);
  if(currentStepIndex>=activeSteps.length) currentStepIndex=activeSteps.length-1;
  renderStepper();
}
function applyLoanStatus(val){
  document.getElementById('loanYesBlock').style.display=(val==='true')?'':'none';
  document.getElementById('loanNoBlock').style.display=(val==='false')?'':'none';
}

// ── Stepper ────────────────────────────────────────────────
function renderStepper(){
  const el=document.getElementById('stepper');
  el.innerHTML=activeSteps.map((s,i)=>`
    <div class="step-pip ${i===currentStepIndex?'active':i<currentStepIndex?'done':''}" data-jump="${i}">
      <span class="letter">${s}</span>
      <span class="step-name">${STEP_TITLE[s].split(' ')[0]}</span>
    </div>`).join('');
  el.querySelectorAll('[data-jump]').forEach(pip=>{
    pip.addEventListener('click',()=>{currentStepIndex=+pip.dataset.jump;showStep(activeSteps[currentStepIndex]);});
  });
}
function showStep(letter){
  document.querySelectorAll('.step-panel').forEach(p=>p.classList.toggle('active',p.dataset.step===letter));
  const isLast=(currentStepIndex===activeSteps.length-1);
  document.getElementById('btnBack').style.display=currentStepIndex===0?'none':'';
  document.getElementById('btnNext').style.display=isLast?'none':'';
  document.getElementById('btnSubmit').style.display=isLast?'':'none';
  renderStepper();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('btnNext').addEventListener('click',()=>{
  if(currentStepIndex<activeSteps.length-1){currentStepIndex++;showStep(activeSteps[currentStepIndex]);}
});
document.getElementById('btnBack').addEventListener('click',()=>{
  if(currentStepIndex>0){currentStepIndex--;showStep(activeSteps[currentStepIndex]);}
});

// ── Collect form data ──────────────────────────────────────
function collectForm(){
  const payload={};
  document.querySelectorAll('[data-field]').forEach(inp=>{
    const k=inp.dataset.field;
    const v=inp.value;
    if(v===''){payload[k]=null;return;}
    payload[k]=inp.type==='number'?parseFloat(v):v;
  });
  payload.business_status=state.businessStatus||null;
  payload.employed_members=state.employedMembers.filter(r=>(r.name||'').trim());
  payload.unemployed_members=state.unemployedMembers.filter(r=>(r.name||'').trim());
  payload.business_activities=state.businessActivities;
  payload.ipa_registered=state.ipaRegisteredValue==='true'?true:state.ipaRegisteredValue==='false'?false:null;
  payload.ipa_registrations=state.ipaRegistrations.filter(r=>r.date_reg||r.reg_no||r.expiry);
  payload.licenses=state.licenses.filter(r=>r.ticked||r.receipt_no||r.expiry);
  payload.has_business_loan=state.hasLoanValue==='true'?true:state.hasLoanValue==='false'?false:null;
  payload.business_loans=state.businessLoans.filter(r=>(r.bank||'').trim());
  payload.trainings_attended=state.trainingsAttended.filter(r=>r.attended||r.facilitator);
  payload.trainings_required=state.trainingsRequired;
  payload.assistance_required=state.assistanceRequired;
  payload.cash_crops=state.cashCrops.filter(r=>r.blocks||r.trees);
  payload.informal_businesses=state.informalBusinesses.filter(r=>(r.owner_name||'').trim());
  return payload;
}

// ── Reset form ─────────────────────────────────────────────
function resetForm(){
  state=freshState();
  document.getElementById('surveyForm').reset();
  document.getElementById('surveyTitle').textContent='New Survey';
  document.querySelectorAll('.radio-pill.checked').forEach(p=>p.classList.remove('checked'));
  document.querySelectorAll('input[type=radio]').forEach(r=>r.checked=false);
  currentStepIndex=0;
  activeSteps=['A','B'];
  document.getElementById('formalOnlyC').style.display='';
  document.getElementById('informalNoteC').style.display='none';
  document.getElementById('loanYesBlock').style.display='none';
  document.getElementById('loanNoBlock').style.display='none';
  renderAllDynamic();
  renderStepper();
  showStep('A');
}

// ── Load record into form ──────────────────────────────────
function loadFormFromRecord(rec){
  resetForm();
  state.id=rec.id;
  document.getElementById('surveyTitle').textContent='Edit Survey';
  document.querySelectorAll('[data-field]').forEach(inp=>{
    const k=inp.dataset.field;
    if(rec[k]!==undefined&&rec[k]!==null) inp.value=rec[k];
  });
  state.employedMembers=rec.employed_members||[];
  state.unemployedMembers=rec.unemployed_members||[];
  state.businessActivities=rec.business_activities||{selected:[],others:{}};
  state.ipaRegistrations=IPA_FORMS.map(f=>{const fd=(rec.ipa_registrations||[]).find(r=>r.form===f);return fd||{form:f,date_reg:'',reg_no:'',expiry:''};});
  state.licenses=LICENSE_TYPES.map(t=>{const fd=(rec.licenses||[]).find(r=>r.type===t);return fd||{type:t,ticked:false,receipt_no:'',expiry:''};});
  state.businessLoans=rec.business_loans||[];
  state.trainingsAttended=TRAIN_TYPES.map(t=>{const fd=(rec.trainings_attended||[]).find(r=>r.type===t);return fd||{type:t,attended:'',facilitator:''};});
  state.trainingsRequired=rec.trainings_required||{selected:[]};
  state.assistanceRequired=rec.assistance_required||{selected:[]};
  state.cashCrops=[
    ...CASH_CROP_BASE.map(c=>{const fd=(rec.cash_crops||[]).find(r=>r.crop===c);return fd?{...fd,fixed:true}:{crop:c,blocks:'',trees:'',fixed:true};}),
    ...(rec.cash_crops||[]).filter(r=>!CASH_CROP_BASE.includes(r.crop)).map(r=>({...r,fixed:false})),
  ];
  state.informalBusinesses=rec.informal_businesses||[];
  state.ipaRegisteredValue=rec.ipa_registered===true?'true':rec.ipa_registered===false?'false':null;
  state.hasLoanValue=rec.has_business_loan===true?'true':rec.has_business_loan===false?'false':null;
  renderAllDynamic();
  setRadioPillValue('businessStatusPills', rec.business_status);
  setRadioPillValue('ipaRegisteredPills', state.ipaRegisteredValue);
  setRadioPillValue('hasLoanPills', state.hasLoanValue);
  applyBusinessStatus(rec.business_status);
  applyLoanStatus(state.hasLoanValue);
  showStep('A');
}

// ── Save ───────────────────────────────────────────────────
async function saveSurvey(){
  const btn=document.getElementById('btnSubmit');
  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> Saving…';
  try{
    const payload=collectForm();
    let res;
    if(state.id){
      res=await supabase.from(TABLE).update(payload).eq('id',state.id);
    } else {
      res=await supabase.from(TABLE).insert(payload);
    }
    if(res.error){
      alert('Save failed: '+res.error.message);
      return;
    }
    toast(state.id?'Survey updated.':'Survey saved.');
    resetForm();
    switchView('records');
    await refreshAllData();
  } catch(err){
    alert('Unexpected error: '+err.message);
  } finally {
    btn.disabled=false;
    btn.textContent='Save survey';
  }
}
document.getElementById('btnSubmit').addEventListener('click', saveSurvey);

// ── Delete ─────────────────────────────────────────────────
async function deleteSurvey(id){
  if(!confirm('Delete this survey? This cannot be undone.')) return;
  const {error}=await supabase.from(TABLE).delete().eq('id',id);
  if(error){toast('Delete failed: '+error.message);return;}
  toast('Survey deleted.');
  closeDetailModal();
  await refreshAllData();
}

// ── Fetch & refresh ────────────────────────────────────────
async function fetchAllSurveys(){
  const {data,error}=await supabase.from(TABLE).select('*').order('created_at',{ascending:false});
  if(error){console.error(error);toast('Could not load records.');return[];}
  return data||[];
}
async function refreshAllData(){
  allSurveys=await fetchAllSurveys();
  renderDashboard();
  renderRecords();
}

// ── Dashboard ──────────────────────────────────────────────
function statusBadge(s){
  if(s==='formal') return '<span class="badge formal">Formal</span>';
  if(s==='informal') return '<span class="badge informal">Informal</span>';
  if(s==='none') return '<span class="badge none">No business</span>';
  return '';
}
function emptyState(msg){return`<div class="empty-state">${esc(msg)}</div>`;}

function renderDashboard(){
  const total=allSurveys.length;
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statFormal').textContent=allSurveys.filter(s=>s.business_status==='formal').length;
  document.getElementById('statInformal').textContent=allSurveys.filter(s=>s.business_status==='informal').length;
  document.getElementById('statNone').textContent=allSurveys.filter(s=>s.business_status==='none').length;

  const byD={};
  allSurveys.forEach(s=>{const d=s.district||'Unspecified';byD[d]=(byD[d]||0)+1;});
  const dEntries=Object.entries(byD).sort((a,b)=>b[1]-a[1]);
  const maxD=Math.max(1,...Object.values(byD));
  document.getElementById('districtBars').innerHTML=dEntries.length
    ?dEntries.map(([d,c])=>`<div class="bar-row"><span class="bar-label">${esc(d)}</span><span class="bar-track"><span class="bar-fill" style="width:${(c/maxD*100).toFixed(0)}%"></span></span><span class="bar-num">${c}</span></div>`).join('')
    :emptyState('No surveys yet');

  const actC={};
  allSurveys.forEach(s=>(s.business_activities?.selected||[]).forEach(a=>{actC[a]=(actC[a]||0)+1;}));
  const topA=Object.entries(actC).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxA=Math.max(1,...topA.map(a=>a[1]));
  document.getElementById('activityBars').innerHTML=topA.length
    ?topA.map(([a,c])=>`<div class="bar-row"><span class="bar-label">${esc(a)}</span><span class="bar-track"><span class="bar-fill" style="width:${(c/maxA*100).toFixed(0)}%;background:var(--ochre)"></span></span><span class="bar-num">${c}</span></div>`).join('')
    :emptyState('No business activity data yet');

  document.getElementById('recentList').innerHTML=allSurveys.slice(0,5).length
    ?allSurveys.slice(0,5).map(r=>`
      <div class="recent-item" data-view-id="${r.id}">
        <div><div class="who">${esc(r.business_name||r.contact_person||'Household '+(r.household_no||''))}</div>
        <div class="where">${esc(r.village||'')}${r.village&&r.district?', ':''}${esc(r.district||'')}</div></div>
        ${statusBadge(r.business_status)}
      </div>`).join('')
    :emptyState('No entries yet');
  document.querySelectorAll('[data-view-id]').forEach(el=>el.addEventListener('click',()=>openDetailModal(el.dataset.viewId)));
}

// ── Records ────────────────────────────────────────────────
function getFiltered(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const d=document.getElementById('filterDistrict').value;
  const s=document.getElementById('filterStatus').value;
  return allSurveys.filter(r=>{
    if(d&&r.district!==d) return false;
    if(s&&r.business_status!==s) return false;
    if(q){
      const hay=[r.business_name,r.contact_person,r.household_no,r.village,r.business_owner].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderRecords(){
  const list=getFiltered();
  document.getElementById('recordsCount').textContent=allSurveys.length;
  document.getElementById('recordsList').innerHTML=list.length?list.map(r=>`
    <div class="record-card">
      <div class="top-row">
        <div>
          <div class="name">${esc(r.business_name||r.contact_person||'Household '+(r.household_no||'—'))}</div>
          <div class="meta">${esc(r.village||'—')}, ${esc(r.district||'—')} · HH ${esc(r.household_no||'—')} · ${fmtDate(r.date_collected||r.created_at)}</div>
        </div>${statusBadge(r.business_status)}
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-act="view" data-id="${r.id}">View</button>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${r.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-act="delete" data-id="${r.id}">Delete</button>
      </div>
    </div>`).join(''):`<div class="panel">${emptyState('No records match your search')}</div>`;
  document.querySelectorAll('[data-act="view"]').forEach(b=>b.addEventListener('click',()=>openDetailModal(b.dataset.id)));
  document.querySelectorAll('[data-act="edit"]').forEach(b=>b.addEventListener('click',()=>{
    const rec=allSurveys.find(s=>s.id===b.dataset.id);
    if(rec){loadFormFromRecord(rec);switchView('survey');}
  }));
  document.querySelectorAll('[data-act="delete"]').forEach(b=>b.addEventListener('click',()=>deleteSurvey(b.dataset.id)));
}
['searchInput','filterDistrict','filterStatus'].forEach(id=>{
  document.getElementById(id).addEventListener('input',renderRecords);
  document.getElementById(id).addEventListener('change',renderRecords);
});

// ── Detail modal ───────────────────────────────────────────
function openDetailModal(id){
  const r=allSurveys.find(s=>s.id===id); if(!r) return;
  document.getElementById('detailModalBody').innerHTML=`
    <h3>${esc(r.business_name||r.contact_person||'Household '+(r.household_no||''))}</h3>
    <p style="color:var(--ink-soft);font-size:13px;margin:4px 0 14px">${esc(r.village||'—')}, ${esc(r.district||'—')} ${statusBadge(r.business_status)}</p>
    <div class="detail-section-title">A · Location</div>
    <div class="detail-grid">
      <div><div class="dt-label">Household No.</div><div class="dt-val">${esc(r.household_no||'—')}</div></div>
      <div><div class="dt-label">Date collected</div><div class="dt-val">${fmtDate(r.date_collected)}</div></div>
      <div><div class="dt-label">Contact</div><div class="dt-val">${esc(r.contact_person||'—')}</div></div>
      <div><div class="dt-label">Mobile</div><div class="dt-val">${esc(r.mobile_number||'—')}</div></div>
      <div><div class="dt-label">Enumerator</div><div class="dt-val">${esc(r.enumerator_name||'—')}</div></div>
    </div>
    <div class="detail-section-title">B · Employment</div>
    <div class="detail-grid">
      <div><div class="dt-label">Employed members</div><div class="dt-val">${r.employed_count??'—'}</div></div>
      <div><div class="dt-label">Listed employed</div><div class="dt-val">${(r.employed_members||[]).length}</div></div>
      <div><div class="dt-label">Qualified unemployed</div><div class="dt-val">${(r.unemployed_members||[]).length}</div></div>
    </div>
    ${r.business_status!=='none'?`
    <div class="detail-section-title">C · Business</div>
    <div class="detail-grid">
      <div><div class="dt-label">Business name</div><div class="dt-val">${esc(r.business_name||'—')}</div></div>
      <div><div class="dt-label">Owner</div><div class="dt-val">${esc(r.business_owner||'—')}</div></div>
      <div><div class="dt-label">Commenced</div><div class="dt-val">${fmtDate(r.business_date_commenced)}</div></div>
      <div><div class="dt-label">IPA registered</div><div class="dt-val">${r.ipa_registered===true?'Yes':r.ipa_registered===false?'No':'—'}</div></div>
      <div><div class="dt-label">Loan access</div><div class="dt-val">${r.has_business_loan===true?'Yes':r.has_business_loan===false?'No':'—'}</div></div>
    </div>`:''}
    ${r.business_status==='formal'?`
    <div class="detail-section-title">E · Economic Output</div>
    <div class="detail-grid">
      <div><div class="dt-label">Casuals / Permanent</div><div class="dt-val">${r.emp_casuals_no??'—'} / ${r.emp_permanent_no??'—'}</div></div>
      <div><div class="dt-label">Monthly turnover</div><div class="dt-val">${fmtK(r.turnover_amount)}</div></div>
      <div><div class="dt-label">Monthly expenses</div><div class="dt-val">${fmtK(r.expenses_amount)}</div></div>
      <div><div class="dt-label">Initial capital</div><div class="dt-val">${fmtK(r.initial_capital)}</div></div>
    </div>`:''}
    <div class="detail-section-title">F · Cash Crops</div>
    <div class="detail-grid">${(r.cash_crops||[]).length?(r.cash_crops||[]).map(c=>`<div><div class="dt-label">${esc(c.crop)}</div><div class="dt-val">${esc(c.blocks||0)} blocks · ${esc(c.trees||0)} trees</div></div>`).join(''):'<div><div class="dt-val">None recorded</div></div>'}</div>
    <div class="detail-section-title">G · Informal Business</div>
    <div class="detail-grid">${(r.informal_businesses||[]).length?(r.informal_businesses||[]).map(b=>`<div><div class="dt-label">${esc(b.owner_name)}</div><div class="dt-val">${esc(b.activity_type||'—')}</div></div>`).join(''):'<div><div class="dt-val">None recorded</div></div>'}</div>
    <div style="display:flex;gap:8px;margin-top:18px;">
      <button class="btn btn-ghost btn-sm" id="modalEditBtn">Edit</button>
      <button class="btn btn-danger btn-sm" id="modalDeleteBtn">Delete</button>
    </div>`;
  document.getElementById('modalEditBtn').addEventListener('click',()=>{closeDetailModal();loadFormFromRecord(r);switchView('survey');});
  document.getElementById('modalDeleteBtn').addEventListener('click',()=>deleteSurvey(r.id));
  document.getElementById('detailModalBackdrop').classList.add('open');
}
function closeDetailModal(){document.getElementById('detailModalBackdrop').classList.remove('open');}
document.getElementById('closeDetailModal').addEventListener('click',closeDetailModal);
document.getElementById('detailModalBackdrop').addEventListener('click',e=>{if(e.target.id==='detailModalBackdrop')closeDetailModal();});

// ── CSV export ─────────────────────────────────────────────
document.getElementById('btnExportCsv').addEventListener('click',()=>{
  const rows=getFiltered(); if(!rows.length){toast('Nothing to export.');return;}
  const cols=Object.keys(rows[0]);
  const csv=[cols.join(','),...rows.map(r=>cols.map(c=>{let v=r[c]??'';if(typeof v==='object')v=JSON.stringify(v);return`"${String(v).replace(/"/g,'""')}"`}).join(','))].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`msme-survey-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

// ── Tab navigation ─────────────────────────────────────────
function switchView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='records') renderRecords();
  if(view==='dashboard') renderDashboard();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));

// ── Online banner ──────────────────────────────────────────
window.addEventListener('online', ()=>document.getElementById('syncBanner').classList.remove('show'));
window.addEventListener('offline',()=>document.getElementById('syncBanner').classList.add('show'));

// ── Init ───────────────────────────────────────────────────
async function init(){
  try {
    wireRadioPills('businessStatusPills', val=>{applyBusinessStatus(val);renderStepper();});
    wireRadioPills('ipaRegisteredPills',  val=>{state.ipaRegisteredValue=val;});
    wireRadioPills('hasLoanPills',        val=>{state.hasLoanValue=val;applyLoanStatus(val);});
    resetForm();
    if(!navigator.onLine) document.getElementById('syncBanner').classList.add('show');
    await refreshAllData();
    supabase.channel('msme-changes')
      .on('postgres_changes',{event:'*',schema:'public',table:TABLE},()=>refreshAllData())
      .subscribe();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  } catch(err) {
    alert('App init error: ' + err.message);
  }
}

init();
