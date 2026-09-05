/**
 * FechaPicker.jsx — Selector de fecha (día / mes / año) en un modal propio
 *
 * @react-native-community/datetimepicker no está instalado, así que la app usa
 * este picker de tres columnas. Estaba copiado y pegado en Vacunas,
 * Tratamientos, Consultas, Ficha Médica y Calendario con variantes mínimas (el
 * rango de años); acá queda uno solo, parametrizable, para que todas las
 * pantallas se vean y se comporten igual.
 *
 * Las tres columnas se abren CENTRADAS en el valor elegido (hoy, si el campo
 * está vacío): así el día anterior y el siguiente quedan a la vista y restar un
 * día es un toque, en vez de tener que scrollear desde el 01.
 *
 * Props:
 *   visible, titulo, valor (Date), onConfirmar(Date), onCancelar
 *   aniosAtras   — cuántos años hacia atrás ofrece la lista (default 20)
 *   aniosAdelante— cuántos hacia adelante (default 0; Tratamientos usa 5)
 *   sinFuturo    — no deja elegir una fecha posterior a HOY (default false)
 *
 * Sobre `sinFuturo`: con `aniosAdelante = 0` la lista de años ya terminaba en el
 * actual, pero DENTRO del año en curso se podía elegir cualquier mes y día — se
 * cargaba "5 de diciembre de 2026" como fecha de nacimiento y la mascota
 * quedaba con "-1 años y 9 meses". Con esto, el mes se corta en el mes actual y
 * el día en el de hoy, y el tope se mueve solo: mañana el máximo va a ser
 * mañana, sin tocar nada.
 */

import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { Columna, rs as fp } from './RuedaSeleccion';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Date → "2026-8-14": identifica el día sin depender del objeto Date. */
function toClave(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── PICKER ───────────────────────────────────────────────────────────────────

export default function FechaPicker({
  visible, titulo, valor, onConfirmar, onCancelar,
  aniosAtras = 20, aniosAdelante = 0, sinFuturo = false,
}) {
  const hoy = new Date();
  const hoyAnio = hoy.getFullYear();
  const hoyMes  = hoy.getMonth() + 1;
  const hoyDia  = hoy.getDate();
  // Con `sinFuturo` no tiene sentido ofrecer años hacia adelante.
  const adelante = sinFuturo ? 0 : aniosAdelante;

  const inicial = valor ?? hoy;
  const [dia,  setDia]  = useState(inicial.getDate());
  const [mes,  setMes]  = useState(inicial.getMonth() + 1);
  const [anio, setAnio] = useState(inicial.getFullYear());
  // Se incrementa en cada apertura para avisarle a las columnas que vuelvan a
  // centrarse (mientras el picker está abierto NO se toca, así el scroll del
  // usuario no se pisa).
  const [centrarToken, setCentrarToken] = useState(0);

  /*
    Cada vez que se ABRE, el picker vuelve a la fecha que corresponde: la
    guardada si el campo ya tiene una, o el día de HOY si está vacío.

    Antes el efecto solo corría `if (valor)`, así que con el campo vacío
    quedaban los números de la última vez que se abrió (o los del montaje, que
    podían ser de días atrás si la app quedó abierta) — de ahí que apareciera
    "una fecha cualquiera". Se calcula `hoy` en el momento de abrir, no al
    montar la pantalla, para que a la medianoche también sea el día correcto.
  */
  useEffect(() => {
    if (!visible) return;
    const v = valor ?? new Date();
    setDia(v.getDate());
    setMes(v.getMonth() + 1);
    setAnio(v.getFullYear());
    setCentrarToken((t) => t + 1);
    // `valor` se compara por día calendario y no por identidad: los llamadores
    // pasan `formFecha ?? new Date()`, que es un objeto nuevo en cada render y
    // reiniciaría la selección del usuario en pleno uso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, valor ? toClave(valor) : null]);

  const diasEnMes = new Date(anio, mes, 0).getDate();

  // Topes del día de hoy: solo recortan el mes/día en curso, así que el límite
  // se corre solo con el paso de los días.
  const enAnioTope = sinFuturo && anio === hoyAnio;
  const enMesTope  = enAnioTope && mes === hoyMes;
  const mesMaximo  = enAnioTope ? hoyMes : 12;
  const diaMaximo  = enMesTope ? hoyDia : diasEnMes;

  // Si se pasa de un mes largo a uno corto (31 de marzo → febrero), el día
  // elegido dejaría de existir y ninguna opción quedaría marcada. Lo mismo si
  // se vuelve al año actual teniendo elegido un mes/día que ya sería futuro.
  useEffect(() => {
    if (dia > diaMaximo) setDia(diaMaximo);
  }, [dia, diaMaximo]);

  useEffect(() => {
    if (mes > mesMaximo) setMes(mesMaximo);
  }, [mes, mesMaximo]);

  const opcionesDia = Array.from({ length: diaMaximo }, (_, i) => ({
    valor: i + 1, texto: String(i + 1).padStart(2, '0'),
  }));
  const opcionesMes = MESES.slice(0, mesMaximo).map((m, i) => ({ valor: i + 1, texto: m }));
  // Del más reciente al más viejo: lo habitual es elegir una fecha cercana
  const opcionesAnio = Array.from(
    { length: aniosAtras + adelante + 1 },
    (_, i) => {
      const a = hoyAnio + adelante - i;
      return { valor: a, texto: String(a) };
    },
  );

  const confirmar = () => {
    // Última red: aunque el estado se recorta arriba, esto garantiza que jamás
    // salga de acá una fecha futura cuando el llamador pidió `sinFuturo`.
    const d = new Date(anio, mes - 1, Math.min(dia, diasEnMes));
    onConfirmar(sinFuturo && d > hoy ? hoy : d);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={fp.overlay}>
        <View style={fp.container}>
          <Text style={fp.titulo}>{titulo}</Text>
          <View style={fp.row}>
            <Columna label="Día"  opciones={opcionesDia}  valor={dia}
              onSelect={setDia}  centrarToken={centrarToken} />
            <Columna label="Mes"  opciones={opcionesMes}  valor={mes}
              onSelect={setMes}  centrarToken={centrarToken} flex={2} />
            <Columna label="Año"  opciones={opcionesAnio} valor={anio}
              onSelect={setAnio} centrarToken={centrarToken} />
          </View>
          <View style={fp.btns}>
            <TouchableOpacity style={fp.btnCancel} onPress={onCancelar}>
              <Text style={fp.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fp.btnOk} onPress={confirmar}>
              <Text style={fp.btnOkTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
