import { getCollection } from 'astro:content';
import { SITE_URL } from '../consts';

export async function GET() {
  const episodes = await getCollection('episodes');
  const pages = ['', 'episodes', 'links', 'pricing', 'lemonade-costs', 'tech-empire-game'];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${pages.map((page) => `
        <url>
          <loc>${SITE_URL}/${page}</loc>
          <changefreq>monthly</changefreq>
          <priority>${page === '' ? '1.0' : '0.8'}</priority>
        </url>
      `).join('')}
      ${episodes.map((episode) => `
        <url>
          <loc>${SITE_URL}/episodes/${episode.slug}</loc>
          <lastmod>${episode.data.pubDate.toISOString()}</lastmod>
          <changefreq>never</changefreq>
          <priority>0.9</priority>
        </url>
      `).join('')}
    </urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}