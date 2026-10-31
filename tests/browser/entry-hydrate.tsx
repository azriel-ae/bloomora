import { hydrateRoot } from 'react-dom/client';
import { demoView } from './view';
const locale = (new URLSearchParams(location.search).get('locale') ?? 'id') as 'en' | 'id';
hydrateRoot(document.getElementById('root')!, demoView(locale));
