const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── Configuración JSONbin.io ──
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_KEY    = process.env.JSONBIN_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JSONBIN_URL    = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ── Helpers JSONbin ──
async function getProductos() {
  const res = await fetch(`${JSONBIN_URL}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  });
  if (!res.ok) throw new Error('Error al leer JSONbin');
  const data = await res.json();
  return data.record.productos || [];
}

async function saveProductos(productos) {
  const res = await fetch(JSONBIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY
    },
    body: JSON.stringify({ productos })
  });
  if (!res.ok) throw new Error('Error al guardar en JSONbin');
}

// ── Auth helper ──
function checkAdmin(req, res) {
  const pw = req.headers['x-admin-password'];
  if (!ADMIN_PASSWORD || pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function extractId(url) {
  const match = url.match(/MLA-?(\d+)/i);
  return match ? `MLA${match[1]}` : null;
}

// ── Endpoints ──

// Verificar contraseña admin
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// Proxy: busca producto en ML y devuelve datos al frontend
app.post('/api/producto', async (req, res) => {
  const { link } = req.body;
  if (!link) return res.status(400).json({ error: 'Falta el link' });

  if (!/mercadolibre/i.test(link)) {
    return res.status(400).json({ error: 'El link debe ser de MercadoLibre' });
  }

  const itemId = extractId(link);
  if (!itemId) return res.status(400).json({ error: 'No se pudo extraer el ID del producto' });

  try {
    const mlRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!mlRes.ok) {
      if (mlRes.status === 404) return res.status(404).json({ error: 'Producto no encontrado en MercadoLibre' });
      return res.status(mlRes.status).json({ error: `Error de MercadoLibre: ${mlRes.status}` });
    }

    const data = await mlRes.json();
    const precioOriginal = data.original_price || data.price;
    const precioActual   = data.price;
    const descuento = precioOriginal > precioActual
      ? Math.round(((precioOriginal - precioActual) / precioOriginal) * 100)
      : 0;

    const imagen = data.thumbnail ||
      (data.pictures && data.pictures[0]?.secure_url) ||
      (data.pictures && data.pictures[0]?.url) || '';

    res.json({
      success: true,
      itemId,
      titulo: data.title,
      precio: precioActual,
      precioOriginal,
      descuento,
      imagen: imagen.replace(/\-I\.jpg$/, '-O.jpg'), // imagen más grande
      link: data.permalink || link,
      condicion: data.condition,
      vendidos: data.sold_quantity || 0,
      envioGratis: data.shipping?.free_shipping || false,
      categoria: ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar MercadoLibre', details: err.message });
  }
});

// Listar productos
app.get('/api/productos', async (req, res) => {
  try {
    const productos = await getProductos();
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos', details: err.message });
  }
});

// Guardar producto (protegido)
app.post('/api/guardar', async (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { producto } = req.body;
  if (!producto || !producto.itemId) {
    return res.status(400).json({ error: 'Producto inválido' });
  }

  try {
    const productos = await getProductos();
    if (productos.find(p => p.itemId === producto.itemId)) {
      return res.status(409).json({ error: 'Este producto ya está guardado' });
    }
    productos.unshift(producto);
    await saveProductos(productos);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto (protegido)
app.delete('/api/producto/:itemId', async (req, res) => {
  if (!checkAdmin(req, res)) return;

  try {
    let productos = await getProductos();
    productos = productos.filter(p => p.itemId !== req.params.itemId);
    await saveProductos(productos);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verificar si un producto sigue disponible
app.get('/api/verificar/:itemId', async (req, res) => {
  try {
    const mlRes = await fetch(`https://api.mercadolibre.com/items/${req.params.itemId}`);
    if (!mlRes.ok) return res.json({ disponible: false, precio: null });
    const data = await mlRes.json();
    res.json({
      disponible: data.status === 'active',
      precio: data.price,
      precioOriginal: data.original_price || data.price
    });
  } catch {
    res.status(500).json({ disponible: false });
  }
});

module.exports = app;
