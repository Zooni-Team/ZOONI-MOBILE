import React from 'react'

export default function PopupServicio({ s, onClose }) {
  const url = s.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
  return (
    <div className="popup-wrap">
      <div className="popup-header">
        <span className="popup-nombre">{s.nombre}</span>
        <button className="popup-cerrar" onClick={onClose}>✕</button>
      </div>
      <p className="popup-tipo">{s.tipo?.charAt(0).toUpperCase() + s.tipo?.slice(1)}</p>
      {s.direccion   && <p className="popup-row">📍 {s.direccion}</p>}
      {s.telefono    && <p className="popup-row">📞 {s.telefono}</p>}
      {s.descripcion && <p className="popup-row">🔬 {s.descripcion}</p>}
      <button className="btn-maps" onClick={() => window.open(url, '_blank')}>
        Ver en Google Maps
      </button>
    </div>
  )
}
