export const SUICA_CAPACITY=10;
export const RING_CHARGE=1, SKILL_CHARGE=.2;
export function addSuicaCharge(s,amount,bonus=''){
 if(s.ended||s.guitar||s.train||s.trainPending)return false;
 s.chargeBonus=bonus;s.guitarCharge=Math.min(SUICA_CAPACITY,Math.round((s.guitarCharge+amount)*10)/10);
 if(s.guitarCharge>=SUICA_CAPACITY){s.trainPending=true;return true;}return false;
}
// Server-side upper bound includes every possible centre bonus and near miss.
export const possibleTrains=(rings,nearMisses)=>Math.floor((rings*(RING_CHARGE+SKILL_CHARGE)+nearMisses*SKILL_CHARGE+1e-8)/SUICA_CAPACITY);
