export function calculateCompetitionGrowth({
    startingBalance,
    currentBalance,
    deposits,
    withdrawals,
}: {
    startingBalance: number;
    currentBalance: number;
    deposits: number;
    withdrawals: number;
}) {
    if (startingBalance <= 0) {
        return { adjustedProfit: 0, growthPercentage: 0 };
    }

    const adjustedProfit = currentBalance - startingBalance - deposits + withdrawals;
    const growthPercentage = (adjustedProfit / startingBalance) * 100;

    return {
        adjustedProfit: Number(adjustedProfit.toFixed(2)),
        growthPercentage: Number(growthPercentage.toFixed(6)),
    };
}
