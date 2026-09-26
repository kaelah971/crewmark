// Typed district data for P2 territory claims. Deterministic rewards —
// the ONLY numbers the claim flow may award. Keep lore shallow on purpose.

export type DistrictId = "port-vice" | "vice-beach" | "little-leonida";

export type DistrictStatus = "NEUTRAL" | "NULL SAINTS";

export interface District {
  id: DistrictId;
  name: string;
  status: DistrictStatus;
  repReward: number;
  heatRisk: number;
  territoryGain: number;
  blurb: string;
}

export const DISTRICTS: readonly District[] = [
  {
    id: "port-vice",
    name: "Port Vice",
    status: "NEUTRAL",
    repReward: 12,
    heatRisk: 3,
    territoryGain: 12,
    blurb: "Docks and container rows. Nobody watches the freight.",
  },
  {
    id: "vice-beach",
    name: "Vice Beach",
    status: "NULL SAINTS",
    repReward: 24,
    heatRisk: 15,
    territoryGain: 18,
    blurb: "Rival-held boardwalk. Loud walls, louder consequences.",
  },
  {
    id: "little-leonida",
    name: "Little Leonida",
    status: "NEUTRAL",
    repReward: 18,
    heatRisk: 7,
    territoryGain: 15,
    blurb: "Corner stores and shutter rows. Hungry for a new name.",
  },
];

export function getDistrict(id: DistrictId): District {
  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) {
    throw new Error(`[crewmark] Unknown district id: ${id}`);
  }
  return district;
}
