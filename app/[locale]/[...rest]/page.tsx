import { notFound } from 'next/navigation';

/** Unmatched URLs (the middleware always rewrites them under /{locale}) render the localized 404 inside the site layout. */
export default function UnmatchedRoute() { notFound(); }
