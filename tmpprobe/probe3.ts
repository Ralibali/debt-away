import { REFERENCE_LOANS as L, SNAPSHOT_DATE } from "@/lib/seed-portfolio";
import { simulate } from "@/lib/payoff";
const r=simulate(L,0,"avalanche",SNAPSHOT_DATE);
console.log(r.schedule.filter((_,i)=>i%5===0).map(s=>[s.month,s.paid,s.totalBalance]));
console.log(r.perLoan.map(p=>[p.name,p.payoffMonth]));
