const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(addressKey: string) {
  const normalized = addressKey.toLowerCase();
  const material = encoder.encode(normalized);
  const hashed = await crypto.subtle.digest('SHA-256', material);

  return crypto.subtle.importKey('raw', hashed, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptContent(content: string, addressKey: string) {
  const key = await deriveKey(addressKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(content));

  const buffer = new Uint8Array(iv.length + ciphertext.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...buffer));
}

export async function decryptContent(payload: string, addressKey: string) {
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const cipherBytes = bytes.slice(12);

  const key = await deriveKey(addressKey);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);

  return decoder.decode(plain);
}
