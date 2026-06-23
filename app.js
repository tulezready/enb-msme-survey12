// ============================================================
// ENB Economic & MSME Survey — app logic
// ============================================================

const STEP_ORDER = ["A","B","C","D","E","F","G"];
const STEP_TITLE = {A:"Location", B:"Employment & Education", C:"Business Background", D:"Business Development Assistance", E:"Economic Output", F:"Cash Crops", G:"Informal Business Sector"};

const BUSINESS_ACTIVITY_CATEGORIES = [
  {key:"general", label:"General", items:["Trade store","Wholesale","Fast food outlet","Second hand clothing shop","Liquor / Bottle shop","Bakery","Service station","PMV/Transport/Taxi services","Pest Control","Professional services (accountancy/consultancy)","Tailoring","Coffin Making","Mechanical Workshop","Contracting services","Communication Towers (specify owner)"]},
  {key:"dpi", label:"DPI", items:["Cocoa Buying / Cocoa dealer","Livestock / Poultry / Cattle","Fresh produce","Cocoa / coconut nursery"]},
  {key:"tourism", label:"Tourism", items:["Arts and craft","Guest house / hospitality","Restaurant","Tour operators","Tourism product owners","Sport tourism","Hiking","Bird watching","Homestay"]},
  {key:"nrmd", label:"NRMD", items:["Nursery","Sawmilling","Mini down streaming e.g. eaglewood","Furniture e.g. log to desk, tables","Logging"]},
  {key:"fisheries", label:"Fisheries", items:["Coastal fishing","Sea cucumber dealer","Inland fish farming"]},
];

const IPA_BUSINESS_FORMS = ["Company","Business Name","Business Group","Association","Co-operative","Other – specify"];
const LICENSE_TYPES = ["Trading License","Liquor","Cocoa Dealers License","Frozen Goods License","Second hand License","Inflammable Liquids","Dangerous Goods License","Paddlers license","Others: Specify"];
const TRAININGS_ATTENDED_TYPES = ["Start Your Business (SYB)","Improve Your Business (IYB)","Business Awareness","Financial Literacy Training","Others — Specify"];
const TRAININGS_REQUIRED_LIST = ["SIYB","Bookkeeping","Cost/Pricing & Financial Planning","Cash flows/Budgeting","Financial Literacy Training"];
const ASSISTANCE_REQUIRED_LIST = ["General Business Advice","Bookkeeping & Business Records","Costing/Pricing & Financial Planning","Cash flows","IPA Registration/Statutory Returns","IRC Statutory Returns","Financial Statement","Business Plan/Loan Proposals"];
const CASH_CROP_BASE = ["Cocoa","Coconut","Balsa","Coffee","Vanilla"];
const DISTRICTS = ["Gazelle","Kokopo","Pomio","Rabaul"];

let allSurveys = [];
let currentStepIndex = 0;
let activeSteps = ["A","B"];
let pendingTradingLicenseFile = null;

function freshState(){
  return {
    id: null,
    employedMembers: [],
    unemployedMembers: [],
    businessActivities: {selected:[], others:{}},
    ipaRegistrations: IPA_BUSINESS_FORMS.map(f => ({form:f, date_reg:"", reg_no:"", expiry:""})),
    licenses: LICENSE_TYPES.map(t => ({type:t, ticked:false, receipt_no:"", expiry:""})),
    tradingLicenseUrl: null,
    businessLoans: [],
    trainingsAttended: TRAININGS_ATTENDED_TYPES.map(t => ({type:t, attended:"", facilitator:""})),
    trainingsRequired: {selected:[]},
    assistanceRequired: {selected:[], others:""},
    cashCrops: CASH_CROP_BASE.map(c => ({crop:c, blocks:"", trees:"", fixed:true})),
    informalBusinesses: [],
  };
}
let state = freshState();

function esc(v){
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fmtK(n){
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return "K " + num.toLocaleString(undefined, {maximumFractionDigits:2});
}
function fmtDate(d){
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"}); }
  catch(e){ return d; }
}
let toastTimer;
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ------------------------------------------------------------
// Checklists
// ------------------------------------------------------------
function renderBusinessActivities(){
  const el = document.getElementById("businessActivities");
  el.innerHTML = BUSINESS_ACTIVITY_CATEGORIES.map(cat => `
    <div class="category-block">
      <span class="cat-label">${esc(cat.label)}</span>
      <div class="check-grid">
        ${cat.items.map(item => `
          <label class="check-item ${state.businessActivities.selected.includes(item) ? "checked" : ""}">
            <input type="checkbox" data-activity="${esc(item)}" ${state.businessActivities.selected.includes(item) ? "checked" : ""} />
            ${esc(item)}
          </label>`).join("")}
      </div>
      <input type="text" placeholder="Others — specify (${esc(cat.label)})" style="margin-top:8px;"
        data-activity-other="${cat.key}" value="${esc(state.businessActivities.others[cat.key] || "")}" />
    </div>
  `).join("");

  el.querySelectorAll("[data-activity]").forEach(cb => {
    cb.addEventListener("change", () => {
      const item = cb.dataset.activity;
      const sel = state.businessActivities.selected;
      const i = sel.indexOf(item);
      if (cb.checked && i === -1) sel.push(item);
      if (!cb.checked && i !== -1) sel.splice(i, 1);
      cb.closest(".check-item").classList.toggle("checked", cb.checked);
    });
  });
  el.querySelectorAll("[data-activity-other]").forEach(inp => {
    inp.addEventListener("input", () => {
      state.businessActivities.others[inp.dataset.activityOther] = inp.value;
    });
  });
}

function renderFlatChecklist(containerId, items, selectedArr){
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="check-grid">${items.map(item => `
    <label class="check-item ${selectedArr.includes(item) ? "checked" : ""}">
      <input type="checkbox" value="${esc(item)}" ${selectedArr.includes(item) ? "checked" : ""} />
      ${esc(item)}
    </label>`).join("")}</div>`;
  el.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const i = selectedArr.indexOf(cb.value);
      if (cb.checked && i === -1) selectedArr.push(cb.value);
      if (!cb.checked && i !== -1) selectedArr.splice(i, 1);
      cb.closest(".check-item").classList.toggle("checked", cb.checked);
    });
  });
}

// ------------------------------------------------------------
// Fixed-row tables (IPA registrations, licenses, trainings attended)
// ------------------------------------------------------------
function renderIpaTable(){
  const tbody = document.querySelector("#tbl_ipa tbody");
  tbody.innerHTML = state.ipaRegistrations.map((row, i) => `
    <tr data-idx="${i}">
      <td>${esc(row.form)}</td>
      <td><input type="date" data-key="date_reg" value="${esc(row.date_reg)}" /></td>
      <td><input type="text" data-key="reg_no" value="${esc(row.reg_no)}" /></td>
      <td><input type="date" data-key="expiry" value="${esc(row.expiry)}" /></td>
    </tr>`).join("");
  bindFixedInputs(tbody, state.ipaRegistrations);
}

function renderLicensesTable(){
  const tbody = document.querySelector("#tbl_licenses tbody");
  tbody.innerHTML = state.licenses.map((row, i) => `
    <tr data-idx="${i}">
      <td>${esc(row.type)}</td>
      <td style="text-align:center;"><input type="checkbox" data-key="ticked" data-bool="1" ${row.ticked ? "checked" : ""} /></td>
      <td><input type="text" data-key="receipt_no" value="${esc(row.receipt_no)}" /></td>
      <td><input type="date" data-key="expiry" value="${esc(row.expiry)}" /></td>
    </tr>`).join("");
  bindFixedInputs(tbody, state.licenses);
}

function renderTrainingsAttendedTable(){
  const tbody = document.querySelector("#tbl_trainings_attended tbody");
  tbody.innerHTML = state.trainingsAttended.map((row, i) => `
    <tr data-idx="${i}">
      <td>${esc(row.type)}</td>
      <td>
        <select data-key="attended">
          <option value="">—</option>
          <option value="Y" ${row.attended === "Y" ? "selected" : ""}>Yes</option>
          <option value="N" ${row.attended === "N" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td><input type="text" data-key="facilitator" value="${esc(row.facilitator)}" /></td>
    </tr>`).join("");
  bindFixedInputs(tbody, state.trainingsAttended);
}

function bindFixedInputs(tbody, arr){
  tbody.querySelectorAll("[data-key]").forEach(inp => {
    const evt = (inp.tagName === "SELECT") ? "change" : "input";
    inp.addEventListener(evt, () => {
      const idx = +inp.closest("tr").dataset.idx;
      arr[idx][inp.dataset.key] = inp.dataset.bool ? inp.checked : inp.value;
    });
  });
}

// ------------------------------------------------------------
// Addable-row tables (employed/unemployed members, loans, cash crops, informal)
// ------------------------------------------------------------
function renderEmployedTable(){
  const tbody = document.querySelector("#tbl_employed tbody");
  tbody.innerHTML = state.employedMembers.map((row, i) => `
    <tr data-idx="${i}">
      <td><input type="text" data-key="name" value="${esc(row.name)}" /></td>
      <td><input type="text" data-key="qualification" value="${esc(row.qualification)}" /></td>
      <td><input type="text" data-key="institution" value="${esc(row.institution)}" /></td>
      <td><input type="text" data-key="year_graduated" value="${esc(row.year_graduated)}" style="min-width:60px;" /></td>
      <td><input type="text" data-key="employer_location" value="${esc(row.employer_location)}" /></td>
      <td><input type="number" data-key="gross_monthly_pay" value="${esc(row.gross_monthly_pay)}" style="min-width:80px;" /></td>
      <td><button type="button" class="rm-row">&times;</button></td>
    </tr>`).join("");
  bindAddableTable(tbody, state.employedMembers, renderEmployedTable);
}

function renderUnemployedTable(){
  const tbody = document.querySelector("#tbl_unemployed tbody");
  tbody.innerHTML = state.unemployedMembers.map((row, i) => `
    <tr data-idx="${i}">
      <td><input type="text" data-key="name" value="${esc(row.name)}" /></td>
      <td><input type="text" data-key="qualification" value="${esc(row.qualification)}" /></td>
      <td><input type="text" data-key="institution" value="${esc(row.institution)}" /></td>
      <td><input type="text" data-key="year_graduated" value="${esc(row.year_graduated)}" style="min-width:60px;" /></td>
      <td><input type="text" data-key="comments" value="${esc(row.comments)}" /></td>
      <td><button type="button" class="rm-row">&times;</button></td>
    </tr>`).join("");
  bindAddableTable(tbody, state.unemployedMembers, renderUnemployedTable);
}

function renderLoansTable(){
  const tbody = document.querySelector("#tbl_loans tbody");
  tbody.innerHTML = state.businessLoans.map((row, i) => `
    <tr data-idx="${i}">
      <td><input type="text" data-key="bank" value="${esc(row.bank)}" /></td>
      <td><input type="number" data-key="amount" value="${esc(row.amount)}" style="min-width:80px;" /></td>
      <td><input type="date" data-key="date" value="${esc(row.date)}" /></td>
      <td>
        <select data-key="on_schedule">
          <option value="">—</option>
          <option value="Y" ${row.on_schedule === "Y" ? "selected" : ""}>Yes</option>
          <option value="N" ${row.on_schedule === "N" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td><input type="text" data-key="comments" value="${esc(row.comments)}" /></td>
      <td><button type="button" class="rm-row">&times;</button></td>
    </tr>`).join("");
  bindAddableTable(tbody, state.businessLoans, renderLoansTable);
}

function renderCashCropsTable(){
  const tbody = document.querySelector("#tbl_cash_crops tbody");
  tbody.innerHTML = state.cashCrops.map((row, i) => `
    <tr data-idx="${i}">
      <td>${row.fixed ? esc(row.crop) : `<input type="text" data-key="crop" value="${esc(row.crop)}" placeholder="Crop name" />`}</td>
      <td><input type="number" data-key="blocks" value="${esc(row.blocks)}" style="min-width:70px;" /></td>
      <td><input type="number" data-key="trees" value="${esc(row.trees)}" style="min-width:70px;" /></td>
      <td>${row.fixed ? "" : `<button type="button" class="rm-row">&times;</button>`}</td>
    </tr>`).join("");
  bindAddableTable(tbody, state.cashCrops, renderCashCropsTable, true);
}

function renderInformalTable(){
  const tbody = document.querySelector("#tbl_informal tbody");
  tbody.innerHTML = state.informalBusinesses.map((row, i) => `
    <tr data-idx="${i}">
      <td><input type="text" data-key="owner_name" value="${esc(row.owner_name)}" /></td>
      <td><input type="text" data-key="activity_type" value="${esc(row.activity_type)}" /></td>
      <td><input type="text" data-key="year_established" value="${esc(row.year_established)}" style="min-width:70px;" /></td>
      <td><input type="number" data-key="monthly_turnover" value="${esc(row.monthly_turnover)}" style="min-width:80px;" /></td>
      <td><button type="button" class="rm-row">&times;</button></td>
    </tr>`).join("");
  bindAddableTable(tbody, state.informalBusinesses, renderInformalTable);
}

function bindAddableTable(tbody, arr, rerender, skipFixedRemove){
  tbody.querySelectorAll("[data-key]").forEach(inp => {
    const evt = (inp.tagName === "SELECT") ? "change" : "input";
    inp.addEventListener(evt, () => {
      const idx = +inp.closest("tr").dataset.idx;
      arr[idx][inp.dataset.key] = inp.value;
    });
  });
  tbody.querySelectorAll(".rm-row").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.closest("tr").dataset.idx;
      arr.splice(idx, 1);
      rerender();
    });
  });
}

const ADD_ROW_FACTORIES = {
  employedMembers: () => ({name:"", qualification:"", institution:"", year_graduated:"", employer_location:"", gross_monthly_pay:""}),
  unemployedMembers: () => ({name:"", qualification:"", institution:"", year_graduated:"", comments:""}),
  businessLoans: () => ({bank:"", amount:"", date:"", on_schedule:"", comments:""}),
  cashCrops: () => ({crop:"", blocks:"", trees:"", fixed:false}),
  informalBusinesses: () => ({owner_name:"", activity_type:"", year_established:"", monthly_turnover:""}),
};
const ADD_ROW_RENDERERS = {
  employedMembers: renderEmployedTable,
  unemployedMembers: renderUnemployedTable,
  businessLoans: renderLoansTable,
  cashCrops: renderCashCropsTable,
  informalBusinesses: renderInformalTable,
};

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const key = btn.dataset.add;
  state[key].push(ADD_ROW_FACTORIES[key]());
  ADD_ROW_RENDERERS[key]();
});

// ------------------------------------------------------------
// Radio pill groups
// ------------------------------------------------------------
function wireRadioPills(containerId, onChange){
  const el = document.getElementById(containerId);
  el.querySelectorAll('input[type=radio]').forEach(r => {
    r.addEventListener("change", () => {
      el.querySelectorAll(".radio-pill").forEach(p => p.classList.remove("checked"));
      r.closest(".radio-pill").classList.add("checked");
      onChange(r.value);
    });
  });
}
function setRadioPillValue(containerId, value){
  const el = document.getElementById(containerId);
  el.querySelectorAll(".radio-pill").forEach(p => p.classList.remove("checked"));
  const r = el.querySelector(`input[value="${value}"]`);
  if (r){ r.checked = true; r.closest(".radio-pill").classList.add("checked"); }
  else { el.querySelectorAll('input[type=radio]').forEach(x => x.checked = false); }
}

// ------------------------------------------------------------
// Conditional section logic
// ------------------------------------------------------------
function computeActiveSteps(status){
  if (status === "formal") return ["A","B","C","D","E","F","G"];
  if (status === "informal") return ["A","B","C","F","G"];
  if (status === "none") return ["A","B","F","G"];
  return ["A","B"];
}
function applyBusinessStatus(status){
  state.businessStatus = status;
  document.getElementById("formalOnlyC").style.display = (status === "formal") ? "" : "none";
  document.getElementById("informalNoteC").style.display = (status === "informal") ? "flex" : "none";
  activeSteps = computeActiveSteps(status);
  if (currentStepIndex >= activeSteps.length) currentStepIndex = activeSteps.length - 1;
  renderStepper();
  showStep(activeSteps[currentStepIndex]);
}
function applyLoanStatus(hasLoan){
  document.getElementById("loanYesBlock").style.display = (hasLoan === "true") ? "" : "none";
  document.getElementById("loanNoBlock").style.display = (hasLoan === "false") ? "" : "none";
}

// ------------------------------------------------------------
// Stepper
// ------------------------------------------------------------
function renderStepper(){
  const el = document.getElementById("stepper");
  el.innerHTML = activeSteps.map((s, i) => `
    <div class="step-pip ${i === currentStepIndex ? "active" : (i < currentStepIndex ? "done" : "")}" data-jump="${i}">
      <span class="letter">${s}</span>
      <span class="step-name">${STEP_TITLE[s].split(" ")[0]}</span>
    </div>`).join("");
  el.querySelectorAll("[data-jump]").forEach(pip => {
    pip.addEventListener("click", () => {
      currentStepIndex = +pip.dataset.jump;
      showStep(activeSteps[currentStepIndex]);
    });
  });
}
function showStep(stepLetter){
  document.querySelectorAll(".step-panel").forEach(p => p.classList.toggle("active", p.dataset.step === stepLetter));
  document.getElementById("btnBack").disabled = (currentStepIndex === 0);
  const isLast = (currentStepIndex === activeSteps.length - 1);
  document.getElementById("btnNext").style.display = isLast ? "none" : "";
  // Show Save on last step; also show a smaller Save on other steps so
  // enumerators don't have to reach the end to save partial data
  document.getElementById("btnSubmit").style.display = "";
  document.getElementById("btnSubmit").textContent = isLast ? "Save survey" : "Save progress";
  renderStepper();
  window.scrollTo({top:0, behavior:"smooth"});
}
document.getElementById("btnNext").addEventListener("click", () => {
  if (currentStepIndex < activeSteps.length - 1){
    currentStepIndex++;
    showStep(activeSteps[currentStepIndex]);
  }
});
document.getElementById("btnBack").addEventListener("click", () => {
  if (currentStepIndex > 0){
    currentStepIndex--;
    showStep(activeSteps[currentStepIndex]);
  }
});

// ------------------------------------------------------------
// Trading license upload
// ------------------------------------------------------------
document.getElementById("f_trading_license_file").addEventListener("change", (e) => {
  pendingTradingLicenseFile = e.target.files[0] || null;
  document.getElementById("tradingLicenseStatus").textContent = pendingTradingLicenseFile
    ? `Ready to upload: ${pendingTradingLicenseFile.name} (uploads when you save)`
    : "";
});

// ------------------------------------------------------------
// Collect / populate form
// ------------------------------------------------------------
function collectForm(){
  const payload = {};
  document.querySelectorAll("[data-field]").forEach(inp => {
    const key = inp.dataset.field;
    let val = inp.value;
    if (val === "") { payload[key] = null; return; }
    if (inp.type === "number") { payload[key] = parseFloat(val); return; }
    payload[key] = val;
  });

  payload.business_status = state.businessStatus || null;
  payload.employed_members = state.employedMembers.filter(r => (r.name || "").trim());
  payload.unemployed_members = state.unemployedMembers.filter(r => (r.name || "").trim());
  payload.business_activities = state.businessActivities;
  payload.ipa_registered = state.ipaRegisteredValue === "true" ? true : (state.ipaRegisteredValue === "false" ? false : null);
  payload.ipa_registrations = state.ipaRegistrations.filter(r => r.date_reg || r.reg_no || r.expiry);
  payload.licenses = state.licenses.filter(r => r.ticked || r.receipt_no || r.expiry);
  payload.trading_license_url = state.tradingLicenseUrl;
  payload.has_business_loan = state.hasLoanValue === "true" ? true : (state.hasLoanValue === "false" ? false : null);
  payload.business_loans = state.businessLoans.filter(r => (r.bank || "").trim());
  payload.trainings_attended = state.trainingsAttended.filter(r => r.attended || r.facilitator);
  payload.trainings_required = state.trainingsRequired;
  payload.assistance_required = state.assistanceRequired;
  payload.cash_crops = state.cashCrops.filter(r => r.blocks || r.trees);
  payload.informal_businesses = state.informalBusinesses.filter(r => (r.owner_name || "").trim());

  return payload;
}

function resetForm(){
  state = freshState();
  pendingTradingLicenseFile = null;
  document.getElementById("surveyForm").reset();
  document.querySelectorAll(".check-item.checked").forEach(c => c.classList.remove("checked"));
  document.querySelectorAll(".radio-pill.checked").forEach(c => c.classList.remove("checked"));
  document.getElementById("tradingLicenseStatus").textContent = "";
  document.getElementById("surveyTitle").textContent = "New Survey";
  currentStepIndex = 0;
  activeSteps = ["A","B"];
  applyBusinessStatus(null);
  applyLoanStatus(null);
  renderAllDynamicSections();
  showStep("A");
}

function renderAllDynamicSections(){
  // Temporarily show all panels so render functions can find their table elements
  const panels = document.querySelectorAll(".step-panel");
  const prevDisplay = [];
  panels.forEach((p, i) => { prevDisplay[i] = p.style.display; p.style.display = "block"; });

  renderBusinessActivities();
  renderFlatChecklist("trainingsRequired", TRAININGS_REQUIRED_LIST, state.trainingsRequired.selected);
  renderFlatChecklist("assistanceRequired", ASSISTANCE_REQUIRED_LIST, state.assistanceRequired.selected);
  renderIpaTable();
  renderLicensesTable();
  renderTrainingsAttendedTable();
  renderEmployedTable();
  renderUnemployedTable();
  renderLoansTable();
  renderCashCropsTable();
  renderInformalTable();

  // Restore display state
  panels.forEach((p, i) => { p.style.display = prevDisplay[i]; });
}

function loadFormFromRecord(rec){
  resetForm();
  state.id = rec.id;
  document.getElementById("surveyTitle").textContent = "Edit Survey";

  document.querySelectorAll("[data-field]").forEach(inp => {
    const key = inp.dataset.field;
    if (rec[key] !== undefined && rec[key] !== null) inp.value = rec[key];
  });

  state.employedMembers = rec.employed_members || [];
  state.unemployedMembers = rec.unemployed_members || [];
  state.businessActivities = rec.business_activities || {selected:[], others:{}};
  state.ipaRegistrations = IPA_BUSINESS_FORMS.map(f => {
    const found = (rec.ipa_registrations || []).find(r => r.form === f);
    return found || {form:f, date_reg:"", reg_no:"", expiry:""};
  });
  state.licenses = LICENSE_TYPES.map(t => {
    const found = (rec.licenses || []).find(r => r.type === t);
    return found || {type:t, ticked:false, receipt_no:"", expiry:""};
  });
  state.tradingLicenseUrl = rec.trading_license_url || null;
  document.getElementById("tradingLicenseStatus").textContent = state.tradingLicenseUrl ? "Trading license already on file." : "";
  state.businessLoans = rec.business_loans || [];
  state.trainingsAttended = TRAININGS_ATTENDED_TYPES.map(t => {
    const found = (rec.trainings_attended || []).find(r => r.type === t);
    return found || {type:t, attended:"", facilitator:""};
  });
  state.trainingsRequired = rec.trainings_required || {selected:[]};
  state.assistanceRequired = rec.assistance_required || {selected:[], others:""};
  state.cashCrops = CASH_CROP_BASE.map(c => {
    const found = (rec.cash_crops || []).find(r => r.crop === c);
    return found ? {...found, fixed:true} : {crop:c, blocks:"", trees:"", fixed:true};
  }).concat((rec.cash_crops || []).filter(r => !CASH_CROP_BASE.includes(r.crop)).map(r => ({...r, fixed:false})));
  state.informalBusinesses = rec.informal_businesses || [];

  state.ipaRegisteredValue = rec.ipa_registered === true ? "true" : (rec.ipa_registered === false ? "false" : null);
  state.hasLoanValue = rec.has_business_loan === true ? "true" : (rec.has_business_loan === false ? "false" : null);

  renderAllDynamicSections();
  setRadioPillValue("businessStatusPills", rec.business_status);
  setRadioPillValue("ipaRegisteredPills", state.ipaRegisteredValue);
  setRadioPillValue("hasLoanPills", state.hasLoanValue);
  applyBusinessStatus(rec.business_status);
  applyLoanStatus(state.hasLoanValue);
  showStep("A");
}

// ------------------------------------------------------------
// Supabase data layer
// ------------------------------------------------------------
async function fetchAllSurveys(){
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", {ascending:false});
  if (error){ console.error(error); toast("Couldn't load records — check Supabase config."); return []; }
  return data || [];
}

async function uploadTradingLicenseIfNeeded(){
  if (!pendingTradingLicenseFile) return state.tradingLicenseUrl;
  const path = `${Date.now()}_${pendingTradingLicenseFile.name}`.replace(/\s+/g, "_");
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pendingTradingLicenseFile, {upsert:true});
  if (upErr){ console.error(upErr); toast("License upload failed — saving survey without it."); return state.tradingLicenseUrl; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function saveSurvey(){
  const btn = document.getElementById("btnSubmit");
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Saving…`;

  try {
    const payload = collectForm();

    let error;
    if (state.id){
      ({ error } = await supabase.from(TABLE).update(payload).eq("id", state.id));
    } else {
      ({ error } = await supabase.from(TABLE).insert(payload));
    }

    if (error){
      console.error(error);
      alert("Save failed: " + error.message);
      return;
    }

    toast(state.id ? "Survey updated." : "Survey saved.");
    resetForm();
    switchView("records");
    await refreshAllData();
  } catch(err){
    console.error(err);
    alert("Unexpected error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}
document.getElementById("btnSubmit").addEventListener("click", saveSurvey);

async function deleteSurvey(id){
  if (!confirm("Delete this survey? This can't be undone.")) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error){ toast("Delete failed: " + error.message); return; }
  toast("Survey deleted.");
  await refreshAllData();
  closeDetailModal();
}

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------
function renderDashboard(){
  const total = allSurveys.length;
  const formal = allSurveys.filter(s => s.business_status === "formal").length;
  const informal = allSurveys.filter(s => s.business_status === "informal").length;
  const none = allSurveys.filter(s => s.business_status === "none").length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statFormal").textContent = formal;
  document.getElementById("statInformal").textContent = informal;
  document.getElementById("statNone").textContent = none;

  const byDistrict = {};
  allSurveys.forEach(s => { const d = s.district || "Unspecified"; byDistrict[d] = (byDistrict[d] || 0) + 1; });
  const maxD = Math.max(1, ...Object.values(byDistrict));
  const districtEntries = Object.entries(byDistrict).sort((a,b) => b[1]-a[1]);
  document.getElementById("districtBars").innerHTML = districtEntries.length ? districtEntries.map(([d,c]) => `
    <div class="bar-row">
      <span class="bar-label">${esc(d)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(c/maxD*100).toFixed(0)}%"></span></span>
      <span class="bar-num">${c}</span>
    </div>`).join("") : emptyRow("No surveys yet");

  const actCounts = {};
  allSurveys.forEach(s => {
    const sel = s.business_activities?.selected || [];
    sel.forEach(a => { actCounts[a] = (actCounts[a] || 0) + 1; });
  });
  const topActs = Object.entries(actCounts).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxA = Math.max(1, ...topActs.map(a => a[1]));
  document.getElementById("activityBars").innerHTML = topActs.length ? topActs.map(([a,c]) => `
    <div class="bar-row">
      <span class="bar-label" style="width:160px;">${esc(a)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(c/maxA*100).toFixed(0)}%; background:var(--ochre);"></span></span>
      <span class="bar-num">${c}</span>
    </div>`).join("") : emptyRow("No business activity data yet");

  const recent = allSurveys.slice(0,5);
  document.getElementById("recentList").innerHTML = recent.length ? recent.map(r => `
    <div class="recent-item" data-view-id="${r.id}">
      <div>
        <div class="who">${esc(r.business_name || r.contact_person || "Household " + (r.household_no || ""))}</div>
        <div class="where">${esc(r.village || "")}${r.village && r.district ? ", " : ""}${esc(r.district || "")}</div>
      </div>
      ${statusBadge(r.business_status)}
    </div>`).join("") : emptyRow("Submit your first survey to see it here");

  document.querySelectorAll("[data-view-id]").forEach(el => {
    el.addEventListener("click", () => openDetailModal(el.dataset.viewId));
  });
}
function emptyRow(msg){ return `<div class="empty-state"><div class="glyph">—</div>${esc(msg)}</div>`; }
function statusBadge(status){
  if (status === "formal") return `<span class="badge formal">Formal</span>`;
  if (status === "informal") return `<span class="badge informal">Informal</span>`;
  if (status === "none") return `<span class="badge none">No business</span>`;
  return "";
}

// ------------------------------------------------------------
// Records
// ------------------------------------------------------------
function getFilteredSurveys(){
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const d = document.getElementById("filterDistrict").value;
  const s = document.getElementById("filterStatus").value;
  return allSurveys.filter(r => {
    if (d && r.district !== d) return false;
    if (s && r.business_status !== s) return false;
    if (q){
      const hay = [r.business_name, r.contact_person, r.household_no, r.village, r.business_owner].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderRecords(){
  document.getElementById("recordsCount").textContent = allSurveys.length;
  const list = getFilteredSurveys();
  document.getElementById("recordsList").innerHTML = list.length ? list.map(r => `
    <div class="record-card">
      <div class="top-row">
        <div>
          <div class="name">${esc(r.business_name || r.contact_person || "Household " + (r.household_no || "—"))}</div>
          <div class="meta">${esc(r.village || "—")}, ${esc(r.district || "—")} · HH ${esc(r.household_no || "—")} · ${fmtDate(r.date_collected || r.created_at)}</div>
        </div>
        ${statusBadge(r.business_status)}
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-act="view" data-id="${r.id}">View</button>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${r.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-act="delete" data-id="${r.id}">Delete</button>
      </div>
    </div>`).join("") : `<div class="panel">${emptyRow("No records match your filters")}</div>`;

  document.querySelectorAll('[data-act="view"]').forEach(b => b.addEventListener("click", () => openDetailModal(b.dataset.id)));
  document.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener("click", () => {
    const rec = allSurveys.find(s => s.id === b.dataset.id);
    if (rec){ loadFormFromRecord(rec); switchView("survey"); }
  }));
  document.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener("click", () => deleteSurvey(b.dataset.id)));
}
["searchInput","filterDistrict","filterStatus"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderRecords);
  document.getElementById(id).addEventListener("change", renderRecords);
});

// ------------------------------------------------------------
// Detail modal
// ------------------------------------------------------------
function openDetailModal(id){
  const r = allSurveys.find(s => s.id === id);
  if (!r) return;
  const body = document.getElementById("detailModalBody");
  body.innerHTML = `
    <h3>${esc(r.business_name || r.contact_person || "Household " + (r.household_no || ""))}</h3>
    <p class="hint">${esc(r.village || "—")}, ${esc(r.llg || "—")} LLG, ${esc(r.district || "—")} District ${statusBadge(r.business_status)}</p>

    <div class="detail-section-title">A · Location</div>
    <div class="detail-grid">
      <div><div class="dt-label">Household No.</div><div class="dt-val">${esc(r.household_no || "—")}</div></div>
      <div><div class="dt-label">Date collected</div><div class="dt-val">${fmtDate(r.date_collected)}</div></div>
      <div><div class="dt-label">Contact</div><div class="dt-val">${esc(r.contact_person || "—")}</div></div>
      <div><div class="dt-label">Mobile</div><div class="dt-val">${esc(r.mobile_number || "—")}</div></div>
      <div><div class="dt-label">Enumerator</div><div class="dt-val">${esc(r.enumerator_name || "—")}</div></div>
    </div>

    <div class="detail-section-title">B · Employment &amp; Education</div>
    <div class="detail-grid">
      <div><div class="dt-label">Employed (currently)</div><div class="dt-val">${esc(r.employed_count ?? "—")}</div></div>
      <div><div class="dt-label">Listed employed members</div><div class="dt-val">${(r.employed_members||[]).length}</div></div>
      <div><div class="dt-label">Qualified &amp; unemployed</div><div class="dt-val">${(r.unemployed_members||[]).length}</div></div>
    </div>

    ${r.business_status !== "none" ? `
    <div class="detail-section-title">C · Business</div>
    <div class="detail-grid">
      <div><div class="dt-label">Name</div><div class="dt-val">${esc(r.business_name || "—")}</div></div>
      <div><div class="dt-label">Owner</div><div class="dt-val">${esc(r.business_owner || "—")}</div></div>
      <div><div class="dt-label">Commenced</div><div class="dt-val">${fmtDate(r.business_date_commenced)}</div></div>
      <div><div class="dt-label">IPA registered</div><div class="dt-val">${r.ipa_registered === true ? "Yes" : r.ipa_registered === false ? "No" : "—"}</div></div>
      <div><div class="dt-label">Activities</div><div class="dt-val">${esc((r.business_activities?.selected||[]).join(", ") || "—")}</div></div>
      <div><div class="dt-label">Loan access</div><div class="dt-val">${r.has_business_loan === true ? "Yes" : r.has_business_loan === false ? "No" : "—"}</div></div>
      ${r.trading_license_url ? `<div><div class="dt-label">Trading license</div><div class="dt-val"><a href="${esc(r.trading_license_url)}" target="_blank" rel="noopener">View file</a></div></div>` : ""}
    </div>` : ""}

    ${r.business_status === "formal" ? `
    <div class="detail-section-title">E · Economic Output</div>
    <div class="detail-grid">
      <div><div class="dt-label">Casual / Permanent staff</div><div class="dt-val">${esc(r.emp_casuals_no ?? "—")} / ${esc(r.emp_permanent_no ?? "—")}</div></div>
      <div><div class="dt-label">Monthly turnover</div><div class="dt-val">${fmtK(r.turnover_amount)}</div></div>
      <div><div class="dt-label">Monthly expenses</div><div class="dt-val">${fmtK(r.expenses_amount)}</div></div>
      <div><div class="dt-label">Initial capital</div><div class="dt-val">${fmtK(r.initial_capital)}</div></div>
      <div><div class="dt-label">Asset value</div><div class="dt-val">${fmtK(r.asset_value)}</div></div>
    </div>` : ""}

    <div class="detail-section-title">F · Cash Crops</div>
    <div class="detail-grid">
      ${(r.cash_crops||[]).length ? (r.cash_crops||[]).map(c => `<div><div class="dt-label">${esc(c.crop)}</div><div class="dt-val">${esc(c.blocks||0)} blocks · ${esc(c.trees||0)} trees</div></div>`).join("") : `<div><div class="dt-val">None recorded</div></div>`}
    </div>

    <div class="detail-section-title">G · Informal Business Sector</div>
    <div class="detail-grid">
      ${(r.informal_businesses||[]).length ? (r.informal_businesses||[]).map(b => `<div><div class="dt-label">${esc(b.owner_name)}</div><div class="dt-val">${esc(b.activity_type||"—")}, K${esc(b.monthly_turnover||0)}/mo</div></div>`).join("") : `<div><div class="dt-val">None recorded</div></div>`}
    </div>

    <div class="step-nav" style="border-top:none; padding-top:0;">
      <button class="btn btn-ghost btn-sm" id="modalEditBtn">Edit</button>
      <button class="btn btn-danger btn-sm" id="modalDeleteBtn">Delete</button>
    </div>
  `;
  document.getElementById("modalEditBtn").addEventListener("click", () => { closeDetailModal(); loadFormFromRecord(r); switchView("survey"); });
  document.getElementById("modalDeleteBtn").addEventListener("click", () => deleteSurvey(r.id));
  document.getElementById("detailModalBackdrop").classList.add("open");
}
function closeDetailModal(){ document.getElementById("detailModalBackdrop").classList.remove("open"); }
document.getElementById("closeDetailModal").addEventListener("click", closeDetailModal);
document.getElementById("detailModalBackdrop").addEventListener("click", (e) => { if (e.target.id === "detailModalBackdrop") closeDetailModal(); });

// ------------------------------------------------------------
// CSV export
// ------------------------------------------------------------
function exportCsv(){
  const rows = getFilteredSurveys();
  if (!rows.length){ toast("Nothing to export."); return; }
  const cols = Object.keys(rows[0]);
  const csvRows = [cols.join(",")];
  rows.forEach(r => {
    csvRows.push(cols.map(c => {
      let v = r[c];
      if (v === null || v === undefined) v = "";
      if (typeof v === "object") v = JSON.stringify(v);
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    }).join(","));
  });
  const blob = new Blob([csvRows.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `msme-survey-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

// ------------------------------------------------------------
// Tab navigation
// ------------------------------------------------------------
function switchView(view){
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "records") renderRecords();
  if (view === "dashboard") renderDashboard();
  window.scrollTo({top:0, behavior:"smooth"});
}
document.querySelectorAll(".tab-btn").forEach(b => {
  b.addEventListener("click", () => switchView(b.dataset.view));
});

// ------------------------------------------------------------
// Online/offline banner
// ------------------------------------------------------------
function updateSyncBanner(){
  document.getElementById("syncBanner").classList.toggle("show", !navigator.onLine);
}
window.addEventListener("online", updateSyncBanner);
window.addEventListener("offline", updateSyncBanner);

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
async function refreshAllData(){
  allSurveys = await fetchAllSurveys();
  renderDashboard();
  renderRecords();
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
async function init(){
  wireRadioPills("businessStatusPills", (val) => applyBusinessStatus(val));
  wireRadioPills("ipaRegisteredPills", (val) => { state.ipaRegisteredValue = val; });
  wireRadioPills("hasLoanPills", (val) => { state.hasLoanValue = val; applyLoanStatus(val); });

  resetForm();
  updateSyncBanner();

  await refreshAllData();

  supabase
    .channel("msme-surveys-changes")
    .on("postgres_changes", {event:"*", schema:"public", table:TABLE}, () => { refreshAllData(); })
    .subscribe();

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW registration failed:", err));
  }
}

init();

