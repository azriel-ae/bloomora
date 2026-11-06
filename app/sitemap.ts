import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

const publicPaths = [
  '/', '/templates', '/pricing', '/about', '/contact', '/faq', '/payment',
  '/privacy', '/terms', '/refunds', '/expiration', '/media-policy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: siteUrl(path),
    changeFrequency: path === '/' || path === '/templates' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/templates' || path === '/pricing' ? 0.8 : 0.5,
  }));
}
