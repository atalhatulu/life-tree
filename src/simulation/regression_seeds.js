export const REGRESSION_SEEDS=[
 {id:'ci-audit-random-31',focus:'career-transition'},
 {id:'ci-audit-random-38',focus:'reemployment'},
 {id:'ci-audit-random-47',focus:'reemployment'},
 {id:'ci-audit-random-55',focus:'reemployment'},
 {id:'ci-audit-random-95',focus:'career-transition'},
 {id:'group1-divorce-seed',focus:'relationships'},
 {id:'group2-debt-seed',focus:'finance'},
 {id:'group3-health-seed',focus:'health'},
 {id:'group4-retraining-seed',focus:'career'},
 {id:'group5-branch-seed',focus:'branching'}
];

export function seedsForFocus(focus){
 return REGRESSION_SEEDS.filter(x=>x.focus===focus).map(x=>x.id);
}
