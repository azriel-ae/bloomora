const OFFICIAL_SITE_ORIGIN = 'https://bloomora.my.id';
const configuredSiteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');

/** Tautan publik hanya boleh dibentuk dari origin resmi, bukan host preview/deployment. */
export const SITE_ORIGIN = configuredSiteOrigin === OFFICIAL_SITE_ORIGIN
  ? configuredSiteOrigin
  : OFFICIAL_SITE_ORIGIN;

export function siteUrl(path = '/') {
  return new URL(path.replace(/^\/+/, ''), `${SITE_ORIGIN}/`).toString();
}
