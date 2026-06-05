import React, { useEffect, useState } from 'react'
import { fetchSolicitudes, responderSolicitud } from '../api'

export default function TabSolicitudes({ onRespuesta }) {
  const [lista,   setLista]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSolicitudes().then(d=>setLista(d.solicitudes||[])).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  const responder = async (id, accion) => {
    try {
      await responderSolicitud(id, accion)
      setLista(prev => prev.filter(s => s.id !== id))
      if (accion === 'aceptar' && onRespuesta) onRespuesta()
    } catch {}
  }

  if (loading) return <p className="vacio">Cargando…</p>
  if (!lista.length) return <div className="vacio"><span className="vacio-ico">🔔</span>No tenés solicitudes pendientes</div>

  return (
    <div>
      {lista.map(s => (
        <div key={s.id} className="lista-item">
          <div className="avatar">👤</div>
          <div className="item-info"><p className="item-nombre">{s.nombre}</p></div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn-ac" onClick={() => responder(s.id,'aceptar')} aria-label="Aceptar">✓</button>
            <button className="btn-re" onClick={() => responder(s.id,'rechazar')} aria-label="Rechazar">✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
