/**
 * HoraPicker.jsx — Selector de hora (hora / minuto) en un modal propio
 *
 * Lo usa CalendarioScreen después de elegir la fecha del evento.
 * Vivía dentro de CalendarioScreen.jsx compartiendo estilos con la copia local
 * de FechaPicker; al unificar los pickers en components/ se quedó sin ellos.
 * Ahora usa la misma rueda centrada que FechaPicker.
 *
 * Props: visible, valor (Date), onConfirmar(Date), onCancelar, titulo
 */

import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { Columna, rs } from './RuedaSeleccion';

// De a 5 minutos: para un turno del veterinario nadie necesita el minuto justo,
// y una lista de 60 opciones es incómoda de recorrer en el celular.
const PASO_MINUTOS = 5;

export default function HoraPicker({
  visible, valor, onConfirmar, onCancelar, titulo = 'Hora del evento',
}) {
  const ahora = new Date();
  const inicial = valor ?? ahora;

  const [hora,   setHora]   = useState(inicial.getHours());
  const [minuto, setMinuto] = useState(inicial.getMinutes());
  const [centrarToken, setCentrarToken] = useState(0);

  // Igual que FechaPicker: al abrir vuelve a la hora guardada, o a la de AHORA
  // si el evento todavía no tiene una.
  useEffect(() => {
    if (!visible) return;
    const v = valor ?? new Date();
    setHora(v.getHours());
    // Se ajusta al múltiplo de 5 más cercano para que quede una opción marcada
    setMinuto(Math.round(v.getMinutes() / PASO_MINUTOS) * PASO_MINUTOS % 60);
    setCentrarToken((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, valor ? `${valor.getHours()}:${valor.getMinutes()}` : null]);

  const opcionesHora = Array.from({ length: 24 }, (_, i) => ({
    valor: i, texto: String(i).padStart(2, '0'),
  }));
  const opcionesMinuto = Array.from({ length: 60 / PASO_MINUTOS }, (_, i) => {
    const m = i * PASO_MINUTOS;
    return { valor: m, texto: String(m).padStart(2, '0') };
  });

  const confirmar = () => {
    // Se conserva el DÍA que ya tenía el evento y solo se cambia la hora: antes
    // se armaba un `new Date()` desde cero y la fecha elegida se perdía.
    const d = valor ? new Date(valor) : new Date();
    d.setHours(hora, minuto, 0, 0);
    onConfirmar(d);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={rs.overlay}>
        <View style={rs.container}>
          <Text style={rs.titulo}>{titulo}</Text>
          <View style={rs.row}>
            <Columna label="Hora"   opciones={opcionesHora}   valor={hora}
              onSelect={setHora}   centrarToken={centrarToken} />
            <Columna label="Minuto" opciones={opcionesMinuto} valor={minuto}
              onSelect={setMinuto} centrarToken={centrarToken} />
          </View>
          <View style={rs.btns}>
            <TouchableOpacity style={rs.btnCancel} onPress={onCancelar}>
              <Text style={rs.btnCancelTxt}>Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rs.btnOk} onPress={confirmar}>
              <Text style={rs.btnOkTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
