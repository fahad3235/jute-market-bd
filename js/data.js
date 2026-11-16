'use strict';
// jute-market-bd -- empty-state factory. Ships EMPTY: no sample or demo data.
// A plot: {id, name, areaDecimals, variety, sowingDate,
//           harvests:[{id,date,greenKg,fibreKg}],
//           sales:[{id,buyer,date,qtyKg,pricePerKg}],
//           expenses:[{id,category,date,amount}]}
function JUTE_emptyState() {
  return { app: 'jute-market-bd', lang: 'en', plots: [] };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { emptyState: JUTE_emptyState };
if (typeof window !== 'undefined') window.JUTE_emptyState = JUTE_emptyState;
