import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as any).__EDUTRAIN_LOADED__ = true;
createRoot(document.getElementById('root')!).render(<App />);

