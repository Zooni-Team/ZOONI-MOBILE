import React, { useState, useEffect, useRef } from 'react'
import { fetchServicios } from '../api'

const FILTROS = [{v:'todos',l:'Todos'},{v:'veterinaria',l:'Veterinaria'},{v:'paseador',l:'Paseador'},{v:'petshop',l:'Pet Shop'},{v:'peluqueria',l:'Peluquería'}]
const EMOJIS  = { veterinaria:'🏥', paseador:'🦮', petshop:'🛍️', peluqueria:'✂️' }
const COLORES = { veterinaria:'#E63946', paseador:'#F5A623', petshop:'#F5C842', peluqueria:'#9B59B6' }

export default function TabServicios({ bbox, onSeleccionar }) {
  const [lista,  setLista]  = useState([])
  const [filtro, setFiltro] = useState('todos')
  const t = useRef(null)

  useEffect(() => {
    clearTimeout(t.current)
    t.current = setTimeout(() => {
      if (!bbox) return
      fetchServicios(bbox, filtro).then(d => setLista(d.servicios||[])).catch(()=>{})
    }, 800)
    return () => clearTimeout(t.current)
  }, [bbox, filtro])

  return (
    <div>
      <div className="chips">
        {FILTROS.map(f => (
          <button key={f.v} className={`chip${filtro===f.v?' on':''}`} onClick={() => setFiltro(f.v)}>{f.l}</button>
        ))}
      </div>
      {!lista.length
        ? <p className="vacio" style={{paddingTop:12}}>No hay servicios en esta área</p>
        : lista.map(s => (
          <div key={s.id} className="lista-item" style={{cursor:'pointer'}} onClick={() => onSeleccionar(s)}>
            <div className="avatar" style={{background:COLORES[s.tipo]||'#888',border:'none',color:'#fff',fontSize:18}}>
              {EMOJIS[s.tipo]||'📍'}
            </div>
            <div className="item-info">
              <p className="item-nombre">{s.nombre}</p>
              <p className="item-sub">{s.direccion}</p>
            </div>
          </div>
        ))
      }
    </div>
  )
}
