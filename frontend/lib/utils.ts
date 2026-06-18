export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function truncateHex(value: string, head = 6, tail = 4) {
  if (!value || value.length <= head + tail + 2) return value;
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`;
}