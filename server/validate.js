// Input helpers shared by the API functions.
export const clean = (v, max = 500) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE = /^[+()\-.\s\d]{6,25}$/;
export const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
export const readJson = (req) => req.json().catch(() => ({}));
