// ...existing code...
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Node.js 22+ tiene fetch nativo
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PRODUCTOS_FILE = path.join(__dirname, '../productos.json');

// Lee productos guardados
function getProductos() {
  try {
    const data = fs.readFileSync(PRODUCTOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Guarda productos
function saveProductos(productos) {
  fs.writeFileSync(PRODUCTOS_FILE, JSON.stringify(productos, null, 2));
}

// Extrae el ID de ML de un link (soporta múltiples formatos)
function extractId(url) {
  // MLA-123456789, MLA123456789, mla-123456789
  const match = url.match(/MLA-?(\d+)/i);
  return match ? `MLA${match[1]}` : null;
}

// Valida que sea un link de Mercado Libre
function isValidMLUrl(url) {
  return /mercadolibre\.(com\.ar|com\.br|com\.mx|com\.co|com\.pe|com\.cl|com\.uy)/i.test(url);
}

// Endpoint proxy para evitar CORS del lado del cliente
app.post('/api/producto', async (req, res) => {
  const { link } = req.body;
  
  if (!link) {
    return res.status(400).json({ error: 'Falta el link del producto' });
  }

  if (!isValidMLUrl(link)) {
    return res.status(400).json({ error: 'El link no es de Mercado Libre válido' });
  }

  const itemId = extractId(link);
  if (!itemId) {
    return res.status(400).json({ error: 'No se pudo extraer el ID del producto del link' });
  }

  try {
    const apiUrl = `https://api.mercadolibre.com/items/${itemId}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.mercadolibre.com.ar'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Producto no encontrado en Mercado Libre' });
      }
      // Si falla el proxy, devolvemos los datos necesarios para que el frontend intente directamente
      return res.status(response.status).json({ 
        error: 'Error desde proxy',
        useDirectCall: true,
        itemId: itemId 
      });
    }

    const data = await response.json();

    // Calcular descuento
    const precioOriginal = data.original_price || data.price;
    const precioActual = data.price;
    let descuento = 0;
    
    if (precioOriginal > precioActual) {
      descuento = Math.round(((precioOriginal - precioActual) / precioOriginal) * 100);
    }

    // Obtener imagen
    const imagen = data.thumbnail || 
      (data.pictures && data.pictures[0]?.url) || 
      (data.pictures && data.pictures[0]?.secure_url) || '';

    res.json({
      success: true,
      itemId: itemId,
      titulo: data.title,
      precio: data.price,
      imagen,
      descuento
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar Mercado Libre', details: err.message });
  }
});

// Listar productos guardados
app.get('/api/productos', (req, res) => {
  res.json(getProductos());
});

// Guardar producto
app.post('/api/guardar', (req, res) => {
  const producto = req.body;
  if (!producto || !producto.itemId) {
    return res.status(400).json({ error: 'Producto inválido' });
  }
  const productos = getProductos();
  if (productos.find(p => p.itemId === producto.itemId)) {
    return res.status(409).json({ error: 'Producto ya guardado' });
  }
  productos.push(producto);
  saveProductos(productos);
  res.json({ success: true });
});

// Eliminar producto
app.delete('/api/eliminar/:itemId', (req, res) => {
  const { itemId } = req.params;
  let productos = getProductos();
  productos = productos.filter(p => p.itemId !== itemId);
  saveProductos(productos);
  res.json({ success: true });
});

// Verificar si un producto sigue disponible
app.get('/api/verificar/:itemId', async (req, res) => {
  const { itemId } = req.params;
  try {
    const apiUrl = `https://api.mercadolibre.com/items/${itemId}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(404).json({ disponible: false });
    }
    const data = await response.json();
    res.json({ disponible: data.status === 'active' });
  } catch {
    res.status(500).json({ disponible: false });
  }
});

module.exports = app;
