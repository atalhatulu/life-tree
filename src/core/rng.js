export class RNG {
  constructor(seed = Date.now()) { this.seed = RNG.hash(String(seed)); this.state = this.seed || 0x6d2b79f5; }
  static hash(text) { let h = 2166136261 >>> 0; for (let i=0;i<text.length;i+=1){ h ^= text.charCodeAt(i); h = Math.imul(h,16777619);} return h>>>0; }
  next(){
    if(!Number.isSafeInteger(this.state)||this.state<0)
      throw new RangeError('Invalid RNG counter');
    const increment=0x6d2b79f5;
    // The mixer only uses the low 32 bits. Rebase at the safe-integer limit
    // instead of rounding an unsafe counter and corrupting the draw stream.
    this.state=this.state>Number.MAX_SAFE_INTEGER-increment
      ?((this.state>>>0)+increment)>>>0
      :this.state+increment;
    let t=this.state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  int(min,max){ return Math.floor(this.next()*(max-min+1))+min; }
  chance(p){ return this.next()<p; }
  pick(items){ if(!items.length) throw new Error('Cannot pick from an empty array'); return items[this.int(0,items.length-1)]; }
  weighted(items){ const filtered=items.filter(i=>i.weight>0); if(!filtered.length) throw new Error('No weighted candidates'); const total=filtered.reduce((s,i)=>s+i.weight,0); let roll=this.next()*total; for(const item of filtered){ roll-=item.weight; if(roll<=0) return item.value; } return filtered.at(-1).value; }
  fork(label){ return new RNG(`${this.seed}:${label}`); }
}
