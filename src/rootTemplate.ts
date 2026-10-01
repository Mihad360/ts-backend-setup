import config from "./app/config";

const appName = config.APP_NAME || "Core Backend Service";

export const getRootTemplate = (name = appName): string => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name} | API Service</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-primary: #0a0d14;
        --bg-secondary: #121824;
        --bg-card: rgba(22, 30, 46, 0.7);
        --border-color: rgba(255, 255, 255, 0.08);
        --border-hover: rgba(99, 102, 241, 0.4);
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
        --text-muted: #64748b;
        --accent-purple: #6366f1;
        --accent-indigo: #4f46e5;
        --accent-cyan: #06b6d4;
        --accent-emerald: #10b981;
        --glow: rgba(99, 102, 241, 0.15);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        line-height: 1.5;
        overflow-x: hidden;
        position: relative;
      }

      /* Background subtle glow circles */
      body::before {
        content: "";
        position: fixed;
        top: -150px;
        left: 50%;
        transform: translateX(-50%);
        width: 800px;
        height: 450px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 80%);
        filter: blur(60px);
        pointer-events: none;
        z-index: 0;
      }

      .container {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 50px 24px;
        position: relative;
        z-index: 1;
      }

      /* Top Navbar */
      .navbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 40px;
        border-bottom: 1px solid var(--border-color);
      }

      .logo-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 800;
        color: #fff;
        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
      }

      .brand-name {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #ffffff;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 0.825rem;
        font-weight: 600;
        color: var(--accent-emerald);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        background-color: var(--accent-emerald);
        border-radius: 50%;
        box-shadow: 0 0 10px var(--accent-emerald);
        animation: pulse 2s infinite ease-in-out;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }

      /* Hero Section */
      .hero {
        text-align: center;
        padding: 60px 0 45px;
      }

      .badge {
        display: inline-block;
        padding: 6px 16px;
        border-radius: 30px;
        background: rgba(99, 102, 241, 0.12);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.25);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 20px;
      }

      .hero h1 {
        font-size: clamp(2.4rem, 5vw, 3.6rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin-bottom: 18px;
        background: linear-gradient(180deg, #ffffff 40%, #cbd5e1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .hero p {
        font-size: 1.15rem;
        color: var(--text-secondary);
        max-width: 650px;
        margin: 0 auto 30px;
        font-weight: 400;
      }

      /* Endpoint Badge Bar */
      .endpoint-bar {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        padding: 10px 18px;
        border-radius: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin-bottom: 40px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      }

      .method-get {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.8rem;
      }

      .endpoint-url {
        color: #e2e8f0;
      }

      /* Feature Grid */
      .section-title {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin-bottom: 20px;
        color: #cbd5e1;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 20px;
        margin-bottom: 40px;
      }

      .card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 24px;
        backdrop-filter: blur(12px);
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .card:hover {
        border-color: var(--border-hover);
        transform: translateY(-4px);
        box-shadow: 0 12px 24px -10px var(--glow);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .card-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .card-title {
        font-size: 1.05rem;
        font-weight: 600;
        color: #f1f5f9;
      }

      .card-desc {
        font-size: 0.88rem;
        color: var(--text-secondary);
        margin-bottom: 16px;
      }

      .card-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.78rem;
        color: #818cf8;
        background: rgba(99, 102, 241, 0.1);
        padding: 4px 10px;
        border-radius: 6px;
        align-self: flex-start;
      }

      /* Stack Badges */
      .stack-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        margin-top: 10px;
      }

      .stack-item {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Footer */
      footer {
        border-top: 1px solid var(--border-color);
        padding: 28px 24px;
        text-align: center;
        font-size: 0.88rem;
        color: var(--text-muted);
        position: relative;
        z-index: 1;
      }

      footer a {
        color: #818cf8;
        text-decoration: none;
        margin: 0 10px;
        transition: color 0.2s;
      }

      footer a:hover {
        color: #c7d2fe;
      }

      @media (max-width: 640px) {
        .container {
          padding: 30px 16px;
        }
        .hero {
          padding: 40px 0 25px;
        }
        .navbar {
          flex-direction: column;
          gap: 16px;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Navbar -->
      <nav class="navbar">
        <div class="logo-group">
          <div class="logo-icon">&lt;/&gt;</div>
          <span class="brand-name">${name}</span>
        </div>
        <div class="status-pill">
          <span class="status-dot"></span>
          <span>System Operational</span>
        </div>
      </nav>

      <!-- Hero Section -->
      <section class="hero">
        <span class="badge">TypeScript • Express 5 • MongoDB</span>
        <h1>Production Backend Engine</h1>
        <p>Enterprise RESTful API with real-time WebSocket messaging, role-based security, and high-performance media pipeline.</p>
        
        <div class="endpoint-bar">
          <span class="method-get">BASE API</span>
          <span class="endpoint-url">/api/v1</span>
        </div>
      </section>

      <!-- Architecture Modules -->
      <h2 class="section-title">Core Modules & Services</h2>
      <div class="grid">
        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">🔐</div>
              <h3 class="card-title">Auth & Identity</h3>
            </div>
            <p class="card-desc">JWT authentication, bcrypt security, password resets, and role verification.</p>
          </div>
          <span class="card-tag">/api/v1/auth</span>
        </div>

        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">👤</div>
              <h3 class="card-title">User Management</h3>
            </div>
            <p class="card-desc">Complete user profile lifecycles, avatars, role permissions, and administrative controls.</p>
          </div>
          <span class="card-tag">/api/v1/users</span>
        </div>

        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">💬</div>
              <h3 class="card-title">Chat & Messaging</h3>
            </div>
            <p class="card-desc">1-on-1 conversations, text chat, multi-file attachments, and read receipts.</p>
          </div>
          <span class="card-tag">/api/v1/conversations</span>
        </div>

        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">⚡</div>
              <h3 class="card-title">Realtime Engine</h3>
            </div>
            <p class="card-desc">Socket.IO real-time event broadcasts and Firebase Cloud Messaging push alerts.</p>
          </div>
          <span class="card-tag">/api/v1/notifications</span>
        </div>

        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">🖼️</div>
              <h3 class="card-title">Optimized Media</h3>
            </div>
            <p class="card-desc">Multi-core Sharp WebP compression, stream piping, and Cloudinary storage.</p>
          </div>
          <span class="card-tag">Multer & Cloudinary</span>
        </div>

        <div class="card">
          <div>
            <div class="card-header">
              <div class="card-icon">⚙️</div>
              <h3 class="card-title">System Settings</h3>
            </div>
            <p class="card-desc">Dynamic terms, privacy policy, about pages, and administrative controls.</p>
          </div>
          <span class="card-tag">/api/v1/settings/*</span>
        </div>
      </div>

      <!-- Tech Stack -->
      <h2 class="section-title">Built With Modern Standards</h2>
      <div class="stack-row">
        <div class="stack-item"><span>🟦</span> TypeScript 5+</div>
        <div class="stack-item"><span>🚀</span> Express 5.x</div>
        <div class="stack-item"><span>🍃</span> MongoDB & Mongoose 9</div>
        <div class="stack-item"><span>🔌</span> Socket.IO 4</div>
        <div class="stack-item"><span>✨</span> Sharp Media Optimization</div>
        <div class="stack-item"><span>🛡️</span> Zod Schema Validation</div>
      </div>
    </div>

    <!-- Footer -->
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${name}. All rights reserved.</p>
      <div style="margin-top: 8px;">
        <a href="/privacy-policy">Privacy Policy</a>
        <span>•</span>
        <a href="/app-instruction">App Instructions</a>
        <span>•</span>
        <a href="/api/v1/settings/terms">Terms</a>
      </div>
    </footer>
  </body>
</html>
`;

export const template = getRootTemplate();
