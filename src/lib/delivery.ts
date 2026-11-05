export type Coordinates = { latitude: number | null; longitude: number | null };

export function validCoordinates(point: Coordinates): point is { latitude: number; longitude: number } {
  return point.latitude !== null && point.longitude !== null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function straightLineKm(origin: Coordinates, destination: Coordinates): number | null {
  if (!validCoordinates(origin) || !validCoordinates(destination)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(destination.latitude - origin.latitude) / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(radians(destination.longitude - origin.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function deliveryCharge(distance: number): number | null {
  if (!Number.isFinite(distance) || distance < 0 || distance > 10) return null;
  return distance <= 3 ? 30 : distance <= 6 ? 40 : 60;
}

export function deliveryQuote(origin: Coordinates, destination: Coordinates) {
  const distance = straightLineKm(origin, destination);
  return { distance, charge: distance === null ? null : deliveryCharge(distance) };
}