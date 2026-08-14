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
  aniosAtras = 20, aniosAdelante = 0,
}) {
  const hoy = new Date();
  const hoyAnio = hoy.getFullYear();

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

  // Si se pasa de un mes largo a uno corto (31 de marzo → febrero), el día
  // elegido dejaría de existir y ninguna opción quedaría marcada.
  useEffect(() => {
    if (dia > diasEnMes) setDia(diasEnMes);
  }, [dia, diasEnMes]);

  const opcionesDia = Array.from({ length: diasEnMes }, (_, i) => ({
    valor: i + 1, texto: String(i + 1).padStart(2, '0'),
  }));
  const opcionesMes = MESES.map((m, i) => ({ valor: i + 1, texto: m }));
  // Del más reciente al más viejo: lo habitual es elegir una fecha cercana
  const opcionesAnio = Array.from(
    { length: aniosAtras + aniosAdelante + 1 },
    (_, i) => {
      const a = hoyAnio + aniosAdelante - i;
      return { valor: a, texto: String(a) };
    },
  );

  const confirmar = () => onConfirmar(new Date(anio, mes - 1, Math.min(dia, diasEnMes)));

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
