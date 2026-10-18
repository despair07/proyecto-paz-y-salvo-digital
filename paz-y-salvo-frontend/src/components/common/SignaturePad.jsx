import React, { useCallback, useEffect, useRef, useState } from 'react';

const ANCHO = 640;
const ALTO = 220;
const MARGEN = 10;

// Recorta el dibujo a su contenido para que la firma ocupe bien el espacio de los documentos
function recortar(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const datos = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (datos[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const x0 = Math.max(0, minX - MARGEN);
  const y0 = Math.max(0, minY - MARGEN);
  const w = Math.min(width, maxX + MARGEN) - x0;
  const h = Math.min(height, maxY + MARGEN) - y0;
  const salida = document.createElement('canvas');
  salida.width = w;
  salida.height = h;
  salida.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  return salida.toDataURL('image/png');
}

// Lienzo para dibujar la firma con mouse, dedo o lápiz. Devuelve un PNG con fondo transparente.
const SignaturePad = ({ onSave, onCancel, guardando = false, textoGuardar = 'Guardar firma' }) => {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const ultimo = useRef(null);
  const [vacio, setVacio] = useState(true);
  const [error, setError] = useState('');

  const preparar = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0A2540';
  }, []);

  useEffect(() => {
    preparar();
  }, [preparar]);

  const punto = (evento) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((evento.clientX - rect.left) / rect.width) * ANCHO,
      y: ((evento.clientY - rect.top) / rect.height) * ALTO,
    };
  };

  const inicio = (evento) => {
    evento.preventDefault();
    canvasRef.current.setPointerCapture?.(evento.pointerId);
    dibujando.current = true;
    ultimo.current = punto(evento);
    // un toque suelto deja un punto
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(ultimo.current.x, ultimo.current.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0A2540';
    ctx.fill();
    setVacio(false);
    setError('');
  };

  const mover = (evento) => {
    if (!dibujando.current) return;
    evento.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const actual = punto(evento);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(actual.x, actual.y);
    ctx.stroke();
    ultimo.current = actual;
  };

  const fin = () => {
    dibujando.current = false;
    ultimo.current = null;
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, ANCHO, ALTO);
    setVacio(true);
    setError('');
  };

  const guardar = () => {
    const imagen = recortar(canvasRef.current);
    if (!imagen) {
      setError('Dibuja tu firma antes de guardarla.');
      return;
    }
    onSave(imagen);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={ANCHO}
          height={ALTO}
          aria-label="Área para dibujar tu firma"
          className="block w-full cursor-crosshair touch-none rounded-xl"
          style={{ aspectRatio: `${ANCHO} / ${ALTO}` }}
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fin}
          onPointerLeave={fin}
          onPointerCancel={fin}
        />
        {vacio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Dibuja tu firma aquí con el mouse, el dedo o un lápiz
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={limpiar}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || vacio}
          className="rounded-xl bg-[#0A2540] px-4 py-2 text-sm font-bold text-white hover:bg-[#133961] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : textoGuardar}
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
