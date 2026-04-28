const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Node.js 22+ tiene fetch nativo
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PRODUCTOS_FILE = path.join(__dirname, 'productos.json');

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
      precio: precioActual,
      precioOriginal: precioOriginal,
      descuento: descuento,
      imagen: imagen,
      categoria: data.category_id,
      link: data.permalink,
      condicion: data.condition,
      vendidos: data.sold_quantity,
      disponible: data.status === 'active'
    });
  } catch (e) {
    console.error('Error fetching product:', e.message);
    res.status(500).json({ 
      error: 'Error al conectar con la API de Mercado Libre', 
      detalle: e.message,
      useDirectCall: true,
      itemId: itemId
    });
  }
});

// Endpoint para guardar un producto
app.post('/api/guardar', async (req, res) => {
  const { producto } = req.body;
  
  if (!producto || !producto.link || !producto.titulo) {
    return res.status(400).json({ error: 'Datos de producto incompletos' });
  }

  const productos = getProductos();
  
  // Verificar si ya existe
  const existe = productos.find(p => p.link === producto.link);
  if (existe) {
    return res.status(400).json({ error: 'Este producto ya está guardado' });
  }

  productos.push({
    link: producto.link,
    titulo: producto.titulo,
    precio: producto.precio,
    precioOriginal: producto.precioOriginal,
    descuento: producto.descuento,
    imagen: producto.imagen,
    categoria: producto.categoria || 'general',
    fechaAgregado: new Date().toISOString()
  });

  saveProductos(productos);
  
  res.json({ success: true, total: productos.length });
});

// Endpoint para obtener todos los productos
app.get('/api/productos', (req, res) => {
  const productos = getProductos();
  res.json(productos);
});

// Endpoint para eliminar un producto
app.delete('/api/producto/:link', (req, res) => {
  const linkDecode = decodeURIComponent(req.params.link);
  let productos = getProductos();
  const initialLength = productos.length;
  
  productos = productos.filter(p => p.link !== linkDecode);
  
  if (productos.length === initialLength) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  saveProductos(productos);
  res.json({ success: true, total: productos.length });
});

// Endpoint de verificación (simplificado - solo lee productos guardados)
app.post('/api/verificar', async (req, res) => {
  const { link } = req.body;
  
  if (!link) {
    return res.status(400).json({ error: 'Falta el link del producto' });
  }

  // Por ahora devolvemos que necesita verificación directa
  res.json({
    necesitaVerificacionDirecta: true,
    message: 'La verificación debe hacerse desde el frontend para evitar CORS'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('🔗 API Ofertas Amarillas running on port', PORT));
