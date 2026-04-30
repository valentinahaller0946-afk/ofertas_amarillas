const fetch = globalThis.fetch; // using native fetch in Node 18+
async function run() {
  const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'};
  const r = await fetch('https://articulo.mercadolibre.com.ar/MLA-1416629169', {headers});
  const html = await r.text();
  
  // Extract title
  const titleMatch = html.match(/<h1 class="ui-pdp-title"[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1] : null;
  
  // Extract price (current)
  // Usually <meta itemprop="price" content="5999">
  const priceMatch = html.match(/<meta itemprop="price" content="([^"]+)"/);
  const price = priceMatch ? Number(priceMatch[1]) : null;

  // Extract original price
  const origPriceMatch = html.match(/<s class="[^"]*andes-money-amount[^"]*">.*?<span class="andes-money-amount__fraction">([^<]+)<\/span>.*?<\/s>/s);
  const origPrice = origPriceMatch ? Number(origPriceMatch[1].replace(/\./g, '')) : price;

  // Extract image
  const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  const img = imgMatch ? imgMatch[1] : null;
  
  console.log({title, price, origPrice, img});
}
run();
