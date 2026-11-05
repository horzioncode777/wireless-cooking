import jwt from 'jsonwebtoken';

export function sessionResult(user) {
  const { id_usuario, nombre, apellido, correo, telefono, direccion, foto, rol, estado } = user;
  return {
    ok: true, message: 'Inicio de sesión exitoso',
    token: jwt.sign({ id_usuario, correo, rol, version: user.token_version || 0, purpose: 'session' }, process.env.JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' }),
    user: { id_usuario, nombre, apellido, correo, telefono, direccion, foto, rol, estado },
  };
}
