export const JOB_META={
 cleaner:{family:'service',tier:1,entry:true,regulated:false,relatedFamilies:['service']},
 cook:{family:'hospitality',tier:2,entry:true,regulated:false,relatedFamilies:['hospitality','service']},
 mechanic:{family:'trades',tier:2,entry:true,regulated:false,relatedFamilies:['trades','transport']},
 driver:{family:'transport',tier:2,entry:true,regulated:false,relatedFamilies:['transport','trades']},
 shopkeeper:{family:'business',tier:2,entry:true,regulated:false,relatedFamilies:['business','hospitality']},
 accountant:{family:'business',tier:3,entry:true,regulated:false,relatedFamilies:['business']},
 teacher:{family:'education',tier:3,entry:false,regulated:true,degreeTags:['teacher'],relatedFamilies:['education']},
 nurse:{family:'health',tier:3,entry:false,regulated:true,degreeTags:['nurse'],relatedFamilies:['health']},
 engineer:{family:'engineering',tier:4,entry:false,regulated:false,degreeTags:['engineer'],relatedFamilies:['engineering','tech']},
 developer:{family:'tech',tier:4,entry:false,regulated:false,degreeTags:['developer'],relatedFamilies:['tech','engineering','creative']},
 designer:{family:'creative',tier:4,entry:false,regulated:false,degreeTags:['designer'],relatedFamilies:['creative','tech']},
 lawyer:{family:'law',tier:4,entry:false,regulated:true,degreeTags:['lawyer'],relatedFamilies:['law']},
 doctor:{family:'health',tier:5,entry:false,regulated:true,degreeTags:['doctor'],relatedFamilies:['health']}
};

export function metaFor(jobId){
 return JOB_META[jobId]??{family:'general',tier:1,entry:true,regulated:false,relatedFamilies:['general']};
}

export function sameFamily(a,b){
 return metaFor(a).family===metaFor(b).family;
}

export function familyCompatibility(fromId,toId){
 if(!fromId||!toId)return 0;
 const from=metaFor(fromId),to=metaFor(toId);
 if(from.family===to.family)return 100;
 if(from.relatedFamilies.includes(to.family)||to.relatedFamilies.includes(from.family))return 65;
 return 0;
}

export function isRegulated(jobId){
 return Boolean(metaFor(jobId).regulated);
}

export function retrainingYears(fromId,toId){
 const compatibility=familyCompatibility(fromId,toId);
 if(compatibility>=65)return 0;
 const target=metaFor(toId);
 if(target.regulated)return Infinity;
 if(target.tier>=4)return 2;
 if(target.tier>=3)return 1;
 return 1;
}
