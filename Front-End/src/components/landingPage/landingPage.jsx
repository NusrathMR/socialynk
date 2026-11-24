import "./landingPage.css";


function LandingPage(){
    return(
        <>

            {/* --navigation bar section-- */}
            <header class="navbar">
                <div class="container nav-inner">
                    <div class="brand">
                    <span class="logo">✦</span>
                    <span class="brand-name">Socialynk</span>
                    <span class="tag">AI SOCIAL SUITE</span>
                    </div>

                    <nav class="nav-links">
                    <a href="" class="active">Features</a>
                    <a href="">Pipeline</a>
                    <a href="#channels">Channels</a>
                    </nav>

                    <div class="nav-actions">
                    <a href="login" class="btn btn-light">Login</a>
                    <a href="signup" class="btn btn-dark">Sign Up</a>
                    </div>
                </div>
            </header>

            {/* --hero page section-- */}
            <main class="hero">
                <div class="badge">&lsaquo; Autonomous Multi-Channel Content Suite v2.4</div>

                <h1>Create Once.<br />Improve with AI.<br />Publish Everywhere.</h1>

                <p class="subtitle">
                    Create, improve, brand, schedule, and publish your social media content from one simple workspace.
                </p>

                <div class="hero-buttons">
                    <a href="dashboard" class="btn btn-dark btn-large">Get Started &rarr;</a>
                    <a href="login" class="btn btn-light btn-large">Log In</a>
                </div>

                <ul class="hero-notes">
                    <li>No credit card required</li>
                    <li>SOC2 Type II Certified</li>
                    <li>Free 14-day trial</li>
                </ul>
            </main>

            <section class="channels" id="channels">
            <p class="channels-title">MANAGE CONTENT ACROSS YOUR CONNECTED CHANNELS</p>

            <ul class="channel-list">
                <li class="channel"><span class="icon-dot">Ig</span> Instagram</li>
                <li class="channel"><span class="icon-dot">Fb</span> Facebook</li>
                <li class="channel"><span class="icon-dot">In</span> LinkedIn</li>
                <li class="channel"><span class="icon-dot">X</span> X (Twitter)</li>
                <li class="channel"><span class="icon-dot">Tk</span> TikTok</li>
                <li class="channel"><span class="icon-dot">Yt</span> YouTube</li>
                <li class="channel"><span class="icon-dot">Pin</span> Pinterest</li>
            </ul>
            </section>

            {/* --Features section-- */}
            <section class="features">
            <div class="features-inner">
                <h2>Designed for high-output growth teams.</h2>
                <p class="features-subtitle">A unified toolchain to replace 5 fragmented SaaS subscriptions.</p>

                <div class="cards">
                <div class="card">
                    <div class="card-icon">✦</div>
                    <h3>AI-Powered Content</h3>
                    <p>Improve captions, grammar, hooks, hashtags, and viral retention with fine-tuned models tailored to your vertical.</p>
                    <a href="#" class="card-link">Explore Generation Engine &rsaquo;</a>
                </div>

                <div class="card">
                    <div class="card-icon">⛉</div>
                    <h3>Smart Branding</h3>
                    <p>Set up your brand profile once and apply logos, custom watermarks, and footers automatically across all outputs.</p>
                    <a href="#" class="card-link">Configure Brand Profiles &rsaquo;</a>
                </div>

                <div class="card">
                    <div class="card-icon">▷</div>
                    <h3>Publish Everywhere</h3>
                    <p>Schedule with optimal AI time slot predictions and publish across all networks in one click without friction.</p>
                    <a href="#" class="card-link">View Automation Matrix &rsaquo;</a>
                </div>
                </div>
            </div>
            </section>

            {/* --call to action section-- */}
            <section class="cta">
            <div class="cta-box">
                <h2>Ready to simplify your social media workflow?</h2>
                <p>Create better content and manage your publishing from one workspace.</p>

                <div class="cta-buttons">
                <a href="#" class="btn btn-dark">Get Started Free &rarr;</a>
                <a href="#" class="btn btn-light">Talk to Sales</a>
                </div>
            </div>
            </section>

            {/* --footer section-- */}
            <footer class="footer">
            <div class="footer-inner">
                <div class="footer-left">
                <span class="logo logo-small">✦</span>
                <span class="footer-brand">Socialynk</span>
                <span class="dot">•</span>
                <span class="copyright">&copy; 2025 Socialynk Inc. All rights reserved.</span>
                </div>

                <nav class="footer-links">
                <a href="#">Product</a>
                <a href="#">Features</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Status</a>
                </nav>
            </div>
            </footer>
        </>

        
    )
}

export default LandingPage;
