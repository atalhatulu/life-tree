import {FIRST_NAMES,SURNAMES} from './names.js';
import {TURKEY_CITIES,TURKEY_REGIONS,pickBirthCity,cityById,cityByPlate,cityByName,locationProfile} from './cities.js';
import {SCHOOL_PREFIXES,UNIVERSITY_NAMES,UNIVERSITIES,UNIVERSITY_PROGRAMS} from './education.js';
import {JOBS} from './jobs.js';
import {TURKEY_2026_ECONOMY} from './economy.js';

export const TURKEY_PROFILE={
 id:'TR',
 name:'Türkiye',
 startYear:2026,
 currency:'TRY',
 firstNames:FIRST_NAMES,
 surnames:SURNAMES,
 cities:TURKEY_CITIES,
 regions:TURKEY_REGIONS,
 schoolPrefixes:SCHOOL_PREFIXES,
 universityNames:UNIVERSITY_NAMES,
 universities:UNIVERSITIES,
 universityPrograms:UNIVERSITY_PROGRAMS,
 jobs:JOBS,
 economy:TURKEY_2026_ECONOMY
};

export {pickBirthCity,cityById,cityByPlate,cityByName,locationProfile};
