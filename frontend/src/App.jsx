import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router';
import SearchPage from './pages/SearchPage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import FavouritesPage from './pages/FavouritesPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { loadFavourites, saveFavourites, toggleFavourite } from './lib/favourites.js';
import './App.css';

// The router itself (BrowserRouter) is in main.jsx, so tests can start
// the app at any address.
export default function App() {
  // One saved list for the whole app, so cards, the detail page and the
  // saved gyms page all agree.
  const [favourites, setFavourites] = useState(loadFavourites);

  const toggle = (id) => {
    const next = toggleFavourite(favourites, id);
    setFavourites(next);
    saveFavourites(next);
  };

  // A new page starts at the top (the browser would keep the old scroll position).
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <>
      {/* NavLink adds aria-current="page" to the link for the page you are on. */}
      <nav className="site-nav" aria-label="Main">
        <NavLink to="/" end>
          Find a gym
        </NavLink>
        <NavLink to="/favourites">Saved gyms ({favourites.length})</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SearchPage favourites={favourites} onToggleFavourite={toggle} />} />
        <Route path="/listing/:slug" element={<DetailRoute favourites={favourites} onToggleFavourite={toggle} />} />
        <Route path="/favourites" element={<FavouritesPage favourites={favourites} onToggleFavourite={toggle} />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

// Reads :slug from the address and hands it to the detail page.
function DetailRoute(props) {
  const { slug } = useParams();
  return <DetailPage slug={slug} {...props} />;
}

function NotFound() {
  return (
    <main className="page">
      <title>Page not found | Nairobi gyms</title>
      <Link className="back-link" to="/">
        ← Back to search
      </Link>
      <div className="notice">
        <h1>Page not found</h1>
        <p>That address does not match any page here.</p>
      </div>
    </main>
  );
}
