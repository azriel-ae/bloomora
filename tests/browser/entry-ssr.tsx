import { renderToString } from 'react-dom/server';
import { demoView } from './view';
export const render = () => renderToString(demoView());
