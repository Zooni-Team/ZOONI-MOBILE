import { colores } from '../../theme/colores';

export const CENTRO_MAPA = { lat: -34.6189, lng: -58.4380 };

export const MAPA_COMUNIDAD_HTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%}
.mk{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;
    justify-content:center;border:2px solid #fff;font-size:16px;
    box-shadow:0 1px 4px rgba(0,0,0,.3);line-height:34px;text-align:center}
.pz{width:46px;height:46px;border-radius:50%;border:3px solid ${colores.verde};background:${colores.verde};
    position:relative;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.35);
    display:flex;align-items:center;justify-content:center}
.pz img{position:absolute;top:0;left:0;width:100%!important;height:100%!important;
    max-width:none!important;max-height:none!important;object-fit:cover;object-position:center;
    border-radius:50%}
.pz.off{border-color:#9AA5A0}
.uw{width:44px;height:44px;display:flex;align-items:center;justify-content:center;position:relative}
.up{position:absolute;width:34px;height:34px;border-radius:50%;
    background:rgba(33,150,243,.25);animation:pu 1.8s ease-in-out infinite}
.ud{width:16px;height:16px;border-radius:50%;background:#2196F3;
    border:2.5px solid #fff;position:relative}
@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.55)}}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
(function(){
  var map = L.map('map',{zoomControl:false,doubleClickZoom:false}).setView([-34.6089,-58.4340],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);

  var PATA='<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><circle cx="5" cy="9.5" r="2.2"/><circle cx="9" cy="5.5" r="2.2"/><circle cx="15" cy="5.5" r="2.2"/><circle cx="19" cy="9.5" r="2.2"/><path d="M12 10.5c-3 0-6.5 4.6-6.5 7.3 0 1.8 1.4 2.7 3 2.7 1.4 0 2.3-.8 3.5-.8s2.1.8 3.5.8c1.6 0 3-.9 3-2.7 0-2.7-3.5-7.3-6.5-7.3z"/></svg>';
  function iconPaseador(x){
    var foto=(typeof x.foto==='string'&&/^(https?:|data:image)/.test(x.foto))
      ?'<img src="'+x.foto.replace(/"/g,'%22')+'" alt="" referrerpolicy="no-referrer" onerror="this.remove()"/>':'';
    return L.divIcon({className:'',html:'<div class="pz'+(x.disponible?'':' off')+'">'+PATA+foto+'</div>',
      iconSize:[46,46],iconAnchor:[23,23]});
  }
  function mk(e,bg){return L.divIcon({className:'',html:'<div class="mk" style="background:'+bg+'">'+e+'</div>',iconSize:[34,34],iconAnchor:[17,34]})}
  var iconUser=L.divIcon({className:'',html:'<div class="uw"><div class="up"></div><div class="ud"></div></div>',iconSize:[44,44],iconAnchor:[22,22]});
  var ICONS={
    veterinaria:mk('🏥','${colores.rojo}'),paseador:mk('🦮','${colores.ambar}'),
    petshop:mk('🛍️','${colores.amarillo}'),peluqueria:mk('✂️','${colores.violeta}'),
    perdida:mk('🔴','${colores.rojo}'),aviso:mk('📌','${colores.textoSecundario}'),
    amigo:mk('👤','${colores.verde}'),temporal:mk('📍','${colores.verde}')
  };

  function notify(obj){
    try{ window.parent.postMessage({tipo:'zooni-evento',payload:obj},'*'); }catch(e){}
  }

  var userMarker=null, dynLayers=[], modoCartel=false;

  function setUserMarker(lat,lng){
    if(userMarker) map.removeLayer(userMarker);
    userMarker=L.marker([lat,lng],{icon:iconUser,zIndexOffset:1000}).addTo(map);
  }
  function clearDyn(){dynLayers.forEach(function(l){map.removeLayer(l)});dynLayers=[]}
  function renderData(d){
    clearDyn();
    (d.servicios||[]).forEach(function(x){
      var m=L.marker([x.lat,x.lng],{icon:ICONS[x.tipo]||mk('📍','#888')}).addTo(map)
              .on('click',function(){notify({type:'servicio',data:x})});
      dynLayers.push(m);
    });
    (d.carteles||[]).forEach(function(x){
      var m=L.marker([x.lat,x.lng],{icon:x.tipo==='perdida'?ICONS.perdida:ICONS.aviso}).addTo(map)
              .on('click',function(){notify({type:'cartel',data:x})});
      dynLayers.push(m);
    });
    (d.paseadores||[]).forEach(function(x){
      var abrir=function(){notify({type:'paseador',data:x})};
      var c=L.circle([x.lat,x.lng],{radius:x.radioKm*1000,color:'${colores.verde}',weight:2,
        fillColor:'${colores.verde}',fillOpacity:x.disponible?.12:.05,dashArray:x.disponible?null:'6 6'})
        .addTo(map).on('click',abrir);
      var m=L.marker([x.lat,x.lng],{icon:iconPaseador(x),zIndexOffset:500}).addTo(map).on('click',abrir);
      dynLayers.push(c);dynLayers.push(m);
    });
    (d.amigos||[]).forEach(function(x){
      if(x.lat&&x.lng){var m=L.marker([x.lat,x.lng],{icon:ICONS.amigo}).addTo(map);dynLayers.push(m)}
    });
    if(d.markerTemp){
      var t=d.markerTemp;
      var m=L.marker([t.latitude||t.lat,t.longitude||t.lng],{icon:ICONS.temporal}).addTo(map);
      dynLayers.push(m);
    }
  }

  var zooniMap = {
    flyTo: function(lat,lng){ map.flyTo([lat,lng],16,{duration:0.7}); },
    zoomIn: function(){ map.zoomIn(); },
    zoomOut: function(){ map.zoomOut(); },
    setData: function(d){ renderData(d); },
    setModoCartel: function(v){ modoCartel=v; },
    setUserLocation: function(lat,lng,centrar){
      if(centrar) map.flyTo([lat,lng],16,{duration:0.7});
      else map.setView([lat,lng],15);
      setUserMarker(lat,lng);
    },
    setUserMarker: function(lat,lng){ setUserMarker(lat,lng); }
  };
  window.addEventListener('message',function(e){
    if(e.source!==window.parent)return;
    var m=e.data;
    if(!m||m.tipo!=='zooni-cmd'||typeof zooniMap[m.metodo]!=='function')return;
    zooniMap[m.metodo].apply(null,m.args||[]);
  });

  map.on('click dblclick',function(e){
    if(modoCartel) notify({type:'dblclick',lat:e.latlng.lat,lng:e.latlng.lng});
  });
  function notifyBounds(){
    var b=map.getBounds();
    notify({type:'bounds',lat_min:b.getSouth(),lat_max:b.getNorth(),lng_min:b.getWest(),lng_max:b.getEast()});
  }
  map.on('moveend',notifyBounds);

  notify({type:'ready'});
  notifyBounds();
})();
</script>
</body></html>`;

export const MAPA_PASEO_HTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${colores.mentaSuave}}
.yo{width:44px;height:44px;display:flex;align-items:center;justify-content:center;position:relative}
.yo .pulso{position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(45,189,114,.25);animation:pu 1.8s ease-in-out infinite}
.yo .punto{width:18px;height:18px;border-radius:50%;background:${colores.verde};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);position:relative}
.casa{width:36px;height:36px;border-radius:50%;background:${colores.ambar};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 4px rgba(0,0,0,.3)}
@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.6)}}
.leaflet-control-attribution{font-size:9px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${CENTRO_MAPA.lat},${CENTRO_MAPA.lng}],15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  var iconYo=L.divIcon({className:'',html:'<div class="yo"><div class="pulso"></div><div class="punto"></div></div>',iconSize:[44,44],iconAnchor:[22,22]});
  var iconCasa=L.divIcon({className:'',html:'<div class="casa"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 3 2 11.5h3V21h5.5v-5.5h3V21H19v-9.5h3z"/></svg></div>',iconSize:[36,36],iconAnchor:[18,18]});
  var yo=null,casa=null,linea=null,primera=true;

  function set(d){
    if(d.interactivo===false){
      map.dragging.disable();map.touchZoom.disable();map.scrollWheelZoom.disable();map.doubleClickZoom.disable();
    }else{
      map.dragging.enable();map.touchZoom.enable();map.scrollWheelZoom.enable();
    }
    if(casa){map.removeLayer(casa);casa=null}
    if(d.destino){casa=L.marker([d.destino.lat,d.destino.lng],{icon:iconCasa}).addTo(map)}
    if(yo){map.removeLayer(yo);yo=null}
    if(d.posicion){yo=L.marker([d.posicion.lat,d.posicion.lng],{icon:iconYo,zIndexOffset:1000}).addTo(map)}
    if(linea){map.removeLayer(linea);linea=null}
    if(d.ruta&&d.ruta.length>1){
      linea=L.polyline(d.ruta.map(function(p){return[p.lat,p.lng]}),{color:'${colores.verde}',weight:6,opacity:.85,lineCap:'round'}).addTo(map);
    }
    var foco=d.posicion||d.destino||d.centro;
    if(primera&&d.posicion&&d.destino){
      map.fitBounds(L.latLngBounds([[d.posicion.lat,d.posicion.lng],[d.destino.lat,d.destino.lng]]).pad(0.4));
      primera=false;
    }else if(foco&&(primera||d.seguir)){
      map.setView([foco.lat,foco.lng],primera?16:map.getZoom(),{animate:!primera});
      primera=false;
    }
  }
  var api={
    set:set,
    centrar:function(lat,lng){map.flyTo([lat,lng],17,{duration:.6})}
  };
  window.addEventListener('message',function(e){
    if(e.source!==window.parent)return;
    var m=e.data;
    if(!m||m.tipo!=='zooni-cmd'||typeof api[m.metodo]!=='function')return;
    api[m.metodo].apply(null,m.args||[]);
  });
  try{window.parent.postMessage({tipo:'zooni-paseo-listo'},'*')}catch(e){}
})();
</script>
</body></html>`;

export const MAPA_ZONA_HTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${colores.mentaSuave}}
.centro{width:40px;height:40px;border-radius:50%;background:${colores.verde};border:3px solid #fff;
  display:flex;align-items:center;justify-content:center;font-size:18px;
  box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:grab}
.leaflet-control-attribution{font-size:9px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false}).setView([${CENTRO_MAPA.lat},${CENTRO_MAPA.lng}],14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  var icon=L.divIcon({className:'',html:'<div class="centro"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><circle cx="5" cy="9.5" r="2.2"/><circle cx="9" cy="5.5" r="2.2"/><circle cx="15" cy="5.5" r="2.2"/><circle cx="19" cy="9.5" r="2.2"/><path d="M12 10.5c-3 0-6.5 4.6-6.5 7.3 0 1.8 1.4 2.7 3 2.7 1.4 0 2.3-.8 3.5-.8s2.1.8 3.5.8c1.6 0 3-.9 3-2.7 0-2.7-3.5-7.3-6.5-7.3z"/></svg></div>',iconSize:[40,40],iconAnchor:[20,20]});
  var circulo=null, centro=null, radio=0;

  function avisar(){
    var p=centro.getLatLng();
    try{window.parent.postMessage({tipo:'zooni-zona-evento',payload:{lat:p.lat,lng:p.lng}},'*')}catch(e){}
  }
  function encuadrar(){
    if(radio>0) map.fitBounds(circulo.getBounds().pad(0.15),{animate:true});
    else map.setView(centro.getLatLng(),14,{animate:true});
  }
  function dibujar(lat,lng){
    if(!circulo){
      circulo=L.circle([lat,lng],{radius:radio,color:'${colores.verde}',weight:3,fillColor:'${colores.verde}',fillOpacity:.18}).addTo(map);
      centro=L.marker([lat,lng],{icon:icon,draggable:true,zIndexOffset:1000}).addTo(map);
      centro.on('drag',function(e){circulo.setLatLng(e.target.getLatLng())});
      centro.on('dragend',avisar);
      var arrastrando=false;
      circulo.on('mousedown touchstart',function(){arrastrando=true;map.dragging.disable()});
      map.on('mousemove',function(e){if(arrastrando){circulo.setLatLng(e.latlng);centro.setLatLng(e.latlng)}});
      map.on('mouseup',function(){if(arrastrando){arrastrando=false;map.dragging.enable();avisar()}});
    }else{
      circulo.setLatLng([lat,lng]);centro.setLatLng([lat,lng]);
    }
  }
  map.on('click',function(e){dibujar(e.latlng.lat,e.latlng.lng);avisar()});

  var api={
    set:function(d,mover){
      radio=d.radioKm>0?d.radioKm*1000:0;
      dibujar(d.lat,d.lng);
      circulo.setRadius(radio||1);
      circulo.setStyle(radio?{opacity:1,fillOpacity:.18}:{opacity:0,fillOpacity:0});
      if(mover) encuadrar();
    }
  };
  window.addEventListener('message',function(e){
    if(e.source!==window.parent)return;
    var m=e.data;
    if(!m||m.tipo!=='zooni-cmd'||typeof api[m.metodo]!=='function')return;
    api[m.metodo].apply(null,m.args||[]);
  });
  try{window.parent.postMessage({tipo:'zooni-zona-listo'},'*')}catch(e){}
})();
</script>
</body></html>`;
