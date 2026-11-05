// Domain tests use synthetic sessions only after checking database isolation.
import jwt from 'jsonwebtoken';

const checked = new WeakSet();
export async function fixtureToken(db, user) {
  if (!checked.has(db)) {
    const schema = (await db.query('SELECT current_schema() AS name')).rows[0].name;
    if (!schema.startsWith('test_')) throw new Error('Session fixtures require an isolated test schema');
    checked.add(db);
  }
  const account = (await db.query('SELECT token_version FROM usuarios WHERE id_usuario=$1', [user.id_usuario])).rows[0];
  if (!account) throw new Error('Missing fixture account');
  return jwt.sign({ id_usuario: user.id_usuario, version: account.token_version, purpose: 'session' }, process.env.JWT_SECRET, { expiresIn: '1h', algorithm:'HS256' });
}
