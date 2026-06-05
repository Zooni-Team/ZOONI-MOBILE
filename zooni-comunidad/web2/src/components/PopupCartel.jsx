import React, { useState } from 'react'
import { eliminarCartel } from '../api'

const LABELS = { perdida:'Mascota Perdida', encontrada:'Mascota Encontrada', adopcion:'En Adopción', aviso_general:'Aviso General' }

export default function PopupCartel({ c, userId, onClose, onEliminado }) {
  const [verMas, setVerMas] = useState(false)
  const desc  = c.descripcion || ''
  const corta = desc.length > 120 ? desc.slice(0,120)+'…' : desc
  const fecha = c.created_at ? new Date(c.created_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}) : ''
  const color = c.tipo === 'perdida' ? '#E63946' : '#6B6B6B'

  const handleEliminar = async () => {
    if (!window.confirm('¿Eliminar este cartel? Esta acción no se puede deshacer.')) return
    try { await eliminarCartel(c.id); onEliminado(c.id); onClose() }
    catch { alert('No se pudo eliminar el cartel') }
  }

  return (
    <div className="popup-wrap">
      <div className="popup-header">
        <span className="popup-nombre">
          <span className="badge-tipo" style={{ background: color }} />
          {LABELS[c.tipo] || c.tipo}
        </span>
        <button className="popup-cerrar" onClick={onClose}>✕</button>
      </div>
      {c.mascota_nombre && <p style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>🐾 {c.mascota_nombre}</p>}
      {c.mascota_especie && <p className="popup-row">{c.mascota_especie}{c.mascota_raza ? ` — ${c.mascota_raza}` : ''}</p>}
      {desc && <>
        <p className="popup-row">{verMas ? desc : corta}</p>
        {desc.length > 120 && <button className="ver-mas-btn" onClick={() => setVerMas(v=>!v)}>{verMas?'Ver menos':'Ver más'}</button>}
      </>}
      {c.telefono_contacto && <p className="popup-row">📞 {c.telefono_contacto}</p>}
      <p className="popup-meta">Publicado por: {c.publicado_por} · {fecha}</p>
      {parseInt(c.usuario_id) === userId && (
        <button className="btn-eliminar" onClick={handleEliminar}>🗑️ Eliminar Cartel</button>
      )}
    </div>
  )
}
