const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function createId(prefix = ""): string {
  const random = new Uint8Array(12);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(random);
  } else {
    for (let i = 0; i < random.length; i++) random[i] = Math.floor(Math.random() * 256);
  }

  let out = "";
  for (let i = 0; i < random.length; i++) {
    out += ALPHABET.charAt((random[i] ?? 0) % ALPHABET.length);
  }

  const timePart = Date.now().toString(36);
  return prefix ? `${prefix}_${timePart}${out}` : `${timePart}${out}`;
}
