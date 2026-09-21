const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function growTrait(current,rawGain){
 const value=clamp(Number(current??50));
 const gain=Math.max(0,Number(rawGain??0));
 if(gain===0)return value;
 const room=Math.max(0,100-value);
 const scaled=gain*Math.pow(room/100,1.35);
 return Math.min(99.5,value+scaled);
}

export function changeTrait(current,delta){
 const value=clamp(Number(current??50));
 const amount=Number(delta??0);
 return amount>0?growTrait(value,amount):clamp(value+amount);
}
