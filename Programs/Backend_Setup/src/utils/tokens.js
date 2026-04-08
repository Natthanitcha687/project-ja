import jwt from "jsonwebtoken";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 48);

export function signJwt(payload, secret = process.env.JWT_SECRET, options = { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }) {
  return jwt.sign(payload, secret, options);
}

export function verifyJwt(token, secret = process.env.JWT_SECRET) {
  return jwt.verify(token, secret);
}

export function newRandomToken() {
  return nanoid(); // 48-char url-safe token
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
