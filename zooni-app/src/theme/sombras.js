import { colores } from './colores';

export const sombras = Object.freeze({
  tarjeta: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  }),
  suave: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  }),
  sutil: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  }),
  modal: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  }),
});
