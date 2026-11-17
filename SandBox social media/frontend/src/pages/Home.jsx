import { ArrowRight, Instagram, Layers3, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <section className="welcome-page">
      <div className="welcome-eyebrow"><span className="eyebrow-dot" />YOUR SOCIAL CONTROL ROOM</div>
      <h1>Everything social.<br /><span>One quieter space.</span></h1>
      <p className="welcome-description">
        Sandbox Social brings posts from your connected publishing workflow into one simple, organized feed.
      </p>
      <button className="primary-button" onClick={() => navigate('/feed')}>
        Explore your feed <ArrowRight size={17} />
      </button>
      <div className="welcome-cards">
        <div className="welcome-card">
          <span className="welcome-card-icon pink"><Instagram size={19} /></span>
          <h2>One unified feed</h2>
          <p>Keep an eye on posts sent from your workflow, across every supported platform.</p>
        </div>
        <div className="welcome-card">
          <span className="welcome-card-icon blue"><Layers3 size={19} /></span>
          <h2>Easy to organize</h2>
          <p>Filter by platform and search for the posts or people you need.</p>
        </div>
        <div className="welcome-card">
          <span className="welcome-card-icon green"><Radio size={19} /></span>
          <h2>Sandbox by design</h2>
          <p>Publishing requests are simulated here and never sent to social networks.</p>
        </div>
      </div>
      <div className="welcome-footnote">A lightweight home for your Socialynk publishing tests.</div>
    </section>
  );
}
