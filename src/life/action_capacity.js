const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function annualActionCapacity(state){
 const age=state.player?.age??0;
 if(age<5)return 0;

 let capacity=age<12?2:3;
 const health=state.player?.health?.current??75;
 const stress=state.healthProfile?.stress??30;
 const youngChildren=(state.children??[]).filter(child=>child.age<6).length;
 const careMode=state.lateLife?.careMode;

 if(health<35)capacity-=1;
 if(stress>=78)capacity-=1;
 if(age>=19&&youngChildren>=1)capacity-=1;
 if(youngChildren>=3)capacity-=1;
 if(['home-care','assisted'].includes(careMode))capacity-=1;

 return clamp(capacity,1,3);
}
