async function run() {
  const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'};
  const r = await fetch('https://articulo.mercadolibre.com.ar/MLA-96631608403', {headers});
  const html = await r.text();
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  if (match) console.log(JSON.parse(match[1]).name);
  else console.log('not found');
}
run();
