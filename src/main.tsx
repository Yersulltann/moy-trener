import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { allExercises, exercisePhotos } from './data/program';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    // заранее кладём фото упражнений в кэш — в зале может не быть интернета
    allExercises().flatMap(exercisePhotos).forEach((src) => fetch(src).catch(() => {}));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
