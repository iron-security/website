import { Buffer } from 'buffer';

export async function SignBytes(secretKey, payload)
{
    if (!payload || payload.length == 0) {
        throw new Error('Cannot sign empty bytes');
    }

    if (!secretKey || secretKey.length < 32) {
        throw new Error('Secret key for signing needs to be at least 32 bytes, is ' + secretKey.length);
    }

    const secretKeyData = Buffer.from(secretKey, 'utf-8');
    const key = await crypto.subtle.importKey(
      "raw",
      secretKeyData.buffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      payload,
    );

    const buffer = Buffer.from(new Uint8Array(mac));
    const base64Mac = await buffer.toString('base64');
    
    return base64Mac.replace(/=+$/, '');
}