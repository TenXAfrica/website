// Builds public/og-default.jpg (the share image) from the logo. Run: node scripts/make-og-image.mjs
import sharp from 'sharp';
const W = 1200, H = 630;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0a0f14"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#d68614"/>
  <text x="380" y="300" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#F4F4F9">Ten X Africa</text>
  <text x="380" y="372" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#8E969F">We build the software your business</text>
  <text x="380" y="418" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#8E969F">is currently doing by hand.</text>
  <text x="380" y="500" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#d68614" letter-spacing="4">TENXAFRICA.CO.ZA</text>
</svg>`;
const logo = await sharp('src/assets/Logo.png').resize(220, 220).png().toBuffer();
await sharp(Buffer.from(svg)).composite([{ input: logo, left: 110, top: 205 }]).jpeg({ quality: 88 }).toFile('public/og-default.jpg');
const m = await sharp('public/og-default.jpg').metadata();
console.log('og-default.jpg', m.width, m.height);
