// Convert ArrayBuffer to Base64URL string
export function arrayBufferToBase64URL(buffer) {
  if (!buffer) {
    console.error('Buffer is null or undefined');
    return null;
  }
  try {
    const bytes = new Uint8Array(buffer);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Error converting ArrayBuffer to base64URL:', error);
    throw error;
  }
}

// Convert Base64URL string to ArrayBuffer
export function base64URLToBuffer(base64URL) {
  if (!base64URL || typeof base64URL !== 'string') {
    console.error('Invalid base64URL:', base64URL);
    return new ArrayBuffer(0);
  }
  try {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(paddedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error('Error converting base64URL to buffer:', error);
    throw error;
  }
}
