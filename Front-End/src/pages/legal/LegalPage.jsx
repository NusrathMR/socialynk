import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./LegalPage.css";

function LegalPage({ content, currentPage }) {
  const otherPage =
    currentPage === "terms"
      ? { label: "Privacy Policy", path: "/privacy" }
      : { label: "Terms of Service", path: "/terms" };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${content.title} | Socialynk`;
    window.scrollTo(0, 0);

    return () => {
      document.title = previousTitle;
    };
  }, [content.title]);

  return (
    <div className="lg-page">
      <header className="lg-header">
        <Link className="lg-brand" to="/" aria-label="Socialynk home">
          <span className="lg-logo" aria-hidden="true">
            ✦
          </span>
          <span>Socialynk</span>
        </Link>
        <Link className="lg-header-link" to="/signup">
          Back to sign up
        </Link>
      </header>

      <main className="lg-main">
        <nav className="lg-toc" aria-label="Table of contents">
          <h2>On this page</h2>
          <ul>
            {content.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="lg-article">
          <h1>{content.title}</h1>
          <p className="lg-meta">
            Last updated: {content.lastUpdated} · Version 1.0
          </p>
          <p className="lg-notice">
            This is sample content for a student project. It is not legal
            advice.
          </p>
          <p className="lg-intro">{content.intro}</p>

          {content.sections.map((section) => (
            <section className="lg-section" key={section.id}>
              <h2 id={section.id}>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.list && (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </main>

      <footer className="lg-footer">
        <nav aria-label="Legal pages">
          <Link to={otherPage.path}>{otherPage.label}</Link>
          <Link to="/signup">Back to sign up</Link>
        </nav>
        <p>© 2026 Socialynk</p>
      </footer>
    </div>
  );
}

export default LegalPage;
