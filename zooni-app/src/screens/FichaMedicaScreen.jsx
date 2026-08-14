/**
 * FichaMedicaScreen.jsx — Pantalla "Ficha Médica" de Zooni
 *
 * Sin dependencias externas más allá de las ya instaladas en el proyecto.
 * Navegación: desde Home con { petId } o { mascotaId }.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// Import estático: el import() dinámico no es confiable con Metro (el
// bundler de Expo) para este tipo de caso. Solo se USA en la rama web
// (generarPdfWeb) — en nativo, expo-print ya genera el PDF real sin este
// problema, así que esta librería nunca llega a ejecutarse ahí.
import jsPDF from 'jspdf';

import { calcularEdad } from '../utils/calcularEdad';
import { parseFechaLocal, toISODateLocal } from '../utils/fechaLocal';
import { resolveMascotaVisual } from '../constants/petImages';
import SkeletonLoader from '../components/SkeletonLoader';
import HamburgerDrawer from '../components/HamburgerDrawer';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import {
  fetchMascota, actualizarPeso, actualizarRaza, actualizarFechaNacimiento,
  fetchVacunas, fetchTratamientos, fetchHistorialPeso, fetchConsultas,
} from '../services/fichaMedicaApi';
import { fetchRazas } from '../services/authApi';
import OpcionPicker from '../components/OpcionPicker';
import FechaPicker from '../components/FechaPicker';
import { formatearPeso, pesoValido, textoRangoPeso } from '../constants/pesoPorEspecie';
import { imagenADataUri } from '../utils/imagenBase64';

// ─── DATOS DEMO (sin backend conectado — mismos datos que Vacunas/Tratamientos) ──

const DEMO_MASCOTA = {
  id: 1, nombre: 'Titán', especie: 'perro',
  raza: 'Labrador Retriever', peso: 20.40,
  fecha_nacimiento: '2022-02-15', imagen_asset: 'perro_default',
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

/** PetIllustration — Imagen de la mascota, sin sombra (evita el artefacto rectangular). */
function PetIllustration({ source, label }) {
  return (
    <Image
      source={source}
      style={s.heroImg}
      resizeMode="contain"
      accessibilityLabel={label}
    />
  );
}

function FilaDato({ icono, label, valor, onEditar, editando, children }) {
  return (
    <View style={s.dataCard}>
      <View style={s.dataRow}>
        <View style={s.dataLeft}>
          <Ionicons name={icono} size={18} color="#2DBD72" />
          <Text style={s.dataLabel}>{label}</Text>
        </View>
        <View style={s.dataRight}>
          {editando ? children : (
            <>
              <Text style={s.dataValor}>{valor}</Text>
              {onEditar && (
                <TouchableOpacity onPress={onEditar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={16} color="#6B6B6B" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function BotonNav({ icono, iconoColor, texto, onPress }) {
  return (
    <TouchableOpacity style={s.navCard} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icono} size={20} color={iconoColor} />
      <Text style={s.navTexto}>{texto}</Text>
      <Text style={s.navFlecha}>›</Text>
    </TouchableOpacity>
  );
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function FichaMedicaScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId ?? route.params?.mascotaId;

  const [mascota,        setMascota]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [editandoPeso,   setEditandoPeso]   = useState(false);
  const [pesoBorrador,   setPesoBorrador]   = useState('');
  const [guardandoPeso,  setGuardandoPeso]  = useState(false);
  const [showRazaPicker,   setShowRazaPicker]   = useState(false);
  const [razasDisponibles, setRazasDisponibles] = useState([]);
  const [cargandoRazas,    setCargandoRazas]    = useState(false);
  const [guardandoRaza,    setGuardandoRaza]    = useState(false);
  const [editandoFecha,  setEditandoFecha]  = useState(false);
  const [fechaBorrador,  setFechaBorrador]  = useState(new Date());
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [generandoPdf,   setGenerandoPdf]   = useState(false);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [historialVisible,  setHistorialVisible]  = useState(false);
  const [historialPeso,     setHistorialPeso]     = useState(null); // null = no cargado aún
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const { usuario, mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();

  const pesoInputRef = useRef(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  // Timeout de 3 segundos: si el backend no responde, mostrar la vista demo
  // en vez de dejar al usuario esperando (mismo patrón que HomeScreen).
  const cargarMascota = useCallback(async (silencioso = false) => {
    if (!petId) { setLoading(false); return; }
    if (!silencioso) setLoading(true);
    try {
      const data = await fetchMascota(petId);
      if (!data) {
        Alert.alert('No encontrada', 'La mascota no existe.', [{ text: 'Volver', onPress: () => navigation.goBack() }]);
      } else {
        setMascota(data);
      }
    } catch {
      Alert.alert('Error de conexión', 'No se pudo cargar la ficha médica.');
    } finally {
      setLoading(false);
    }
  }, [petId, navigation]);

  useEffect(() => { cargarMascota(); }, [cargarMascota]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarMascota(true);
    if (historialPeso !== null) await cargarHistorial();
    setRefreshing(false);
  };

  // ── Historial de peso ─────────────────────────────────────────────────────
  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try { setHistorialPeso(await fetchHistorialPeso(petId)); }
    catch { setHistorialPeso([]); }
    finally { setCargandoHistorial(false); }
  };

  const toggleHistorial = async () => {
    if (historialVisible) { setHistorialVisible(false); return; }
    setHistorialVisible(true);
    if (historialPeso === null) await cargarHistorial();
  };

  // ── Peso ──────────────────────────────────────────────────────────────────
  const abrirEditPeso = () => {
    setPesoBorrador(mascota.peso != null ? String(mascota.peso).replace('.', ',') : '');
    setEditandoPeso(true);
    setTimeout(() => pesoInputRef.current?.focus(), 100);
  };

  const confirmarPeso = async () => {
    const n = parseFloat(pesoBorrador.replace(',', '.'));
    // El rango sale de la especie: 0–500 kg aceptaba cualquier cosa para un
    // hámster y encima chocaba con el CHECK de la base.
    if (isNaN(n) || !pesoValido(n, mascota?.especie)) {
      Alert.alert('Valor inválido', `Ingresá un peso entre ${textoRangoPeso(mascota?.especie)}.`);
      return;
    }
    setGuardandoPeso(true);
    try {
      const actualizada = await actualizarPeso(petId, n);
      setMascota((p) => ({ ...p, peso: actualizada.peso }));
      setEditandoPeso(false);
      // Si el historial ya está a la vista, sumarle el registro nuevo
      if (historialPeso !== null) cargarHistorial();
    } catch { Alert.alert('Error', 'No se pudo actualizar el peso.'); }
    finally { setGuardandoPeso(false); }
  };

  // ── Raza — mismo picker que en el registro, no texto libre ─────────────────
  const abrirEditRaza = async () => {
    setShowRazaPicker(true);
    setCargandoRazas(true);
    try {
      const { razas } = await fetchRazas(mascota.especie);
      setRazasDisponibles(razas.length ? razas : [{ id: null, nombre: 'Sin raza definida' }]);
    } catch {
      setRazasDisponibles([{ id: null, nombre: 'Sin raza definida' }]);
    } finally {
      setCargandoRazas(false);
    }
  };

  const seleccionarRaza = async (opcion) => {
    setShowRazaPicker(false);
    setGuardandoRaza(true);
    try {
      const actualizada = await actualizarRaza(petId, opcion.nombre);
      setMascota((p) => ({ ...p, raza: actualizada.raza }));
    } catch { Alert.alert('Error', 'No se pudo actualizar la raza.'); }
    finally { setGuardandoRaza(false); }
  };

  // ── Fecha ─────────────────────────────────────────────────────────────────
  const abrirEditFecha = () => {
    setFechaBorrador(parseFechaLocal(mascota.fecha_nacimiento) ?? new Date());
    setEditandoFecha(true);
  };

  const confirmarFecha = async (fecha) => {
    setEditandoFecha(false);
    setGuardandoFecha(true);
    const iso = toISODateLocal(fecha);
    try {
      const actualizada = await actualizarFechaNacimiento(petId, iso);
      setMascota((p) => ({ ...p, fecha_nacimiento: actualizada.fecha_nacimiento }));
    } catch { Alert.alert('Error', 'No se pudo actualizar la fecha de nacimiento.'); }
    finally { setGuardandoFecha(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Debajo del kilo se muestra en gramos ("120 g" y no "0,12 kg")
  const formatPeso = (p) => (p == null ? 'Sin registrar' : formatearPeso(p));

  const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  const formatFecha = (iso) => {
    if (!iso) return null;
    const [y, mo, d] = iso.split('-').map(Number);
    return `${d}/${mo}/${y}`;
  };

  // Timestamp completo (historial_peso.fecha) → "5/7/2026"
  const formatFechaCorta = (ts) => {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  // Se genera localmente con los datos ya disponibles, sin depender de un
  // backend que hoy no existe. Solo lo esencial: especie, raza, edad, peso,
  // vacunas y tratamientos aplicados (sin datos del propietario).
  const construirHtmlFicha = (vacunasAplicadas, tratamientosAplicados, consultas, fotoDataUri) => {
    const fechaGeneracion = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Todo lo que viene de la base se escapa: un nombre con "<" rompía el HTML
    // y, en el peor caso, permitía inyectar marcado en el documento.
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const tarjeta = (label, valor) => `
      <div class="dato">
        <div class="dato-label">${esc(label)}</div>
        <div class="dato-valor">${esc(valor)}</div>
      </div>`;

    const item = (titulo, chip, lineas) => `
      <div class="item">
        <div class="item-top">
          <span class="item-titulo">${esc(titulo)}</span>
          ${chip ? `<span class="chip">${esc(chip)}</span>` : ''}
        </div>
        ${lineas.filter(Boolean).map((l) => `<div class="item-linea">${esc(l)}</div>`).join('')}
      </div>`;

    const seccion = (titulo, cantidad, contenido, vacio) => `
      <div class="seccion">
        <div class="seccion-titulo">
          ${esc(titulo)}${cantidad ? `<span class="contador">${cantidad}</span>` : ''}
        </div>
        ${cantidad ? contenido : `<div class="vacio">${esc(vacio)}</div>`}
      </div>`;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            @page { margin: 0; }
            body { font-family: Helvetica, Arial, sans-serif; margin: 0; color: #2C2C2C; }

            /* Encabezado con la foto de la mascota */
            .header {
              background-color: #2DBD72; padding: 28px 40px; color: #FFFFFF;
              display: flex; align-items: center;
            }
            .foto {
              width: 96px; height: 96px; border-radius: 48px; object-fit: cover;
              border: 4px solid rgba(255,255,255,0.85); background-color: #C8F0D8;
              margin-right: 22px; flex-shrink: 0;
            }
            .header-txt { flex: 1; }
            .header .nombre { margin: 0; font-size: 30px; font-weight: bold; letter-spacing: 0.3px; }
            .header .sub { margin: 6px 0 0; font-size: 14px; opacity: 0.95; }
            .header .doc { margin: 10px 0 0; font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85; }

            .container { padding: 26px 40px 32px; }

            /* Datos principales en tarjetas, no en una tabla de dos columnas */
            .datos { display: flex; flex-wrap: wrap; margin: 0 -6px 8px; }
            .dato {
              width: 25%; padding: 0 6px 12px;
            }
            .dato-label {
              font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase;
              color: #9A9A9A; margin-bottom: 3px;
            }
            .dato-valor { font-size: 14px; font-weight: bold; color: #2C2C2C; }

            .seccion { margin-top: 22px; page-break-inside: auto; }
            .seccion-titulo {
              font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;
              color: #2DBD72; border-bottom: 2px solid #E4F5EB;
              padding-bottom: 6px; margin-bottom: 10px;
            }
            .contador {
              display: inline-block; margin-left: 8px; background-color: #E4F5EB; color: #177046;
              border-radius: 8px; padding: 1px 7px; font-size: 10px; letter-spacing: 0;
            }

            .item {
              border-left: 3px solid #E4F5EB; padding: 7px 0 7px 12px; margin-bottom: 8px;
              page-break-inside: avoid;
            }
            .item-top { margin-bottom: 2px; }
            .item-titulo { font-size: 13px; font-weight: bold; color: #2C2C2C; }
            .chip {
              float: right; font-size: 10px; font-weight: bold; color: #6B6B6B;
              background-color: #F4F4F4; border-radius: 8px; padding: 2px 8px;
            }
            .item-linea { font-size: 11px; color: #6B6B6B; line-height: 1.55; }

            .vacio {
              font-size: 12px; color: #AAAAAA; font-style: italic;
              background-color: #FAFAFA; border-radius: 8px; padding: 10px 12px;
            }

            .footer {
              margin-top: 34px; padding-top: 14px; border-top: 1px solid #EFEFEF;
              font-size: 10px; color: #AAAAAA; text-align: center; line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${fotoDataUri ? `<img class="foto" src="${fotoDataUri}" />` : ''}
            <div class="header-txt">
              <p class="nombre">${esc(m.nombre)}</p>
              <p class="sub">${esc([capitalizar(m.especie), m.raza, edad].filter(Boolean).join(' · '))}</p>
              <p class="doc">Ficha médica digital</p>
            </div>
          </div>

          <div class="container">
            <div class="datos">
              ${tarjeta('Especie', capitalizar(m.especie) || '—')}
              ${tarjeta('Raza', m.raza || 'Sin especificar')}
              ${tarjeta('Edad', edad)}
              ${tarjeta('Peso', formatPeso(m.peso))}
            </div>

            ${seccion('Vacunas aplicadas', vacunasAplicadas.length,
              vacunasAplicadas.map((v) => item(
                v.nombre,
                v.tipo,
                [
                  `Aplicada: ${formatFecha(v.fecha_aplicacion) ?? '—'}`,
                  v.proximo_refuerzo ? `Próximo refuerzo: ${formatFecha(v.proximo_refuerzo)}` : null,
                  v.veterinaria ? `Aplicada por: ${v.veterinaria}` : null,
                  v.descripcion || null,
                ],
              )).join(''),
              'Sin vacunas registradas')}

            ${seccion('Tratamientos', tratamientosAplicados.length,
              tratamientosAplicados.map((t) => item(
                t.nombre,
                null,
                [
                  `Inicio: ${formatFecha(t.fecha_inicio) ?? '—'}`,
                  t.proximo_control ? `Próximo control: ${formatFecha(t.proximo_control)}` : null,
                  t.veterinaria ? `Veterinaria: ${t.veterinaria}` : null,
                  t.descripcion || null,
                ],
              )).join(''),
              'Sin tratamientos registrados')}

            ${seccion('Consultas veterinarias', consultas.length,
              consultas.map((c) => item(
                c.motivo,
                formatFecha(c.fecha) ?? '—',
                [
                  c.veterinario ? `Veterinario/a: ${c.veterinario}` : null,
                  c.notas || null,
                ],
              )).join(''),
              'Sin consultas registradas')}

            <div class="footer">
              Documento generado el ${esc(fechaGeneracion)}<br />
              Zooni — Cuidado inteligente para tu mascota
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Descarga real en web: expo-print en el navegador ignora el HTML que le
  // pasás y solo hace window.print() de la pantalla actual (por eso antes se
  // imprimía toda la app) — para bajar un archivo de verdad hace falta
  // generar el PDF nosotros mismos con jsPDF.
  const generarPdfWeb = (vacunasAplicadas, tratamientosAplicados, consultas, fotoDataUri) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ANCHO = doc.internal.pageSize.getWidth();
    const ALTO  = doc.internal.pageSize.getHeight();
    const M = 16;                    // margen lateral
    const LIMITE = ALTO - 20;        // desde acá, página nueva
    let y = 0;

    const VERDE  = [45, 189, 114];
    const TEXTO  = [44, 44, 44];
    const SUAVE  = [107, 107, 107];
    const TENUE  = [154, 154, 154];

    // Antes el `y` crecía sin control: con muchas vacunas, todo lo que pasaba
    // del alto de la hoja simplemente no se dibujaba.
    const asegurarEspacio = (alto) => {
      if (y + alto <= LIMITE) return;
      doc.addPage();
      y = 18;
    };

    // ── Encabezado verde con la foto ──────────────────────────────────────
    const ALTO_HEADER = 42;
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, ANCHO, ALTO_HEADER, 'F');

    let xTexto = M;
    if (fotoDataUri) {
      const D = 26;
      const cx = M + D / 2;
      const cy = ALTO_HEADER / 2;
      // Aro blanco + foto recortada en círculo (jsPDF no tiene border-radius:
      // se usa un clip circular sobre el que se dibuja la imagen)
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, D / 2 + 1.4, 'F');
      doc.saveGraphicsState();
      doc.circle(cx, cy, D / 2).clip();
      doc.addImage(fotoDataUri, M, cy - D / 2, D, D, undefined, 'FAST');
      doc.restoreGraphicsState();
      xTexto = M + D + 8;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(22);
    doc.text(m.nombre ?? 'Mascota', xTexto, 20);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10.5);
    const subtitulo = [capitalizar(m.especie), m.raza, edad].filter(Boolean).join('  ·  ');
    doc.text(subtitulo, xTexto, 27);

    doc.setFontSize(8);
    doc.text('FICHA MÉDICA DIGITAL', xTexto, 34);

    y = ALTO_HEADER + 12;

    // ── Datos principales en cuatro tarjetas ──────────────────────────────
    const datos = [
      ['ESPECIE', capitalizar(m.especie) || '—'],
      ['RAZA',    m.raza || 'Sin especificar'],
      ['EDAD',    edad],
      ['PESO',    formatPeso(m.peso)],
    ];
    const anchoCol = (ANCHO - M * 2) / datos.length;
    datos.forEach(([label, valor], i) => {
      const x = M + i * anchoCol;
      doc.setFontSize(6.8);
      doc.setTextColor(...TENUE);
      doc.setFont(undefined, 'normal');
      doc.text(label, x, y);
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXTO);
      doc.setFont(undefined, 'bold');
      // El texto se recorta al ancho de la columna para que no se pise con la
      // de al lado (una raza larga se comía la siguiente)
      doc.text(doc.splitTextToSize(String(valor), anchoCol - 4)[0], x, y + 5);
    });
    y += 16;

    // ── Secciones ─────────────────────────────────────────────────────────
    const tituloSeccion = (titulo, cantidad) => {
      asegurarEspacio(16);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...VERDE);
      doc.text(`${titulo.toUpperCase()}${cantidad ? `  (${cantidad})` : ''}`, M, y);
      y += 2.5;
      doc.setDrawColor(228, 245, 235);
      doc.setLineWidth(0.6);
      doc.line(M, y, ANCHO - M, y);
      y += 6;
    };

    const itemPdf = (titulo, chip, lineas) => {
      const visibles = lineas.filter(Boolean);
      // Se mide antes de dibujar para no partir un ítem entre dos páginas
      const envueltas = visibles.flatMap((l) => doc.splitTextToSize(l, ANCHO - M * 2 - 8));
      asegurarEspacio(7 + envueltas.length * 4.4);

      const yInicio = y;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...TEXTO);
      doc.text(titulo, M + 5, y);

      if (chip) {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...SUAVE);
        doc.text(chip, ANCHO - M, y, { align: 'right' });
      }
      y += 4.6;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(...SUAVE);
      envueltas.forEach((linea) => {
        doc.text(linea, M + 5, y);
        y += 4.4;
      });

      // Barra verde a la izquierda, como en la app
      doc.setDrawColor(228, 245, 235);
      doc.setLineWidth(1.2);
      doc.line(M + 1, yInicio - 3, M + 1, y - 2.5);
      y += 3;
    };

    const seccionVacia = (texto) => {
      asegurarEspacio(10);
      doc.setFont(undefined, 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...TENUE);
      doc.text(texto, M + 2, y);
      doc.setFont(undefined, 'normal');
      y += 8;
    };

    tituloSeccion('Vacunas aplicadas', vacunasAplicadas.length);
    if (!vacunasAplicadas.length) seccionVacia('Sin vacunas registradas');
    vacunasAplicadas.forEach((v) => itemPdf(v.nombre, v.tipo, [
      `Aplicada: ${formatFecha(v.fecha_aplicacion) ?? '—'}`,
      v.proximo_refuerzo ? `Próximo refuerzo: ${formatFecha(v.proximo_refuerzo)}` : null,
      v.veterinaria ? `Aplicada por: ${v.veterinaria}` : null,
      v.descripcion || null,
    ]));

    y += 4;
    tituloSeccion('Tratamientos', tratamientosAplicados.length);
    if (!tratamientosAplicados.length) seccionVacia('Sin tratamientos registrados');
    tratamientosAplicados.forEach((t) => itemPdf(t.nombre, null, [
      `Inicio: ${formatFecha(t.fecha_inicio) ?? '—'}`,
      t.proximo_control ? `Próximo control: ${formatFecha(t.proximo_control)}` : null,
      t.veterinaria ? `Veterinaria: ${t.veterinaria}` : null,
      t.descripcion || null,
    ]));

    y += 4;
    tituloSeccion('Consultas veterinarias', consultas.length);
    if (!consultas.length) seccionVacia('Sin consultas registradas');
    consultas.forEach((c) => itemPdf(c.motivo, formatFecha(c.fecha) ?? '—', [
      c.veterinario ? `Veterinario/a: ${c.veterinario}` : null,
      c.notas || null,
    ]));

    // ── Pie en todas las páginas ──────────────────────────────────────────
    const fechaGeneracion = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TENUE);
      doc.text(`Generado el ${fechaGeneracion} · Zooni`, M, ALTO - 10);
      doc.text(`${p} / ${paginas}`, ANCHO - M, ALTO - 10, { align: 'right' });
    }

    doc.save(`Ficha-medica-${(m.nombre ?? 'mascota').replace(/\s+/g, '-')}.pdf`);
  };

  const generarPDF = async () => {
    setGenerandoPdf(true);
    try {
      // Consultas best-effort: si la migración 016 no está corrida, el PDF
      // sale igual con vacunas y tratamientos.
      const [{ aplicadas: vacunasAplicadas }, { aplicados: tratamientosAplicados }, consultas] = petId
        ? await Promise.all([fetchVacunas(petId), fetchTratamientos(petId), fetchConsultas(petId).catch(() => [])])
        : [{ aplicadas: [] }, { aplicados: [] }, []];

      // La foto va incrustada en base64: ni expo-print ni jsPDF esperan a que
      // baje una URL remota. Si falla, el PDF sale igual pero sin foto.
      const fotoDataUri = await imagenADataUri(petImg);

      if (Platform.OS === 'web') {
        generarPdfWeb(vacunasAplicadas, tratamientosAplicados, consultas, fotoDataUri);
      } else {
        const html = construirHtmlFicha(vacunasAplicadas, tratamientosAplicados, consultas, fotoDataUri);
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Ficha médica de ${m.nombre}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF generado', `El archivo se guardó en:\n${uri}`);
        }
      }
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Sin petId o error sin mascota (una vez terminada la carga): pantalla demo visual
  const demoMascota = !loading && (!petId || !mascota);
  const interactuable = !loading && !demoMascota;
  const m = mascota ?? DEMO_MASCOTA;
  const edad = calcularEdad(m.fecha_nacimiento);
  const petImg = resolveMascotaVisual(m);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={s.screenBackground}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={s.headerBtn} accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={30} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={['#2DBD72']} tintColor="#2DBD72" />
          }>

          {/* Hero */}
          <View style={s.heroSection}>
            {loading ? (
              <SkeletonLoader width={140} height={30} borderRadius={8} style={{ marginBottom: 12 }} />
            ) : (
              <Text style={s.heroNombre}>{m.nombre}</Text>
            )}
            {loading ? (
              <SkeletonLoader width={110} height={110} borderRadius={20} />
            ) : (
              <PetIllustration source={petImg} label={`Ilustración de ${m.nombre}`} />
            )}
          </View>

        {/* Card blanco */}
        <View style={s.whiteCard}>

          {demoMascota && (
            <View style={s.demoBanner}>
              <Ionicons name="alert-circle-outline" size={14} color="#F5A623" />
              <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
            </View>
          )}

          <Text style={s.secTitulo}>Datos</Text>

          <FilaDato icono="paw-outline"     label="Especie:" valor={capitalizar(m.especie)} />

          <FilaDato icono="pricetag-outline" label="Raza:"
            valor={guardandoRaza ? 'Actualizando...' : (m.raza || 'Sin especificar')}
            onEditar={interactuable ? abrirEditRaza : undefined} editando={false} />

          <FilaDato icono="barbell-outline" label="Peso:" valor={formatPeso(m.peso)}
            onEditar={interactuable ? abrirEditPeso : undefined} editando={editandoPeso}>
            <View style={s.editRow}>
              <TextInput ref={pesoInputRef} style={s.editInput} value={pesoBorrador}
                onChangeText={setPesoBorrador} keyboardType="decimal-pad"
                placeholder="Ej: 20,5" placeholderTextColor="#AAAAAA" />
              <Text style={s.editUnidad}>kg</Text>
              {guardandoPeso
                ? <ActivityIndicator size="small" color="#2DBD72" style={{ marginLeft: 6 }} />
                : <>
                    <TouchableOpacity onPress={confirmarPeso} style={s.btnOk}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditandoPeso(false)} style={s.btnCancel}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </>
              }
            </View>
          </FilaDato>

          {/* Historial de peso — desplegable, se guarda un punto por cada edición */}
          {interactuable && (
            <>
              <TouchableOpacity style={s.histToggle} onPress={toggleHistorial}
                accessibilityLabel={historialVisible ? 'Ocultar historial de peso' : 'Ver historial de peso'}>
                <Ionicons name={historialVisible ? 'chevron-up' : 'chevron-down'} size={14} color="#2DBD72" />
                <Text style={s.histToggleTxt}>
                  {historialVisible ? 'Ocultar historial de peso' : 'Ver historial de peso'}
                </Text>
              </TouchableOpacity>

              {historialVisible && (
                <View style={s.histCard}>
                  {cargandoHistorial ? (
                    <ActivityIndicator size="small" color="#2DBD72" style={{ paddingVertical: 12 }} />
                  ) : !historialPeso?.length ? (
                    <Text style={s.histEmpty}>
                      Todavía no hay registros — se guarda uno cada vez que actualizás el peso.
                    </Text>
                  ) : (
                    historialPeso.map((h, i) => {
                      const anterior = historialPeso[i + 1];
                      const delta = anterior ? h.peso - anterior.peso : null;
                      return (
                        <View key={h.id} style={[s.histRow, i === historialPeso.length - 1 && s.histRowLast]}>
                          <Text style={s.histFecha}>{formatFechaCorta(h.fecha)}</Text>
                          <Text style={s.histPeso}>{formatPeso(h.peso)}</Text>
                          <Text style={[
                            s.histDelta,
                            delta > 0 && s.histDeltaUp,
                            delta < 0 && s.histDeltaDown,
                          ]}>
                            {delta == null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </>
          )}

          <FilaDato icono="gift-outline" label="Edad:"
            valor={guardandoFecha ? 'Actualizando...' : edad}
            onEditar={interactuable ? abrirEditFecha : undefined}
            editando={false} />

          <FechaPicker visible={editandoFecha} titulo="Fecha de nacimiento"
            valor={fechaBorrador} aniosAtras={30}
            onConfirmar={confirmarFecha} onCancelar={() => setEditandoFecha(false)} />

          <OpcionPicker
            visible={showRazaPicker}
            titulo="Raza"
            opciones={razasDisponibles}
            valor={m.raza}
            cargando={cargandoRazas}
            onSeleccionar={seleccionarRaza}
            onCerrar={() => setShowRazaPicker(false)}
          />

          <Text style={[s.secTitulo, { marginTop: 24 }]}>Secciones</Text>

          <BotonNav icono="hardware-chip-outline" iconoColor="#2DBD72" texto="Virtual Vet"
            onPress={() => navigation.navigate('VirtualVet', { petId })} />
          <BotonNav icono="medical-outline"       iconoColor="#2DBD72" texto="Vacunas"
            onPress={() => navigation.navigate('Vacunas', { petId: petId ?? 0 })} />
          <BotonNav icono="medkit-outline"        iconoColor="#E63946" texto="Tratamientos"
            onPress={() => navigation.navigate('Tratamientos', { petId: petId ?? 0 })} />
          <BotonNav icono="clipboard-outline"     iconoColor="#5BC8D0" texto="Consultas veterinarias"
            onPress={() => navigation.navigate('Consultas', { petId: petId ?? 0 })} />
          <BotonNav icono="bulb-outline"          iconoColor="#F5C842" texto="Consejos y curiosidades"
            onPress={() => navigation.navigate('Consejos', { petId: petId ?? 0 })} />

          <TouchableOpacity style={s.pdfBtn} onPress={generarPDF} disabled={generandoPdf || loading}
            accessibilityLabel="Descargar ficha médica en PDF">
            {generandoPdf
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="document-text-outline" size={18} color="#FFF" />
            }
            <Text style={s.pdfBtnTxt}>{generandoPdf ? 'Generando...' : 'Descargar PDF'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
      </View>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascota ?? mascotaActivaDemo}
        activeRoute="FichaMedica"
      />
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: '#C8F0D8' },
  screenBackground: { flex: 1, width: '100%', backgroundColor: '#C8F0D8' },
  scroll:      { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn:   { width: 36, alignItems: 'center', justifyContent: 'center' },

  heroSection:  { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  heroNombre:   { fontSize: 24, fontWeight: '800', color: '#2C2C2C', marginBottom: 12, zIndex: 2 },
  bubble:       { backgroundColor: '#2DBD72' },
  heroPetShadow: {
    shadowColor: '#1a7a45',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  heroImg:      { width: 110, height: 110 },

  whiteCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, marginTop: 16 },

  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16 },
  demoBannerTxt: { fontSize: 12, color: '#F5A623', textAlign: 'center' },

  secTitulo: { fontSize: 13, fontWeight: '700', color: '#6B6B6B', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  dataCard:  { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  dataRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dataIcon:  { fontSize: 18 },
  dataLabel: { fontSize: 14, color: '#6B6B6B' },
  dataValor: { fontSize: 15, fontWeight: '600', color: '#2C2C2C', textAlign: 'right', flexShrink: 1 },
  editIcon:  { fontSize: 16 },

  editRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editInput:   { borderWidth: 1.5, borderColor: '#2DBD72', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 14, color: '#2C2C2C', minWidth: 60, textAlign: 'center' },
  editUnidad:  { fontSize: 13, color: '#6B6B6B' },
  btnOk:       { backgroundColor: '#2DBD72', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  btnCancel:   { backgroundColor: '#AAAAAA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },

  navCard:   { backgroundColor: '#FFF', borderRadius: 16, height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  navTexto:  { flex: 1, fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  navFlecha: { fontSize: 22, color: '#AAAAAA', lineHeight: 26 },

  pdfBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2DBD72', borderRadius: 30, height: 48, width: '65%', alignSelf: 'center', marginTop: 28, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  pdfBtnTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Historial de peso (desplegable bajo la fila Peso)
  histToggle:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, marginTop: -4, marginBottom: 8 },
  histToggleTxt: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },
  histCard:      { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  histRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  histRowLast:   { borderBottomWidth: 0 },
  histFecha:     { flex: 1, fontSize: 13, color: '#6B6B6B' },
  histPeso:      { fontSize: 14, fontWeight: '600', color: '#2C2C2C', marginRight: 12 },
  histDelta:     { fontSize: 12, fontWeight: '700', color: '#AAAAAA', width: 64, textAlign: 'right' },
  histDeltaUp:   { color: '#F5A623' },
  histDeltaDown: { color: '#5BC8D0' },
  histEmpty:     { fontSize: 12, color: '#9A9A9A', textAlign: 'center', paddingVertical: 12, lineHeight: 18 },
});
