import {RNG} from './rng.js';

// Custom RNGs can opt in to atomic annual processing by implementing BOTH
// snapshotState() and restoreState(token). The token must cover all mutable
// draw state, including any state shared with forked generators.
export function captureRngCheckpoint(rng){
 const snapshot=rng?.snapshotState,restore=rng?.restoreState;
 // A subclass of RNG may keep additional mutable draw state. Its explicit
 // checkpoint protocol must take precedence over the built-in two-field one.
 if(snapshot!==undefined||restore!==undefined){
  if(typeof snapshot!=='function'||typeof restore!=='function')
   throw new TypeError('RNG checkpoint requires snapshotState and restoreState');
  const token=snapshot.call(rng);
  return ()=>restore.call(rng,token);
 }
 if(rng instanceof RNG){
  const seed=rng.seed,state=rng.state;
  return ()=>{rng.seed=seed;rng.state=state;};
 }
 // Legacy injected RNGs without a checkpoint protocol still work, but their
 // draw state cannot be restored after an exception.
 return ()=>{};
}

// Descriptor equality avoids redundant redefinitions on mostly unchanged
// transaction graphs, without invoking getters or losing property flags.
function sameDescriptor(a,b){
 if(!a||!b||a.configurable!==b.configurable||a.enumerable!==b.enumerable)return false;
 const data=Object.hasOwn(a,'value');
 if(data!==Object.hasOwn(b,'value'))return false;
 return data?a.writable===b.writable&&Object.is(a.value,b.value):
  a.get===b.get&&a.set===b.set;
}

// Preserve public references to every reachable plain object/array rather
// than replacing nested ledgers with clones after an aborted annual pass.
export function snapshotObjectGraph(roots){
 const seen=new Map();
 const internalStates=new Map();
 const arrayBufferStates=new Map();
 // Reserve identities on enqueue, including aliases and cycles. Capture own
 // property descriptors rather than reading properties: an accessor must not
 // execute user code while an otherwise read-only checkpoint is created.
 const pending=[];
 const enqueue=value=>{
  if(value!==null&&typeof value==='object'&&!seen.has(value)){
   seen.set(value,null);
   pending.push(value);
  }
 };
 for(const root of roots)enqueue(root);
 while(pending.length){
  const value=pending.pop();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  seen.set(value,descriptors);
  // Views keep their backing stores in internal slots, not own descriptors.
  // Use the native accessors so subclass overrides cannot hide the buffer.
  if(ArrayBuffer.isView(value)){
   const prototype=Object.getPrototypeOf(Uint8Array.prototype);
   const getter=value instanceof DataView?
    Object.getOwnPropertyDescriptor(DataView.prototype,'buffer').get:
    Object.getOwnPropertyDescriptor(prototype,'buffer').get;
   enqueue(getter.call(value));
  }
  if(value instanceof ArrayBuffer){
   // Native accessors reject Proxy receivers; their own descriptors are still
   // snapshotted, but their inaccessible backing bytes are not promised.
   let byteLength;
   try{byteLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get.call(value);}
   catch(error){if(!(error instanceof TypeError))throw error;}
   if(byteLength!==undefined){
    try{arrayBufferStates.set(value,{bytes:Uint8Array.from(new Uint8Array(value))});}
    catch(error){if(!(error instanceof TypeError))throw error;}
   }
  }
  // Native collection contents and Date timestamps are internal slots, not
  // own properties. Snapshot them separately, retaining referenced identities.
  if(value instanceof Map){
   // Proxies of native collections pass instanceof but lack the native
   // internal slots on the proxy receiver. Keep their descriptor snapshot
   // rather than rejecting a previously supported graph at checkpoint time.
   let entries;
   try{entries=Array.from(Map.prototype.entries.call(value));}
   catch(error){if(!(error instanceof TypeError))throw error;}
   if(entries){
    internalStates.set(value,{kind:'map',entries});
    for(const [key,item] of entries){enqueue(key);enqueue(item);}
   }
  }else if(value instanceof Set){
   let items;
   try{items=Array.from(Set.prototype.values.call(value));}
   catch(error){if(!(error instanceof TypeError))throw error;}
   if(items){
    internalStates.set(value,{kind:'set',items});
    for(const item of items)enqueue(item);
   }
  }else if(value instanceof Date){
   let time,validReceiver=true;
   try{time=Date.prototype.getTime.call(value);}
   catch(error){if(error instanceof TypeError)validReceiver=false;else throw error;}
   if(validReceiver)internalStates.set(value,{kind:'date',time});
  }
  for(const key of Reflect.ownKeys(descriptors)){
   const descriptor=descriptors[key];
   if(Object.hasOwn(descriptor,'value'))enqueue(descriptor.value);
  }
 }
 return ()=>{
  const failures=[];
  // Restore backing stores before view index descriptors: a temporarily
  // out-of-bounds view becomes usable again only after its buffer is resized.
  for(const [buffer,{bytes}] of arrayBufferStates){
   try{
    const length=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get.call(buffer);
    if(length!==bytes.length){
     if(typeof ArrayBuffer.prototype.resize!=='function')
      throw new TypeError('Cannot restore resized transaction ArrayBuffer');
     ArrayBuffer.prototype.resize.call(buffer,bytes.length);
    }
    const current=new Uint8Array(buffer);
    if(current.some((byte,index)=>byte!==bytes[index]))
     Uint8Array.prototype.set.call(current,bytes);
   }catch(error){failures.push(error);}
  }
  for(const [ref,descriptors] of seen){
   const internal=internalStates.get(ref);
   if(internal){
    try{
     if(internal.kind==='map'){
      const current=Array.from(Map.prototype.entries.call(ref));
      if(current.length!==internal.entries.length||current.some(([key,value],i)=>
       !Object.is(key,internal.entries[i][0])||!Object.is(value,internal.entries[i][1]))){
       Map.prototype.clear.call(ref);
       for(const [key,value] of internal.entries)Map.prototype.set.call(ref,key,value);
      }
     }else if(internal.kind==='set'){
      const current=Array.from(Set.prototype.values.call(ref));
      if(current.length!==internal.items.length||current.some((item,i)=>
       !Object.is(item,internal.items[i]))){
       Set.prototype.clear.call(ref);
       for(const item of internal.items)Set.prototype.add.call(ref,item);
      }
     }else if(!Object.is(Date.prototype.getTime.call(ref),internal.time)){
      Date.prototype.setTime.call(ref,internal.time);
     }
    }catch(error){failures.push(error);}
   }
   // A single un-restorable property must not prevent other state objects
   // from being restored. Report every failure after best-effort rollback.
   for(const key of Reflect.ownKeys(ref)){
    if(Object.hasOwn(descriptors,key))continue;
    try{
     if(!Reflect.deleteProperty(ref,key))
      throw new TypeError('Cannot restore non-configurable transaction property');
    }catch(error){failures.push(error);}
   }
   // Restore original descriptors, including non-enumerable, symbol and own
   // "__proto__" data keys. Define array length last so sparse slots survive.
   for(const key of Reflect.ownKeys(descriptors)){
    if(Array.isArray(ref)&&key==='length')continue;
    try{if(!sameDescriptor(Object.getOwnPropertyDescriptor(ref,key),descriptors[key]))
     Object.defineProperty(ref,key,descriptors[key]);}
    catch(error){failures.push(error);}
   }
   if(Array.isArray(ref)){
    try{if(!sameDescriptor(Object.getOwnPropertyDescriptor(ref,'length'),descriptors.length))
     Object.defineProperty(ref,'length',descriptors.length);}
    catch(error){failures.push(error);}
   }
  }
  if(failures.length===1)throw failures[0];
  if(failures.length)throw new AggregateError(failures,'Transaction graph rollback incomplete');
 };

}

// Object-graph snapshots preserve nested identities, but do not record a
// missing top-level field. Keep its presence as well as its previous value.
export function snapshotOwnFields(object,keys){
 // Read descriptors, not values: checkpointing an accessor must not invoke
 // its getter or setter, and restoring must preserve its original flags.
 const fields=keys.map(key=>({key,descriptor:Object.getOwnPropertyDescriptor(object,key)}));
 return ()=>{
  const failures=[];
  for(const {key,descriptor} of fields){
   try{
    if(descriptor)Object.defineProperty(object,key,descriptor);
    else if(!Reflect.deleteProperty(object,key))
     throw new TypeError('Cannot restore non-configurable transaction field');
   }catch(error){failures.push(error);}
  }
  if(failures.length===1)throw failures[0];
  if(failures.length)throw new AggregateError(failures,'Transaction field rollback incomplete');
 };

}

// Retain the original error if RNG restoration itself fails; a checkpoint
// failure must not be mistaken for a successful rollback.
export function restoreRngOrThrow(restore,error){
 try{restore();}catch(restoreError){
  throw new AggregateError([error,restoreError],'Annual RNG checkpoint restoration failed');
 }
 throw error;
}
