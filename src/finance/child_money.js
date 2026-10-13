// Shared browser/terminal pocket-money operations. A rejected choice must
// never partially alter a child's wallet, savings, or lifetime spending.
function balance(value,label){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)
  throw new RangeError(label+' must be a nonnegative safe monetary balance');
 return value;
}
function account(state){
 const m=state.childMoney;
 if(!m||typeof m!=='object'||Array.isArray(m))throw new RangeError('Child money account is missing');
 const wallet=balance(m.wallet??0,'Child wallet');
 const saved=balance(m.saved??0,'Child savings');
 const spent=balance(m.totalSpent??0,'Child spending');
 balance(m.totalAllowance??0,'Child allowance total');
 return {m,wallet,saved,spent};
}
export function saveChildAllowance(state){
 const {m,wallet,saved}=account(state);
 const moved=Math.round(wallet*.6);
 if(moved>Number.MAX_SAFE_INTEGER-saved)
  throw new RangeError('Child savings exceeds safe monetary limit');
 m.wallet=wallet-moved;
 m.saved=saved+moved;
 return moved;
}
export function spendChildAllowance(state,amount){
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||
    !Number.isSafeInteger(Math.round(amount)))
  throw new RangeError('Child spending amount must be a nonnegative safe monetary amount');
 const cost=Math.round(amount);
 const {m,wallet,spent}=account(state);
 if(cost>wallet)throw new RangeError('Insufficient child wallet balance');
 if(cost>Number.MAX_SAFE_INTEGER-spent)
  throw new RangeError('Child spending total exceeds safe monetary limit');
 m.wallet=wallet-cost;
 m.totalSpent=spent+cost;
 return cost;
}

// Yearly pocket-money income uses the same ledger checks as child spending.
// Check both cumulative balances before creating or modifying any account.
export function creditChildAllowance(state,amount){
 if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<0)
  throw new RangeError('Child allowance credit must be a nonnegative safe monetary amount');
 const m=state.childMoney??{wallet:0,saved:0,totalAllowance:0,totalSpent:0,lastAllowanceAge:null};
 if(typeof m!=='object'||Array.isArray(m))throw new RangeError('Invalid child money account');
 const wallet=balance(m.wallet??0,'Child wallet');
 balance(m.saved??0,'Child savings');
 balance(m.totalSpent??0,'Child spending');
 const total=balance(m.totalAllowance??0,'Child allowance total');
 if(amount>Number.MAX_SAFE_INTEGER-wallet||amount>Number.MAX_SAFE_INTEGER-total)
  throw new RangeError('Child allowance credit exceeds safe monetary limit');
 if(!state.childMoney)state.childMoney=m;
 m.wallet=wallet+amount;
 m.totalAllowance=total+amount;
 return amount;
}
