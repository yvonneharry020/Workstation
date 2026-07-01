const ID_MAP: Record<string, number> = {
  'Abia': 1,
  'Adamawa': 2,
  'Akwa Ibom': 3,
  'Anambra': 4,
  'Bauchi': 5,
  'Bayelsa': 6,
  'Benue': 7,
  'Borno': 8,
  'Cross River': 9,
  'Delta': 10,
  'Ebonyi': 11,
  'Edo': 12,
  'Ekiti': 13,
  'Enugu': 14,
  'FCT (Abuja)': 15,
  'Federal Capital Territory': 15,
  'Gombe': 16,
  'Imo': 17,
  'Jigawa': 18,
  'Kaduna': 19,
  'Kano': 20,
  'Katsina': 21,
  'Kebbi': 22,
  'Kogi': 23,
  'Kwara': 24,
  'Lagos': 25,
  'Nasarawa': 26,
  'Niger': 27,
  'Ogun': 28,
  'Ondo': 29,
  'Osun': 30,
  'Oyo': 31,
  'Plateau': 32,
  'Rivers': 33,
  'Sokoto': 34,
  'Taraba': 35,
  'Yobe': 36,
  'Zamfara': 37,
}

const NAME_MAP: Record<number, string> = {
  1: 'Abia', 2: 'Adamawa', 3: 'Akwa Ibom', 4: 'Anambra', 5: 'Bauchi',
  6: 'Bayelsa', 7: 'Benue', 8: 'Borno', 9: 'Cross River', 10: 'Delta',
  11: 'Ebonyi', 12: 'Edo', 13: 'Ekiti', 14: 'Enugu', 15: 'FCT (Abuja)',
  16: 'Gombe', 17: 'Imo', 18: 'Jigawa', 19: 'Kaduna', 20: 'Kano',
  21: 'Katsina', 22: 'Kebbi', 23: 'Kogi', 24: 'Kwara', 25: 'Lagos',
  26: 'Nasarawa', 27: 'Niger', 28: 'Ogun', 29: 'Ondo', 30: 'Osun',
  31: 'Oyo', 32: 'Plateau', 33: 'Rivers', 34: 'Sokoto', 35: 'Taraba',
  36: 'Yobe', 37: 'Zamfara',
}

export function stateNameToId(name: string): number | null {
  return ID_MAP[name] ?? null
}

export function stateIdToName(id: number): string | null {
  return NAME_MAP[id] ?? null
}
