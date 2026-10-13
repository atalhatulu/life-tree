// Validate a cash inflow before modifying any account or associated lifecycle
// record. All currency is stored as rounded, safe integer lira amounts.
export function safeCashAmount(amount,label='Amount'){
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||
    !Number.isSafeInteger(Math.round(amount)))
  throw new RangeError(label+' must be a finite, nonnegative safe monetary amount');
 return Math.round(amount);
}

export function previewCashCredit(state,amount){
 const credit=safeCashAmount(amount,'Cash credit');
 const cash=state.finance?.cash??0;
 if(typeof cash!=='number'||!Number.isSafeInteger(cash)||
    !Number.isSafeInteger(cash+credit))
  throw new RangeError('Cash balance exceeds safe monetary limit or is invalid');
 return cash+credit;
}
