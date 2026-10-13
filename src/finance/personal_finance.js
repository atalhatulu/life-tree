import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {economy} from '../world/world_state.js';
import {annualYearStatus} from '../core/annual_clock.js';

const STARTING_CASH_BY_CLASS={düşük:2500,orta:7500,'üst-orta':18000,yüksek:50000};
const STUDENT_SUPPORT_BY_CLASS={düşük:3500,orta:7500,'üst-orta':11000,yüksek:17000};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const DEBT_RATES={consumer:.085,medical:.03,housing:.035,car:.06,emergency:.055};

// Validate monetary inputs before any legacy-save reconciliation or ledger writes.
// Silently accepting NaN/Infinity can permanently corrupt typed debt balances.
function validatedMoney(amount,label){
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(Math.round(amount)))
  throw new RangeError(label+' must be a finite, nonnegative safe monetary amount');
 return Math.round(amount);
}

// Repair legacy save records before comparing aggregate and typed balances.
// Unknown categories and non-finite amounts must never poison the ledger.
function legacyDebtAmount(value){
 const numeric=typeof value==='string'&&value.trim()!==''?Number(value):value;
 return typeof numeric==='number'&&Number.isFinite(numeric)&&numeric>=0&&Number.isSafeInteger(Math.round(numeric))
  ?Math.round(numeric):0;
}

function ensureDebtBuckets(finance,assets){
 if(!finance.debts||typeof finance.debts!=='object'||Array.isArray(finance.debts))finance.debts={};
 for(const key of Object.keys(finance.debts)){
  if(!Object.hasOwn(DEBT_RATES,key))delete finance.debts[key];
 }
 for(const key of Object.keys(DEBT_RATES))finance.debts[key]=legacyDebtAmount(finance.debts[key]);
 // A corrupted save can contain individually safe values whose sum is unsafe.
 // Trim the unsecured categories first, retaining collateral wherever possible.
 const maximum=BigInt(Number.MAX_SAFE_INTEGER);
 let total=Object.values(finance.debts).reduce((sum,value)=>sum+BigInt(value),0n);
 if(total>maximum){
  let excess=total-maximum;
  for(const key of ['consumer','emergency','medical','car','housing']){
   if(excess===0n)break;
   const removed=excess>BigInt(finance.debts[key])?finance.debts[key]:Number(excess);
   finance.debts[key]-=removed;
   excess-=BigInt(removed);
  }
  total=maximum;
 }
 let bucketTotal=Number(total);
 // A missing or corrupt aggregate cannot erase otherwise valid typed balances.
 const rawTotal=typeof finance.debt==='string'&&finance.debt.trim()!==''?Number(finance.debt):finance.debt;
 const validTotal=typeof rawTotal==='number'&&Number.isFinite(rawTotal)&&rawTotal>=0&&Number.isSafeInteger(Math.round(rawTotal));
 const target=validTotal?Math.round(rawTotal):bucketTotal;
 if(bucketTotal===0&&target>0){
  // Old saves may contain only aggregate debt and asset loan balances.
  // Recover secured portions before assigning the unsecured remainder.
  const housing=Math.min(target,legacyDebtAmount(assets?.home?.remainingDebt));
  const car=Math.min(target-housing,legacyDebtAmount(assets?.car?.remainingDebt));
  finance.debts.housing=housing;
  finance.debts.car=car;
  finance.debts.consumer=target-housing-car;
  bucketTotal=target;
 }else if(target>bucketTotal){
  // Partially typed legacy saves may have a secured loan omitted from
  // buckets. Recover the known lien before treating the gap as emergency debt.
  let untyped=target-bucketTotal;
  for(const [key,asset] of [['housing',assets?.home],['car',assets?.car]]){
   const missing=Math.max(0,legacyDebtAmount(asset?.remainingDebt)-finance.debts[key]);
   const assigned=Math.min(missing,untyped);
   finance.debts[key]+=assigned;
   untyped-=assigned;
  }
  finance.debts.emergency+=untyped;
  bucketTotal=target;
 }else if(target<bucketTotal){
  let reduction=bucketTotal-target;
  for(const key of ['consumer','emergency','medical','car','housing']){
   if(reduction<=0)break;
   const take=Math.min(finance.debts[key],reduction);
   finance.debts[key]-=take;
   reduction-=take;
  }
 }
 if(assets){
  // A loan cannot remain secured by an asset that no longer exists. Preserve
  // the liability as consumer debt rather than losing it or attaching it to a
  // replacement vehicle/home. Only reconcile when the asset record is known.
  for(const [key,asset] of [['housing',assets.home],['car',assets.car]]){
   if(!asset&&finance.debts[key]>0){
    finance.debts.consumer+=finance.debts[key];
    finance.debts[key]=0;
   }
   // The aggregate debt is authoritative in contradictory legacy records.
   // Keep the asset lien equal to the reconciled secured ledger immediately,
   // not just after the next annual finance cycle.
   if(asset)asset.remainingDebt=finance.debts[key];
  }
 }
 finance.debt=Math.round(Object.values(finance.debts).reduce((s,v)=>s+v,0));
 return finance.debts;
}

// Validate against a reconciled *copy* first: an overflow must not leave even
// the legacy save reconciliation as a partial mutation on the original state.
function previewPersonalFinance(state){
 return ensurePersonalFinance({
  ...state,
  finance:state.finance?structuredClone(state.finance):undefined,
  assets:state.assets?structuredClone(state.assets):undefined
 });
}

export function addDebt(state,type,amount){
 if(!Object.hasOwn(DEBT_RATES,type))throw new RangeError('Unsupported debt type');
 const value=validatedMoney(amount,'Debt amount');
 const preview=previewPersonalFinance(state);
 if(value>Number.MAX_SAFE_INTEGER-preview.debt)
  throw new RangeError('Debt aggregate exceeds safe monetary limit');
 const f=ensurePersonalFinance(state);
 const debts=ensureDebtBuckets(f);
 const key=type;
 debts[key]+=value;
 f.debt=Math.round(Object.values(debts).reduce((s,v)=>s+v,0));
 return f.debt;
}

// Keep interactive transfers independent of legacy debt reconciliation: a
// rejected saving decision must not rewrite unrelated account records.
function validBalance(value,label,{allowNegative=false}={}){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||(!allowNegative&&value<0))
  throw new RangeError(label+' must be a valid safe account balance');
 return value;
}

export function transferToSavings(state,amount){
 const moved=validatedMoney(amount,'Savings transfer amount');
 const f=state.finance;
 if(!f)throw new RangeError('Savings transfer requires a finance account');
 const cash=validBalance(f.cash,'Cash',{allowNegative:true});
 const savings=validBalance(f.savings??0,'Savings');
 if(moved>cash)throw new RangeError('Insufficient cash for savings transfer');
 if(moved>Number.MAX_SAFE_INTEGER-savings)
  throw new RangeError('Savings balance exceeds safe monetary limit');
 f.cash=cash-moved;
 f.savings=savings+moved;
 return moved;
}

// Shared rule for browser and terminal yearly moments. A full savings account
// can receive zero without losing any cash or overflowing its balance.
export function saveMonthlySurplus(state){
 const f=state.finance;
 if(!f)return 0;
 const income=f.monthlyIncome??0;
 if(typeof income!=='number'||!Number.isFinite(income)||income<0||
    !Number.isSafeInteger(Math.round(income)))
  throw new RangeError('Invalid monthly income for savings');
 const cash=validBalance(f.cash,'Cash',{allowNegative:true});
 const savings=validBalance(f.savings??0,'Savings');
 const target=Math.max(500,Math.round(income*.08));
 const amount=Math.min(Math.max(0,cash),Number.MAX_SAFE_INTEGER-savings,target);
 return transferToSavings(state,amount);
}

// Browser and terminal leisure/person actions must share one atomic debit.
// A corrupt annual spending ledger must never be repaired by silently adding
// to it or charging cash without recording the cost.
export function spendActivityCash(state,amount){
 const cost=validatedMoney(amount,'Activity spending amount');
 const f=state.finance;
 if(!f)throw new RangeError('Activity spending requires a finance account');
 const cash=validBalance(f.cash,'Cash');
 const spent=validBalance(f.activitySpendingAnnual??0,'Annual activity spending');
 if(cost>cash)throw new RangeError('Insufficient cash for activity');
 if(cost>Number.MAX_SAFE_INTEGER-spent)
  throw new RangeError('Annual activity spending exceeds safe monetary limit');
 f.cash=cash-cost;
 f.activitySpendingAnnual=spent+cost;
 return cost;
}

// Repay the newest household emergency shock first within the emergency
// debt bucket. Corrupt provenance must not be silently converted into NaN or
// allow the same bill to be paid twice from an unrelated emergency loan.
function settleRecentShockDebt(state,amount){
 const shock=state.householdDynamics?.recentShock;
 if(shock?.remainingDebt==null||amount<=0)return;
 const remaining=shock.remainingDebt;
 // A repaired legacy debt ledger may have a smaller emergency bucket than
 // its older shock record. Keep that legacy repayment behavior, but never
 // accept nonnumeric principal or a balance above the original bill.
 if(!Number.isSafeInteger(remaining)||remaining<0||
    (Number.isSafeInteger(shock.cost)&&shock.cost>=0&&remaining>shock.cost))
  throw new RangeError('Invalid recent shock debt provenance');
 shock.remainingDebt=Math.max(0,remaining-amount);
}

function syncDebt(f){
 f.debts??={consumer:0,medical:0,housing:0,car:0,emergency:0};
 f.debt=Math.max(0,Math.round(Object.values(f.debts).reduce((s,v)=>s+(Number(v)||0),0)));
 return f.debt;
}

// Only finance, collateral, and shock provenance are modified by debt service.
// Work on a draft and commit all three roots together after successful checks.
// Preserve existing root object identities for callers holding references.
function financeDraft(state){
 return {...state,
  finance:state.finance?structuredClone(state.finance):undefined,
  assets:state.assets?structuredClone(state.assets):state.assets,
  householdDynamics:state.householdDynamics?structuredClone(state.householdDynamics):state.householdDynamics};
}
// Keep live references to existing account subrecords as well as the roots.
// UI and event consumers can retain finance.debts, finance.lifestyle, an
// existing asset or recentShock between turns; replacing those objects on a
// successful draft commit would leave the consumer reading stale balances.
function mergeFinanceRecord(target,source){
 for(const key of Object.keys(target)){
  if(!Object.hasOwn(source,key))delete target[key];
 }
 for(const [key,value] of Object.entries(source)){
  // Only reuse owned records: inherited __proto__ must never be traversed.
  const old=Object.hasOwn(target,key)?target[key]:undefined;
  if(old&&value&&typeof old==='object'&&typeof value==='object'&&
     !Array.isArray(old)&&!Array.isArray(value)&&
     (Object.getPrototypeOf(old)===Object.prototype||Object.getPrototypeOf(old)===null)&&
     (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)){
   mergeFinanceRecord(old,value);
  }else if(key==='__proto__'){
   Object.defineProperty(target,key,{value,writable:true,enumerable:true,configurable:true});
  }else target[key]=value;
 }
}
function commitFinanceDraft(state,draft){
 for(const key of ['finance','assets','householdDynamics']){
  if(draft[key]===undefined)continue;
  if(state[key]&&typeof state[key]==='object'&&!Array.isArray(state[key])&&
     draft[key]&&typeof draft[key]==='object'&&!Array.isArray(draft[key])){
   mergeFinanceRecord(state[key],draft[key]);
  }else state[key]=draft[key];
 }
}

export function payDownDebt(state,amount){
 const draft=financeDraft(state);
 const remaining=payDownDebtInternal(draft,amount);
 commitFinanceDraft(state,draft);
 return remaining;
}

function payDownDebtInternal(state,amount){
 let budget=validatedMoney(amount,'Repayment amount');
 const f=ensurePersonalFinance(state);
 ensureDebtBuckets(f);
 const order=['consumer','emergency','medical','car','housing'];
 for(const key of order){
  if(budget<=0)break;
  const paid=Math.min(f.debts[key],budget);
  f.debts[key]-=paid;
  budget-=paid;
  if(key==='emergency')settleRecentShockDebt(state,paid);
  if(key==='housing'&&state.assets?.home)state.assets.home.remainingDebt=Math.max(0,(state.assets.home.remainingDebt??0)-paid);
  if(key==='car'&&state.assets?.car)state.assets.car.remainingDebt=Math.max(0,(state.assets.car.remainingDebt??0)-paid);
 }
 return syncDebt(f);
}

// Used by the budget activity: validate cash and rehearse debt reconciliation
// on copies *before* touching either the original cash or the action ledger.
// The debt ledger itself remains authoritative about how much can be repaid.
export function repayBudgetDebt(state){
 const f=state.finance;
 if(!f)throw new RangeError('Budget repayment requires a finance account');
 const cash=validBalance(f.cash,'Cash');
 const preview={...state,
  finance:structuredClone(f),
  assets:state.assets?structuredClone(state.assets):undefined,
  householdDynamics:state.householdDynamics?structuredClone(state.householdDynamics):undefined
 };
 ensurePersonalFinance(preview);
 const debt=preview.finance.debt;
 if(cash<=10000||debt<=0)return 0;
 const amount=Math.min(debt,Math.round(cash*.20));
 const before=preview.finance.debt;
 payDownDebt(preview,amount);
 const paid=before-preview.finance.debt;
 if(!Number.isSafeInteger(paid)||paid<0||paid>cash)
  throw new RangeError('Invalid budget repayment');
 // No mutation above; the same deterministic repayment now commits once.
 payDownDebt(state,amount);
 f.cash=cash-paid;
 return paid;
}

export function ensurePersonalFinance(state){
 if(state.finance){
  state.finance.savings??=0;
  state.finance.financialDistressYears??=0;
  state.finance.financialDistressEvents??=0;
  state.finance.debtRestructured??=false;
  state.finance.activitySpendingAnnual??=0;
  ensureDebtBuckets(state.finance,state.assets);
  return state.finance;
 }
 const studentAwayFromHome=Boolean(state.higherEducation?.enrolled&&state.higherEducation?.movedForUniversity);
 state.finance={
  cash:STARTING_CASH_BY_CLASS[state.household.economicClass]??5000,
  savings:0,
  debt:0,
  debts:{consumer:0,medical:0,housing:0,car:0,emergency:0},
  monthlyIncome:0,
  monthlyExpenses:0,
  familySupportMonthly:0,
  childMonthlyCost:0,
  financialDistressYears:0,
  financialDistressEvents:0,
  debtRestructured:false,
  lifestyle:{housing:studentAwayFromHome?'shared':'family',food:'standard',clothing:'basic',transport:'public'}
 };
 return state.finance;
}

function familySupport(state){
 const isStudent=state.higherEducation?.enrolled;
 const isYoungGap=state.nextPath==='gap'&&state.player.age<=22;
 if(!isStudent&&!isYoungGap)return 0;
 const livingParents=[['mother',state.parents?.mother],['father',state.parents?.father]].filter(([,person])=>person?.alive);
 if(!livingParents.length)return 0;
 const relationship=livingParents.reduce((sum,[id])=>sum+(state.player.relationships?.[id]??60),0)/livingParents.length;
 const relationFactor=relationship>=70?1:relationship>=50?.8:.55;
 const survivingFactor=livingParents.length===2?1:.58;
 return Math.round((STUDENT_SUPPORT_BY_CLASS[state.household.economicClass]??4500)*relationFactor*survivingFactor);
}

function effectiveTaxRate(monthly,retired=false){
 if(retired)return .06;
 if(monthly<=40000)return .12;
 if(monthly<=80000)return .18;
 if(monthly<=140000)return .23;
 return .28;
}

function lateLifeCareCosts(state){
 const mode=state.lateLife?.careMode;
 if(!mode)return 0;
 if(mode==='family')return 3000;
 if(mode==='home-care')return 14000;
 if(mode==='assisted')return 26000;
 return 0;
}

function recurringOwnershipCosts(state){
 let monthly=0;
 if(state.assets?.home)monthly+=Math.round((state.assets.home.price??0)*.007/12);
 if(state.assets?.car)monthly+=Math.round((state.assets.car.price??0)*.025/12);
 monthly+=(state.healthProfile?.conditions?.length??0)*1200;
 return monthly;
}

function partnerContribution(state){
 const r=state.social?.romance;
 if(!r||r.alive===false||!['cohabiting','married'].includes(r.status))return 0;
 return Math.round((r.monthlyIncome??0)*.55);
}

function securedDebt(state){
 return Math.max(0,state.assets?.home?.remainingDebt??0)+Math.max(0,state.assets?.car?.remainingDebt??0);
}

function serviceDebt(state,available){
 const f=state.finance;
 ensureDebtBuckets(f);
 if(f.debt<=0||available<=0)return available;
 let budget=Math.min(f.debt,Math.round(available*.55));
 const original=budget;
 const order=['consumer','emergency','medical','car','housing'];
 for(const key of order){
  if(budget<=0)break;
  const payment=Math.min(f.debts[key],budget);
  f.debts[key]-=payment;
  budget-=payment;
  if(key==='emergency')settleRecentShockDebt(state,payment);
  if(key==='housing'&&state.assets?.home)state.assets.home.remainingDebt=Math.max(0,(state.assets.home.remainingDebt??0)-payment);
  if(key==='car'&&state.assets?.car)state.assets.car.remainingDebt=Math.max(0,(state.assets.car.remainingDebt??0)-payment);
 }
 syncDebt(f);
 return available-(original-budget);
}

function drawReserves(f,amount){
 let remaining=Math.max(0,amount);
 const cashUsed=Math.min(Math.max(0,f.cash??0),remaining);
 f.cash-=cashUsed;
 remaining-=cashUsed;
 const savingsUsed=Math.min(Math.max(0,f.savings??0),remaining);
 f.savings-=savingsUsed;
 remaining-=savingsUsed;
 return remaining;
}

function discretionaryRate(state){
 const l=state.finance.lifestyle;
 const monthlyGross=state.career?.monthlyIncome??state.retirement?.pensionMonthly??0;
 let rate=.22;
 if(monthlyGross>60000)rate+=.04;
 if(monthlyGross>100000)rate+=.05;
 if(monthlyGross>160000)rate+=.06;
 if(state.player.age>=30)rate+=.02;
 if((state.children?.length??0)>0)rate+=.04;
 if(l.food==='premium')rate+=.08;
 else if(l.food==='healthy')rate+=.03;
 else if(l.food==='frugal')rate-=.05;
 if(l.clothing==='premium')rate+=.05;
 if(l.transport==='car')rate+=.03;
 if(l.housing==='apartment')rate+=.03;
 if(state.retirement?.retired)rate-=.04;
 return clamp(rate,.14,.58);
}

function cashReserveTarget(f){
 return Math.round(clamp((f.monthlyExpenses+f.ownershipCostsMonthly)*5,80000,900000));
}

function longTermSavingsCap(state,annualIncome){
 const age=state.player.age;
 const years=Math.max(1,age-18);
 const targetMultiple=age<30?.7:age<40?1.5:age<50?2.5:age<60?3.5:4.5;
 return Math.max(150000,Math.round((annualIncome||1)*targetMultiple+years*18000));
}

function lifestyleCreep(state,annualIncome){
 const f=state.finance;
 if(!f?.lifestyle||annualIncome<=0)return;
 const monthly=annualIncome/12;
 if(monthly>=90000&&f.lifestyle.food==='standard')f.lifestyle.food='healthy';
 if(monthly>=130000&&f.lifestyle.clothing==='basic')f.lifestyle.clothing='standard';
 if(state.player.age>=30&&monthly>=80000&&f.lifestyle.housing==='family')f.lifestyle.housing='shared';
}

function downgradeLifestyle(state){
 const l=state.finance.lifestyle;
 let changed=false;
 if(l.clothing==='premium'){l.clothing='standard';changed=true;}
 else if(l.clothing==='standard'){l.clothing='basic';changed=true;}
 if(l.food==='premium'){l.food='healthy';changed=true;}
 if(!state.assets?.car&&l.transport==='car'){l.transport='public';changed=true;}
 if(['apartment','studio'].includes(l.housing)){l.housing='shared';changed=true;}
 return changed;
}

// All sale paths must retire the lien and retain any shortfall as unsecured
// debt. Otherwise a future purchase can incorrectly inherit the old loan.
export function settleSecuredAssetSale(state,type,proceeds,repayConsumer=false){
 if(!['car','housing'].includes(type))throw new Error('Unsupported secured debt type');
 const sale=validatedMoney(proceeds,'Sale proceeds');
 const preview=previewPersonalFinance(state);
 const lien=preview.debts[type];
 const surplus=Math.max(0,sale-lien);
 const cashAdded=repayConsumer?Math.max(0,surplus-preview.debts.consumer):surplus;
 const cash=preview.cash??0;
 if(typeof cash!=='number'||!Number.isFinite(cash)||!Number.isSafeInteger(Math.round(cash))||
    cashAdded>Number.MAX_SAFE_INTEGER-cash)
  throw new RangeError('Sale would exceed safe cash limit or cash is invalid');
 const f=ensurePersonalFinance(state);
 const debts=ensureDebtBuckets(f,state.assets);
 const secured=debts[type];
 const payoff=Math.min(secured,sale);
 debts[type]=0;
 debts.consumer+=secured-payoff;
 let available=sale-payoff;
 let extraPaid=0;
 if(repayConsumer){
  extraPaid=Math.min(debts.consumer,available);
  debts.consumer-=extraPaid;
  available-=extraPaid;
 }
 f.cash=(f.cash??0)+available;
 syncDebt(f);
 return {sale,payoff,extraPaid,net:sale-secured};
}

function liquidateCar(state){
 const car=state.assets?.car;
 if(!car)return 0;
 const proceeds=Math.round((car.price??0)*.45);
 settleSecuredAssetSale(state,'car',proceeds,true);
 state.assets.car=null;
 state.finance.lifestyle.transport='public';
 return proceeds;
}

function liquidateHome(state){
 const home=state.assets?.home;
 if(!home)return 0;
 const proceeds=Math.round((home.price??0)*.88);
 settleSecuredAssetSale(state,'housing',proceeds,true);
 state.assets.home=null;
 state.finance.lifestyle.housing='shared';
 return proceeds;
}

function manageFinancialDistress(state,annualIncome,reserveTarget){
 const f=state.finance;
 const secured=securedDebt(state);
 const debtCapacity=secured+Math.max(750000,annualIncome*2.5);
 const liquid=(f.cash??0)+(f.savings??0);
 const distressed=f.debt>debtCapacity&&liquid<reserveTarget*.5;
 const actions=[];
 if(distressed){
  f.financialDistressYears=(f.financialDistressYears??0)+1;
  f.financialDistressEvents=(f.financialDistressEvents??0)+1;
 }else{
  f.financialDistressYears=Math.max(0,(f.financialDistressYears??0)-1);
  return actions;
 }
 if(downgradeLifestyle(state))actions.push('yaşam giderleri düşürüldü');
 if(f.financialDistressYears>=2&&state.assets?.car){
  const proceeds=liquidateCar(state);
  actions.push('araç satıldı (₺'+proceeds.toLocaleString('tr-TR')+')');
 }
 if(f.financialDistressYears>=3&&state.assets?.home&&f.debt>annualIncome*4+(state.assets.home.remainingDebt??0)){
  const proceeds=liquidateHome(state);
  actions.push('ev satıldı (₺'+proceeds.toLocaleString('tr-TR')+')');
 }
 if(
  f.financialDistressYears>=3&&!state.assets?.home&&!state.assets?.car&&
  f.debt>Math.max(1200000,annualIncome*4.5)&&
  (f.lastRestructureAge==null||state.player.age-f.lastRestructureAge>=5)
 ){
  ensureDebtBuckets(f);
  const before=f.debt;
  f.debts.consumer=Math.round(f.debts.consumer*.68);
  const emergencyBefore=f.debts.emergency;
  f.debts.emergency=Math.round(emergencyBefore*.72);
  settleRecentShockDebt(state,emergencyBefore-f.debts.emergency);
  syncDebt(f);
  f.debtRestructured=true;
  f.lastRestructureAge=state.player.age;
  actions.push('borç yeniden yapılandırıldı (₺'+Math.round(before-f.debt).toLocaleString('tr-TR')+' uzlaşma indirimi)');
 }
 return actions;
}

// Calculate the annual budget without mutating the save. In particular,
// debt-cap failures must be detected before cash reserves, lifestyle or
// lastProcessedYear are changed.
function previewAnnualBudget(state){
 const f=state.finance??{};
 const monthlyIncome=state.career?.employed?state.career.monthlyIncome:(state.retirement?.retired?state.retirement.pensionMonthly:0);
 const familySupportMonthly=familySupport(state);
 const partnerContributionMonthly=partnerContribution(state);
 const adultChildSupportMonthly=state.lateLife?.familySupportMonthly??0;
 const parentCareMonthlyCost=state.parentCare?.active?(state.parentCare.monthlyCost??0):0;
 const macro=economy(state);
 const monthlyExpenses=Math.round((lifestyleMonthlyCost(state)+(f.childMonthlyCost??0)+parentCareMonthlyCost+lateLifeCareCosts(state))*macro.costOfLiving);
 const monthlyTax=Math.round(monthlyIncome*effectiveTaxRate(monthlyIncome,Boolean(state.retirement?.retired)));
 const ownershipCostsMonthly=recurringOwnershipCosts(state);
 const annualIncome=(monthlyIncome-monthlyTax+familySupportMonthly+partnerContributionMonthly+adultChildSupportMonthly)*12;
 const annualExpense=(monthlyExpenses+ownershipCostsMonthly)*12;
 const annualNet=annualIncome-annualExpense;
 for(const [name,value] of Object.entries({monthlyIncome,familySupportMonthly,partnerContributionMonthly,adultChildSupportMonthly,
   parentCareMonthlyCost,monthlyExpenses,monthlyTax,ownershipCostsMonthly,annualIncome,annualExpense,annualNet})){
  if(typeof value!=='number'||!Number.isFinite(value)||!Number.isSafeInteger(Math.round(value)))
   throw new RangeError('Invalid or unsafe annual finance '+name);
 }
 if(annualNet<0){
  const cash=f.cash??(STARTING_CASH_BY_CLASS[state.household.economicClass]??5000);
  const savings=f.savings??0;
  const unresolved=Math.max(0,-annualNet-Math.max(0,cash)-Math.max(0,savings));
  if(unresolved>0){
   const preview=previewPersonalFinance(state);
   if(Math.ceil(unresolved)>Number.MAX_SAFE_INTEGER-preview.debt)
    throw new RangeError('Annual debt exceeds safe monetary limit');
  }
 }
 return {monthlyIncome,familySupportMonthly,partnerContributionMonthly,adultChildSupportMonthly,
  parentCareMonthlyCost,monthlyExpenses,monthlyTax,ownershipCostsMonthly,annualIncome,annualExpense,annualNet};
}

// The annual flow includes interest, debt service, distress sales, and shock
// write-offs. A failure in a late stage must never leave an earlier stage
// committed. Run once on an isolated finance draft, then commit on success.
export function processPersonalFinanceYear(state){
 const draft=financeDraft(state);
 const result=processPersonalFinanceYearInternal(draft);
 // A repeated year is a true no-op, including legacy account normalization.
 if(result.length===0)return result;
 commitFinanceDraft(state,draft);
 return result;
}

function processPersonalFinanceYearInternal(state){
 // Reject invalid persisted calendar markers before reconciling or budgeting.
 const {calendarYear,replayed}=annualYearStatus(state.year,state.finance?.lastProcessedYear,'personal finances');
 if(replayed)return [];
 // Reject corrupt balances and unsafe annual income before normalizing old
 // debt records or writing a single annual finance field.
 if(state.finance){
  validBalance(state.finance.cash,'Cash',{allowNegative:true});
  validBalance(state.finance.savings??0,'Savings');
  validBalance(state.finance.activitySpendingAnnual??0,'Annual activity spending');
 }
 const budget=previewAnnualBudget(state);
 const f=ensurePersonalFinance(state);
 const {annualIncome,annualExpense,annualNet}=budget;
 for(const key of ['monthlyIncome','familySupportMonthly','partnerContributionMonthly','adultChildSupportMonthly',
   'parentCareMonthlyCost','monthlyExpenses','monthlyTax','ownershipCostsMonthly'])f[key]=budget[key];
 const macro=economy(state);
 f.discretionaryAnnual=0;

 if(annualNet>=0){
  lifestyleCreep(state,annualIncome);
  f.discretionaryAnnual=Math.round(annualNet*discretionaryRate(state));
  let available=Math.max(0,annualNet-f.discretionaryAnnual);
  available=serviceDebt(state,available);
  const reserveTarget=cashReserveTarget(f);
  const reserveNeed=Math.max(0,reserveTarget-f.cash);
  const toCash=Math.min(reserveNeed,available,Math.max(0,Number.MAX_SAFE_INTEGER-f.cash));
  f.cash+=toCash;
  available-=toCash;
  const savingsCap=longTermSavingsCap(state,annualIncome);
  const savingsRoom=Math.max(0,savingsCap-(f.savings??0));
  const toSavings=Math.min(savingsRoom,available,Number.MAX_SAFE_INTEGER-(f.savings??0));
  f.savings=(f.savings??0)+toSavings;
  available-=toSavings;
  // Surplus above a realistic long-term savings target is consumed through
  // travel, household replacement, gifts and other non-asset life spending.
  f.activitySpendingAnnual=Math.min(Number.MAX_SAFE_INTEGER,Math.round((f.activitySpendingAnnual??0)*.25+available));
 }else{
  const unresolved=drawReserves(f,Math.abs(annualNet));
  if(unresolved>0){
   const consumerLimit=Math.max(60000,Math.min(240000,annualIncome*.18));
   const consumerPart=Math.min(unresolved,consumerLimit);
   if(consumerPart>0)addDebt(state,'consumer',consumerPart);
   if(unresolved>consumerPart)addDebt(state,'emergency',unresolved-consumerPart);
  }
 }

 ensureDebtBuckets(f);
 const macroCredit=economy(state).creditConditions??1;
 for(const [key,rate] of Object.entries(DEBT_RATES)){
  const effective=f.debtRestructured&&['consumer','emergency'].includes(key)?Math.min(rate,.045):rate;
  const accrued=Math.round(f.debts[key]*effective*macroCredit);
  if(!Number.isFinite(accrued)||accrued<0)
   throw new RangeError('Invalid annual debt interest');
  // Cap interest at the safe ledger ceiling; otherwise individually valid
  // loans can produce an imprecise/unsafe aggregate during annual accrual.
  const charged=Math.min(accrued,Number.MAX_SAFE_INTEGER-f.debt);
  f.debts[key]+=charged;
  f.debt+=charged;
 }
 // Secured asset balances include accrued interest as well as repayments.
 if(state.assets?.car)state.assets.car.remainingDebt=f.debts.car;
 if(state.assets?.home)state.assets.home.remainingDebt=f.debts.housing;
 syncDebt(f);
 const reserveTarget=cashReserveTarget(f);
 const distressActions=manageFinancialDistress(state,Math.max(0,annualIncome),reserveTarget);
 if(calendarYear!==null)f.lastProcessedYear=calendarYear;

 return [{
  age:state.player.age,
  kind:'finance',
  text:'Yıllık bütçe: gelir ₺'+Math.round(annualIncome).toLocaleString('tr-TR')+
   ' • temel gider ₺'+Math.round(annualExpense).toLocaleString('tr-TR')+
   ' • isteğe bağlı harcama ₺'+Math.round(f.discretionaryAnnual).toLocaleString('tr-TR')+
   ' • nakit ₺'+Math.round(f.cash).toLocaleString('tr-TR')+
   ' • uzun vadeli birikim ₺'+Math.round(f.savings??0).toLocaleString('tr-TR')+
   (f.debt>0?' • borç ₺'+Math.round(f.debt).toLocaleString('tr-TR'):'')+
   (distressActions.length?' • finansal önlem: '+distressActions.join(', '):'')
 }];
}
