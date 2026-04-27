# 🟡 Ofertas Amarillas

Web de ofertas curadas de MercadoLibre para tu hogar.

## 🚀 Despliegue en Vercel

### Opción 1: Desde GitHub (recomendado)

1. Subir este proyecto a un repositorio GitHub
2. Ir a [vercel.com](https://vercel.com)
3. Click "New Project" → importar el repositorio
4. Vercel detectará automáticamente que es HTML estático
5. Click "Deploy" — listo!

### Opción 2: Deploy manual (sin GitHub)

1. Ir a [vercel.com](https://vercel.com)
2. Drag & drop la carpeta del proyecto
3. Listo!

## 📁 Estructura

```
ofertasamarillas/
├── ofertas-amarillas.html   # Archivo principal
├── package.json             # Configuración npm
└── README.md                # Este archivo
```

## 🔧 Personalización

- **Links de productos**: Editar los `href` en las tarjetas de productos
- **Categorías**: Modificar en la sección `cats-row`
- **Colores**: Variables CSS en `:root`
- **Admin**: El panel es solo visual — para hacerlo funcional se necesita un backend

## 📋 Notas

- Los links a MercadoLibre son de ejemplo — reemplazar con links reales
- Imágenes usan emojis como placeholders — reemplazar por `<img>` reales si se tienen
- El panel de admin no guarda datos (solo HTML/JS del lado cliente)

## 🌐 Dominio personalizado

Después del deploy:
1. Ir a Settings → Domains
2. Agregar tu dominio propio
3. Configurar DNS según las instrucciones de Vercel

---

⭐️ Si te sirve, dale una estrella al repositorio!