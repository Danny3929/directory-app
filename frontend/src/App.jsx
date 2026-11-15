import { useEffect, useState } from 'react';
import SearchPage from './pages/SearchPage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import { parseRoute } from './lib/route.js';
import { loadFavourites, saveFavourites, toggleFavourite } from './lib/favourites.js';
import './App.css';

export default function App() {
  // The page comes from the part of the address after the #.
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  // One saved list for the whole app, so the card and the detail page agree.
  const [favourites, setFavourites] = useState(loadFavourites);

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const toggle = (id) => {
    const next = toggleFavourite(favourites, id);
    setFavourites(next);
    saveFavourites(next);
  };

  if (route.page === 'gym') {
    return (
      <DetailPage
        gymId={route.id}
        isFavourite={favourites.includes(route.id)}
        onToggleFavourite={() => toggle(route.id)}
      />
    );
  }

  if (route.page === 'notfound') {
    return (
      <main className="page">
        <a className="back-link" href="#/">
          ← Back to search
        </a>
        <div className="notice">
          <p>Page not found.</p>
        </div>
      </main>
    );
  }

  return <SearchPage favourites={favourites} onToggleFavourite={toggle} />;
}
