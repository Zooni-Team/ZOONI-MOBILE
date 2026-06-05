import React, { useState } from 'react'
import { crearCartel } from '../api'

const TIPOS = [
  { v: 'perdida',       l: '🔴 Mascota Perdida'    },
  { v: 'encontrada',    l: '🟢 Mascota Encontrada' },
  { v: 'adopcion',      l: '💛 En Adopción'        },
  { v: 'aviso_general', l: '📌 Aviso General'      },
]

export default function FormularioCartel({ coordenadas, onExito, onCancelar }) {
  const [tipo,    setTipo]    = useState('perdida')
  const [desc,    setDesc]    = useState('')
  const [tel,     setTel]     = useState('')
  const [foto,    setFoto]    = useState(null)
  const [errTel,  setErrTel]  = useState('')
  const [loading, setLoading] = useState(false)

  const validar = (v) => {
    const ok = /^[+]?[\d\s\-()\\.]{7,20}$/.test(v.trim())
    setErrTel(ok ? '' : 'Formato inválido. Ej: +54 11 1234-5678')
    return ok
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!tel.trim()) { setErrTel('El teléfono de contacto es requerido'); return }
    if (!validar(tel)) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('descripcion', desc)
      fd.append('telefono_contacto', tel.trim())
      fd.append('lat', String(coordenadas.lat))
      fd.append('lng', String(coordenadas.lng))
      if (foto) fd.append('foto', foto)
      const data = await crearCartel(fd)
      onExito(data.cartel)
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al crear el cartel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-bd">
      <form className="modal-box" onSubmit={submit}>
        <p className="form-tit">🚨 Crear Cartel de Mascota</p>

        <label className="form-lbl">Tipo</label>
        <div className="tipos-row">
          {TIPOS.map(t => (
            <button key={t.v} type="button"
              className={`tipo-opt${tipo === t.v ? ' on' : ''}`}
              onClick={() => setTipo(t.v)}>{t.l}
            </button>
          ))}
        </div>

        <label className="form-lbl">Descripción</label>
        <textarea className="form-inp form-textarea"
          placeholder="Características, última vez vista..."
          value={desc} onChange={e => setDesc(e.target.value)} maxLength={300} />

        <label className="form-lbl">Teléfono de Contacto *</label>
        <input className={`form-inp${errTel ? ' err' : ''}`} type="tel"
          placeholder="Ej. +54 11 1234-5678" value={tel}
          onChange={e => { setTel(e.target.value); if (errTel) validar(e.target.value) }} />
        {errTel && <p className="form-err">{errTel}</p>}

        <label className="form-lbl">Foto (opcional)</label>
        <label className="foto-lbl">
          {foto ? `📷 ${foto.name}` : 'Seleccionar foto'}
          <input type="file" accept=".jpg,.jpeg,.png,.gif" style={{ display:'none' }}
            onChange={e => setFoto(e.target.files[0] || null)} />
        </label>
        <p className="form-hint">JPG, PNG, GIF · Máx 5MB</p>

        <div className="btns-form">
          <button type="button" className="btn-cancel" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="btn-crear" disabled={loading}>
            {loading ? 'Creando…' : 'Crear Cartel'}
          </button>
        </div>
      </form>
    </div>
  )
}
