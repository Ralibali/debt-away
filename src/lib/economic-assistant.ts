export interface HumanBudgetAllocation {
  saving: number;
  extraDebt: number;
  everyday: number;
  everydayPerDay: number;
}

export function allocateHumanBudget(
  monthlySurplus: number,
  bufferValue: number,
  bufferTarget: number,
): HumanBudgetAllocation {
  const surplus = Math.max(0, Math.round(monthlySurplus));
  if (surplus === 0) return { saving: 0, extraDebt: 0, everyday: 0, everydayPerDay: 0 };

  const bufferRatio = bufferTarget > 0 ? bufferValue / bufferTarget : 1;
  let savingShare = 0.4;
  let debtShare = 0.4;
  let everydayShare = 0.2;

  if (bufferRatio < 0.5) {
    savingShare = 0.65;
    debtShare = 0.2;
    everydayShare = 0.15;
  } else if (bufferRatio < 1) {
    savingShare = 0.5;
    debtShare = 0.3;
    everydayShare = 0.2;
  }

  const saving = Math.round(surplus * savingShare);
  const everyday = Math.round(surplus * everydayShare);
  const extraDebt = Math.max(0, surplus - saving - everyday);
  void debtShare;

  return {
    saving,
    extraDebt,
    everyday,
    everydayPerDay: Math.round((everyday / 30.4) * 10) / 10,
  };
}
