// Seeded demo users. Passwords live as plaintext in the mock fixture so the seed
// stays editable after client feedback; on boot we bcrypt-hash each one into memory
// so the login route always compares against a hash (never the plaintext).
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mockDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'mock');
const seed = JSON.parse(readFileSync(path.join(mockDir, 'users.json'), 'utf8'));

// id -> { ...user fields, passwordHash } (plaintext password is dropped here)
const usersById = new Map();
const emailIndex = new Map();

for (const u of seed) {
  const { password, ...rest } = u;
  const record = { ...rest, passwordHash: bcrypt.hashSync(password, 10) };
  usersById.set(u.id, record);
  emailIndex.set(u.email.toLowerCase(), record);
}

export const findByEmail = (email) =>
  email ? emailIndex.get(String(email).trim().toLowerCase()) : undefined;

export const findById = (id) => usersById.get(id);

export const verifyPassword = (user, password) =>
  !!user && bcrypt.compareSync(String(password ?? ''), user.passwordHash);

// Shape returned to the client / embedded in responses — never includes the hash.
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  pb: user.pb,
  department: user.department
});
