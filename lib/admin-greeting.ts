export function getAdminGreeting(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 'Selamat datang, Bloomora.';
  if (hour >= 4 && hour < 11) return 'Selamat pagi, Bloomora.';
  if (hour >= 11 && hour < 15) return 'Selamat siang, Bloomora.';
  if (hour >= 15 && hour < 19) return 'Selamat sore, Bloomora.';
  return 'Selamat malam, Bloomora.';
}
