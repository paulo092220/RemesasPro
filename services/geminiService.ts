
export const fetchElToqueRates = async (): Promise<{ ratesInCUP: Record<string, number>, sources: any[] }> => {
  // Service disabled: User requested 100% manual rates.
  return { ratesInCUP: {}, sources: [] };
};
