// Game-tuned genetics parameters. These are simulation values, not medical prevalence estimates.
export const MONOGENIC_CONDITIONS=[
 {
  id:'beta_thalassemia',
  label:'Beta talasemi',
  inheritance:'autosomal_recessive',
  variantFrequency:.035,
  manifestMinAge:1,
  annualManifestChance:.90,
  severity:3
 },
 {
  id:'fmf',
  label:'Ailesel Akdeniz Ateşi',
  inheritance:'autosomal_recessive',
  variantFrequency:.045,
  manifestMinAge:5,
  annualManifestChance:.24,
  severity:2
 },
 {
  id:'familial_hypercholesterolemia',
  label:'Ailesel hiperkolesterolemi',
  inheritance:'autosomal_dominant',
  variantFrequency:.004,
  manifestMinAge:12,
  annualManifestChance:.18,
  severity:2
 }
];

export const POLYGENIC_TRAITS=[
 {id:'hypertension',baseMin:20,baseMax:80},
 {id:'metabolic',baseMin:20,baseMax:80},
 {id:'cardiac',baseMin:20,baseMax:80}
];
