import { hydrateRoot } from 'react-dom/client';
import { demoView } from './view';
hydrateRoot(document.getElementById('root')!, demoView());
