import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="not-found">
      <span>404</span>
      <h1>We couldn't find that page.</h1>
      <p>The link may be out of date, or the page may have moved.</p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
