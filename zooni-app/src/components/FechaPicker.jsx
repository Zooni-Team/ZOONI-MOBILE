import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { Columna, rs as fp } from './RuedaSeleccion';
import { MESES } from '../utils/fechaLocal';
import { capitalizar } from '../utils/texto';

function toClave(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function FechaPicker({
  visible, titulo, valor, onConfirmar, onCancelar,
  aniosAtras = 20, aniosAdelante = 0, sinFuturo = false,
}) {
  const hoy = new Date();
  const hoyAnio = hoy.getFullYear();
  const hoyMes  = hoy.getMonth() + 1;
  const hoyDia  = hoy.getDate();
  const adelante = sinFuturo ? 0 : aniosAdelante;

  const inicial = valor ?? hoy;
  const [dia,  setDia]  = useState(inicial.getDate());
  const [mes,  setMes]  = useState(inicial.getMonth() + 1);
  const [anio, setAnio] = useState(inicial.getFullYear());
  const [centrarToken, setCentrarToken] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const v = valor ?? new Date();
    setDia(v.getDate());
    setMes(v.getMonth() + 1);
    setAnio(v.getFullYear());
    setCentrarToken((t) => t + 1);
  }, [visible, valor ? toClave(valor) : null]);

  const diasEnMes = new Date(anio, mes, 0).getDate();

  const enAnioTope = sinFuturo && anio === hoyAnio;
  const enMesTope  = enAnioTope && mes === hoyMes;
  const mesMaximo  = enAnioTope ? hoyMes : 12;
  const diaMaximo  = enMesTope ? hoyDia : diasEnMes;

  useEffect(() => {
    if (dia > diaMaximo) setDia(diaMaximo);
  }, [dia, diaMaximo]);

  useEffect(() => {
    if (mes > mesMaximo) setMes(mesMaximo);
  }, [mes, mesMaximo]);

  const opcionesDia = Array.from({ length: diaMaximo }, (_, i) => ({
    valor: i + 1, texto: String(i + 1).padStart(2, '0'),
  }));
  const opcionesMes = MESES.slice(0, mesMaximo).map((m, i) => ({ valor: i + 1, texto: capitalizar(m) }));
  const opcionesAnio = Array.from(
    { length: aniosAtras + adelante + 1 },
    (_, i) => {
      const a = hoyAnio + adelante - i;
      return { valor: a, texto: String(a) };
    },
  );

  const confirmar = () => {
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
