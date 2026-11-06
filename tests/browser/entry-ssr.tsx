import { renderToString } from 'react-dom/server';
import { demoView } from './view';
export const render = (locale: 'en' | 'id') => renderToString(demoView(locale));
