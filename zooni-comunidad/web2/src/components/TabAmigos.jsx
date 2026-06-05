import React, { useEffect, useState } from 'react'
import { fetchAmigos } from '../api'

export default function TabAmigos({ onVerEnMapa }) {
  const [amigos,  setAmigos]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAmigos().then(d => setAmigos(d.amigos||[])).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if (loading) return <p className="vacio">Cargando…</p>
  if (!amigos.length) return <div className="vacio"><span className="vacio-ico">👥</span>No tenés amigos agregados aún</div>

  return (
    <div>
      {amigos.map(a => (
        <div key={a.usuario_id} className="lista-item">
          <div className={`avatar${a.online?' av-online':''}`}>👤</div>
          <div className="item-info">
            <p className="item-nombre">{a.nombre}</p>
            <p className="item-sub">{a.mascota_nombre||'Sin mascota'}{a.distancia_km!=null?`  ·  ${a.distancia_km} km`:''}</p>
          </div>
          <button className="btn-ver" onClick={() => onVerEnMapa(a)}>Ver en mapa</button>
        </div>
      ))}
    </div>
  )
}
