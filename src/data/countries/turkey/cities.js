/**
 * 81 provinces ordered by vehicle-registration plate code.
 *
 * Province identity/plate/region and population2025 are reference data.
 * Birth weights are smoothed functions of 2025 RESIDENT POPULATION, not
 * observed province-specific live births. Wage, rent, job and education
 * multipliers remain bounded GAME-BALANCE PARAMETERS, not official rates.
 * Existing 14 economic profiles remain unchanged for saved-game balance.
 */
import {PROVINCE_POPULATION_2025,POPULATION_YEAR} from './population_2025.js';

export const TURKEY_REGIONS=Object.freeze({
 "marmara": "Marmara",
 "ege": "Ege",
 "akdeniz": "Akdeniz",
 "ic-anadolu": "İç Anadolu",
 "karadeniz": "Karadeniz",
 "dogu-anadolu": "Doğu Anadolu",
 "guneydogu-anadolu": "Güneydoğu Anadolu"
});
const SCALE_PROFILE={
 "metro": {
  "cost": 1.12,
  "wage": 1.08,
  "housing": 1.14,
  "jobs": 1.1,
  "university": 1.07
 },
 "large": {
  "cost": 1.02,
  "wage": 1,
  "housing": 1.03,
  "jobs": 1.03,
  "university": 1
 },
 "mid": {
  "cost": 0.94,
  "wage": 0.95,
  "housing": 0.91,
  "jobs": 0.95,
  "university": 0.95
 },
 "small": {
  "cost": 0.89,
  "wage": 0.92,
  "housing": 0.86,
  "jobs": 0.9,
  "university": 0.9
 }
};
// SEGE-2025 is contextual evidence, NOT a direct wage/rent index.
// These explicit hub adjustments are game-design assumptions for the 67 new profiles.
const HUB_TUNING=Object.freeze({
 kocaeli:{jobs:.14,wage:.075,cost:.045,housing:.065,university:.03},
 tekirdag:{jobs:.095,wage:.05,cost:.035,housing:.045},
 sakarya:{jobs:.07,wage:.035,cost:.015,housing:.025},
 manisa:{jobs:.085,wage:.04,cost:.02,housing:.03},
 denizli:{jobs:.075,wage:.035,cost:.02,housing:.025},
 yalova:{jobs:.04,wage:.025,cost:.055,housing:.095},
 mugla:{jobs:.055,wage:.02,cost:.10,housing:.16,university:.035},
 aydin:{jobs:.04,wage:.02,cost:.035,housing:.055},
 canakkale:{jobs:.025,wage:.02,cost:.04,housing:.07},
 edirne:{jobs:.025,wage:.02,cost:.025,housing:.04},
 sanliurfa:{jobs:.015,wage:0,cost:0,housing:0},
 van:{jobs:.025,wage:0,cost:0,housing:0},
 erzurum:{jobs:.02,wage:0,cost:0,housing:0},
 malatya:{jobs:.025,wage:0,cost:0,housing:0}
});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=(v)=>Math.round(v*1000)/1000;
export function populationBirthWeight(population){
 // Exponent <1 keeps small provinces reachable while tracking resident share.
 return round(Math.pow(population/100000,.9));
}
function calibratedGameProfile(id,scale,population){
 const base=SCALE_PROFILE[scale];
 const hub=HUB_TUNING[id]??{};
 const populationAdjustment=clamp(Math.log10(population/350000)*.075,-.055,.11);
 return {
  cost:round(clamp(base.cost+populationAdjustment*.6+(hub.cost??0),.78,1.42)),
  wage:round(clamp(base.wage+populationAdjustment*.35+(hub.wage??0),.82,1.18)),
  housing:round(clamp(base.housing+populationAdjustment*.85+(hub.housing??0),.72,1.48)),
  jobs:round(clamp(base.jobs+populationAdjustment*.65+(hub.jobs??0),.8,1.20)),
  university:round(clamp(base.university+populationAdjustment*.35+(hub.university??0),.82,1.16))
 };
}
export function migrationAttractionWeight(city){
 // Job destinations are NOT drawn with birth weights; cap metro pull.
 return clamp(Math.sqrt(city.population2025/350000),.65,4.5);
}
const PROVINCES=[
 [
  1,
  "adana",
  "Adana",
  "akdeniz",
  "large"
 ],
 [
  2,
  "adiyaman",
  "Adıyaman",
  "guneydogu-anadolu",
  "mid"
 ],
 [
  3,
  "afyonkarahisar",
  "Afyonkarahisar",
  "ege",
  "mid"
 ],
 [
  4,
  "agri",
  "Ağrı",
  "dogu-anadolu",
  "mid"
 ],
 [
  5,
  "amasya",
  "Amasya",
  "karadeniz",
  "small"
 ],
 [
  6,
  "ankara",
  "Ankara",
  "ic-anadolu",
  "metro"
 ],
 [
  7,
  "antalya",
  "Antalya",
  "akdeniz",
  "large"
 ],
 [
  8,
  "artvin",
  "Artvin",
  "karadeniz",
  "small"
 ],
 [
  9,
  "aydin",
  "Aydın",
  "ege",
  "mid"
 ],
 [
  10,
  "balikesir",
  "Balıkesir",
  "marmara",
  "mid"
 ],
 [
  11,
  "bilecik",
  "Bilecik",
  "marmara",
  "small"
 ],
 [
  12,
  "bingol",
  "Bingöl",
  "dogu-anadolu",
  "small"
 ],
 [
  13,
  "bitlis",
  "Bitlis",
  "dogu-anadolu",
  "small"
 ],
 [
  14,
  "bolu",
  "Bolu",
  "karadeniz",
  "small"
 ],
 [
  15,
  "burdur",
  "Burdur",
  "akdeniz",
  "small"
 ],
 [
  16,
  "bursa",
  "Bursa",
  "marmara",
  "large"
 ],
 [
  17,
  "canakkale",
  "Çanakkale",
  "marmara",
  "mid"
 ],
 [
  18,
  "cankiri",
  "Çankırı",
  "ic-anadolu",
  "small"
 ],
 [
  19,
  "corum",
  "Çorum",
  "karadeniz",
  "mid"
 ],
 [
  20,
  "denizli",
  "Denizli",
  "ege",
  "mid"
 ],
 [
  21,
  "diyarbakir",
  "Diyarbakır",
  "guneydogu-anadolu",
  "large"
 ],
 [
  22,
  "edirne",
  "Edirne",
  "marmara",
  "mid"
 ],
 [
  23,
  "elazig",
  "Elazığ",
  "dogu-anadolu",
  "mid"
 ],
 [
  24,
  "erzincan",
  "Erzincan",
  "dogu-anadolu",
  "small"
 ],
 [
  25,
  "erzurum",
  "Erzurum",
  "dogu-anadolu",
  "mid"
 ],
 [
  26,
  "eskisehir",
  "Eskişehir",
  "ic-anadolu",
  "mid"
 ],
 [
  27,
  "gaziantep",
  "Gaziantep",
  "guneydogu-anadolu",
  "large"
 ],
 [
  28,
  "giresun",
  "Giresun",
  "karadeniz",
  "small"
 ],
 [
  29,
  "gumushane",
  "Gümüşhane",
  "karadeniz",
  "small"
 ],
 [
  30,
  "hakkari",
  "Hakkâri",
  "dogu-anadolu",
  "small"
 ],
 [
  31,
  "hatay",
  "Hatay",
  "akdeniz",
  "mid"
 ],
 [
  32,
  "isparta",
  "Isparta",
  "akdeniz",
  "small"
 ],
 [
  33,
  "mersin",
  "Mersin",
  "akdeniz",
  "large"
 ],
 [
  34,
  "istanbul",
  "İstanbul",
  "marmara",
  "metro"
 ],
 [
  35,
  "izmir",
  "İzmir",
  "ege",
  "metro"
 ],
 [
  36,
  "kars",
  "Kars",
  "dogu-anadolu",
  "small"
 ],
 [
  37,
  "kastamonu",
  "Kastamonu",
  "karadeniz",
  "small"
 ],
 [
  38,
  "kayseri",
  "Kayseri",
  "ic-anadolu",
  "mid"
 ],
 [
  39,
  "kirklareli",
  "Kırklareli",
  "marmara",
  "small"
 ],
 [
  40,
  "kirsehir",
  "Kırşehir",
  "ic-anadolu",
  "small"
 ],
 [
  41,
  "kocaeli",
  "Kocaeli",
  "marmara",
  "large"
 ],
 [
  42,
  "konya",
  "Konya",
  "ic-anadolu",
  "large"
 ],
 [
  43,
  "kutahya",
  "Kütahya",
  "ege",
  "mid"
 ],
 [
  44,
  "malatya",
  "Malatya",
  "dogu-anadolu",
  "mid"
 ],
 [
  45,
  "manisa",
  "Manisa",
  "ege",
  "mid"
 ],
 [
  46,
  "kahramanmaras",
  "Kahramanmaraş",
  "akdeniz",
  "mid"
 ],
 [
  47,
  "mardin",
  "Mardin",
  "guneydogu-anadolu",
  "mid"
 ],
 [
  48,
  "mugla",
  "Muğla",
  "ege",
  "mid"
 ],
 [
  49,
  "mus",
  "Muş",
  "dogu-anadolu",
  "small"
 ],
 [
  50,
  "nevsehir",
  "Nevşehir",
  "ic-anadolu",
  "small"
 ],
 [
  51,
  "nigde",
  "Niğde",
  "ic-anadolu",
  "small"
 ],
 [
  52,
  "ordu",
  "Ordu",
  "karadeniz",
  "mid"
 ],
 [
  53,
  "rize",
  "Rize",
  "karadeniz",
  "small"
 ],
 [
  54,
  "sakarya",
  "Sakarya",
  "marmara",
  "mid"
 ],
 [
  55,
  "samsun",
  "Samsun",
  "karadeniz",
  "mid"
 ],
 [
  56,
  "siirt",
  "Siirt",
  "guneydogu-anadolu",
  "small"
 ],
 [
  57,
  "sinop",
  "Sinop",
  "karadeniz",
  "small"
 ],
 [
  58,
  "sivas",
  "Sivas",
  "ic-anadolu",
  "mid"
 ],
 [
  59,
  "tekirdag",
  "Tekirdağ",
  "marmara",
  "mid"
 ],
 [
  60,
  "tokat",
  "Tokat",
  "karadeniz",
  "mid"
 ],
 [
  61,
  "trabzon",
  "Trabzon",
  "karadeniz",
  "mid"
 ],
 [
  62,
  "tunceli",
  "Tunceli",
  "dogu-anadolu",
  "small"
 ],
 [
  63,
  "sanliurfa",
  "Şanlıurfa",
  "guneydogu-anadolu",
  "large"
 ],
 [
  64,
  "usak",
  "Uşak",
  "ege",
  "small"
 ],
 [
  65,
  "van",
  "Van",
  "dogu-anadolu",
  "mid"
 ],
 [
  66,
  "yozgat",
  "Yozgat",
  "ic-anadolu",
  "small"
 ],
 [
  67,
  "zonguldak",
  "Zonguldak",
  "karadeniz",
  "mid"
 ],
 [
  68,
  "aksaray",
  "Aksaray",
  "ic-anadolu",
  "small"
 ],
 [
  69,
  "bayburt",
  "Bayburt",
  "karadeniz",
  "small"
 ],
 [
  70,
  "karaman",
  "Karaman",
  "ic-anadolu",
  "small"
 ],
 [
  71,
  "kirikkale",
  "Kırıkkale",
  "ic-anadolu",
  "small"
 ],
 [
  72,
  "batman",
  "Batman",
  "guneydogu-anadolu",
  "mid"
 ],
 [
  73,
  "sirnak",
  "Şırnak",
  "guneydogu-anadolu",
  "small"
 ],
 [
  74,
  "bartin",
  "Bartın",
  "karadeniz",
  "small"
 ],
 [
  75,
  "ardahan",
  "Ardahan",
  "dogu-anadolu",
  "small"
 ],
 [
  76,
  "igdir",
  "Iğdır",
  "dogu-anadolu",
  "small"
 ],
 [
  77,
  "yalova",
  "Yalova",
  "marmara",
  "small"
 ],
 [
  78,
  "karabuk",
  "Karabük",
  "karadeniz",
  "small"
 ],
 [
  79,
  "kilis",
  "Kilis",
  "guneydogu-anadolu",
  "small"
 ],
 [
  80,
  "osmaniye",
  "Osmaniye",
  "akdeniz",
  "mid"
 ],
 [
  81,
  "duzce",
  "Düzce",
  "karadeniz",
  "mid"
 ]
];
const LEGACY_BALANCE={
 "istanbul": {
  "weight": 18,
  "cost": 1.35,
  "wage": 1.18,
  "housing": 1.55,
  "jobs": 1.24,
  "university": 1.2
 },
 "ankara": {
  "weight": 8,
  "cost": 1.12,
  "wage": 1.08,
  "housing": 1.15,
  "jobs": 1.1,
  "university": 1.18
 },
 "izmir": {
  "weight": 7,
  "cost": 1.18,
  "wage": 1.05,
  "housing": 1.22,
  "jobs": 1.06,
  "university": 1.12
 },
 "bursa": {
  "weight": 6,
  "cost": 1.02,
  "wage": 1.04,
  "housing": 1,
  "jobs": 1.1,
  "university": 1.02
 },
 "antalya": {
  "weight": 5,
  "cost": 1.12,
  "wage": 1,
  "housing": 1.18,
  "jobs": 1.02,
  "university": 0.98
 },
 "adana": {
  "weight": 4,
  "cost": 0.9,
  "wage": 0.92,
  "housing": 0.84,
  "jobs": 0.94,
  "university": 0.96
 },
 "konya": {
  "weight": 4,
  "cost": 0.86,
  "wage": 0.93,
  "housing": 0.8,
  "jobs": 0.96,
  "university": 0.98
 },
 "gaziantep": {
  "weight": 4,
  "cost": 0.9,
  "wage": 0.95,
  "housing": 0.83,
  "jobs": 1,
  "university": 0.92
 },
 "mersin": {
  "weight": 4,
  "cost": 0.94,
  "wage": 0.94,
  "housing": 0.9,
  "jobs": 0.94,
  "university": 0.94
 },
 "eskisehir": {
  "weight": 3,
  "cost": 0.95,
  "wage": 0.91,
  "housing": 0.92,
  "jobs": 0.9,
  "university": 1.15
 },
 "samsun": {
  "weight": 3,
  "cost": 0.88,
  "wage": 0.91,
  "housing": 0.84,
  "jobs": 0.9,
  "university": 0.96
 },
 "kayseri": {
  "weight": 3,
  "cost": 0.86,
  "wage": 0.94,
  "housing": 0.8,
  "jobs": 0.98,
  "university": 0.94
 },
 "diyarbakir": {
  "weight": 3,
  "cost": 0.84,
  "wage": 0.89,
  "housing": 0.76,
  "jobs": 0.86,
  "university": 0.92
 },
 "trabzon": {
  "weight": 2,
  "cost": 0.92,
  "wage": 0.9,
  "housing": 0.88,
  "jobs": 0.88,
  "university": 0.96
 }
};

export const TURKEY_CITIES=Object.freeze(PROVINCES.map(([plate,id,name,region,scale])=>{
 const population2025=PROVINCE_POPULATION_2025[id];
 if(!Number.isSafeInteger(population2025)||population2025<=0)throw new Error('Missing 2025 province population: '+id);
 return Object.freeze({
  id,name,plate,region,regionName:TURKEY_REGIONS[region],scale,
  population2025,populationYear:POPULATION_YEAR,
  weight:populationBirthWeight(population2025),
  ...calibratedGameProfile(id,scale,population2025),
  ...(LEGACY_BALANCE[id]??{}),
  // Old birth weights were synthetic scale bands; population weights replace them.
  weight:populationBirthWeight(population2025),
  calibration:LEGACY_BALANCE[id]?'legacy-economic-population-birth':'population-game-v2'
 });
}));

const CITY_INDEX=new Map(TURKEY_CITIES.map(city=>[city.id,city]));
const PLATE_INDEX=new Map(TURKEY_CITIES.map(city=>[city.plate,city]));
const NAME_INDEX=new Map(TURKEY_CITIES.map(city=>[city.name.toLocaleLowerCase('tr-TR'),city]));

export function cityById(id){
 return CITY_INDEX.get(id)??TURKEY_CITIES.find(city=>city.id==='istanbul');
}
export function cityByPlate(plate){
 return PLATE_INDEX.get(Number(plate))??null;
}
export function cityByName(name){
 return NAME_INDEX.get(String(name??'').trim().toLocaleLowerCase('tr-TR'))??null;
}
export function pickBirthCity(rng){
 return rng.weighted(TURKEY_CITIES.map(city=>({value:city,weight:city.weight})));
}
export function locationProfile(state){
 return cityById(state.location?.cityId??state.origin?.cityId??'istanbul');
}
