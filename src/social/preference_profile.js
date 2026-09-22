const clamp=(v,min=-2,max=2)=>Math.max(min,Math.min(max,v));

const FOOD_KEYS=['home-meal','tea','doner','lahmacun','burger','pizza','kebab','sushi'];
const ACTIVITY_KEYS=['park','cinema','cafe','picnic','football','gaming','concert','hiking','museum','gym'];

function score(rng,base=0){return clamp(base+rng.int(-2,2));}

export function createPreferenceProfile(person,rng){
 const sociability=(person.personality?.sociability??50)-50;
 const curiosity=(person.personality?.curiosity??50)-50;
 const discipline=(person.personality?.discipline??50)-50;

 const food={};
 for(const key of FOOD_KEYS)food[key]=score(rng);
 if(curiosity>20){
  food.sushi=clamp(food.sushi+1);
  food.kebab=clamp(food.kebab+1);
 }
 if(curiosity<-20)food['home-meal']=clamp(food['home-meal']+1);

 const activities={};
 for(const key of ACTIVITY_KEYS)activities[key]=score(rng);
 if(sociability>20){
  activities.cafe=clamp(activities.cafe+1);
  activities.concert=clamp(activities.concert+1);
  activities.football=clamp(activities.football+1);
 }
 if(sociability<-20){
  activities.gaming=clamp(activities.gaming+1);
  activities.park=clamp(activities.park+1);
 }
 if(curiosity>20){
  activities.museum=clamp(activities.museum+1);
  activities.hiking=clamp(activities.hiking+1);
 }
 if(discipline>20){
  activities.gym=clamp(activities.gym+1);
  activities.hiking=clamp(activities.hiking+1);
 }

 return {food,activities};
}

export function ensurePreferenceProfile(person,rng=null){
 if(person.preferencesProfile)return person.preferencesProfile;
 if(!rng)throw new Error('Preference profile requires RNG on first initialization.');
 person.preferencesProfile=createPreferenceProfile(person,rng);
 return person.preferencesProfile;
}

export function preferenceFor(person,key,kind='activity'){
 const profile=person.preferencesProfile;
 if(!profile)return 0;
 const map=kind==='food'?profile.food:profile.activities;
 return map?.[key]??0;
}
