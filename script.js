// ── Theme toggle
(function () {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  const icons = {
    dark:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    light: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
  };

  btn.innerHTML = icons[theme];
  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    btn.innerHTML = icons[theme];
  });
})();

// ── Security utilities
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
}

// Allowed instance domains for SSRF protection
const ALLOWED_INSTANCE_DOMAINS = [
  'cobalt-api-production-47b9.up.railway.app',
  'cobalt.tools',
  'api.cobalt.tools',
  'instances.cobalt.best'
];

function isValidInstanceUrl(url) {
  if (!isValidUrl(url)) return false;
  try {
    const u = new URL(url);
    return ALLOWED_INSTANCE_DOMAINS.some(domain => 
      u.hostname === domain || u.hostname.endsWith('.' + domain)
    );
  } catch { return false; }
}

// ── Platform detection
const PLATFORMS = [
  { pattern: /youtube\.com|youtu\.be/i,  name: 'YouTube',     short: 'YT', color: '#FF0000' },
  { pattern: /instagram\.com/i,           name: 'Instagram',   short: 'IG', color: '#E1306C' },
  { pattern: /tiktok\.com/i,              name: 'TikTok',      short: 'TT', color: '#69C9D0' },
  { pattern: /twitter\.com|x\.com/i,     name: 'Twitter / X', short: 'X',  color: '#1DA1F2' },
  { pattern: /reddit\.com/i,              name: 'Reddit',      short: 'RD', color: '#FF4500' },
  { pattern: /twitch\.tv/i,               name: 'Twitch',      short: 'TV', color: '#9147FF' },
  { pattern: /vimeo\.com/i,               name: 'Vimeo',       short: 'VM', color: '#1AB7EA' },
  { pattern: /soundcloud\.com/i,          name: 'SoundCloud',  short: 'SC', color: '#FF5500' },
  { pattern: /pinterest\.(com|co\.uk)/i, name: 'Pinterest',   short: 'PT', color: '#E60023' },
  { pattern: /tumblr\.com/i,              name: 'Tumblr',      short: 'TM', color: '#35465C' },
  { pattern: /bandcamp\.com/i,            name: 'Bandcamp',    short: 'BC', color: '#1DA0C3' },
];

function detectPlatform(url) {
  try {
    const u = new URL(url);
    return PLATFORMS.find(p => p.pattern.test(u.hostname)) || null;
  } catch { return null; }
}

// ── DOM references
const urlInput        = document.getElementById('url-input');
const downloadBtn     = document.getElementById('download-btn');
const audioToggle     = document.getElementById('audio-toggle');
const formatSelect    = document.getElementById('format-select');
const qualitySelect   = document.getElementById('quality-select');
const platformBadge   = document.getElementById('platform-badge');
const clearUrlBtn     = document.getElementById('clear-url-btn');
const pasteBtn        = document.getElementById('paste-btn');
const resultArea      = document.getElementById('result-area');
const resultCard      = document.getElementById('result-card');
const historyListEl   = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const formatGroup     = document.getElementById('format-group');
const optionsGrid     = document.querySelector('.options-grid');

let history = [];

// ── URL input handler
urlInput.addEventListener('input', () => {
  const url = urlInput.value.trim();
  clearUrlBtn.style.display = url.length > 0 ? '' : 'none';

  const platform = detectPlatform(url);
  if (platform && url) {
    const badge = document.createElement('span');
    badge.style.cssText = `font-size:9px;font-weight:800;color:${platform.color};background:${platform.color}22;border-radius:3px;padding:1px 4px;`;
    badge.textContent = platform.short;
    platformBadge.textContent = '';
    platformBadge.appendChild(badge);
    platformBadge.appendChild(document.createTextNode(' ' + platform.name));
    platformBadge.classList.add('visible');
  } else {
    platformBadge.classList.remove('visible');
  }

  downloadBtn.disabled = url.length === 0;
});

// ── Paste from clipboard
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) { urlInput.value = text; urlInput.dispatchEvent(new Event('input')); }
  } catch { urlInput.focus(); }
});

// ── Clear URL
clearUrlBtn.addEventListener('click', () => {
  urlInput.value = '';
  urlInput.dispatchEvent(new Event('input'));
  hideResult();
});

// ── Audio toggle — show/hide format select and swap grid columns
audioToggle.addEventListener('change', () => {
  const on = audioToggle.checked;
  formatSelect.disabled  = !on;
  qualitySelect.disabled =  on;
  formatGroup.classList.toggle('active', on);
  optionsGrid.classList.toggle('show-format', on);
});

// ── Show / hide result
function showResult(html) { resultCard.innerHTML = html; resultArea.classList.add('show'); attachCopyListeners(); }
function hideResult()      { resultArea.classList.remove('show'); }

function attachCopyListeners() {
  resultCard.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });
}

async function fetchDownload(url, opts) {
  const instanceUrl = 'https://cobalt-api-production-47b9.up.railway.app/';
  
  const body = {
    url,
    videoQuality: opts.quality,
    downloadMode: opts.audioOnly ? 'audio' : 'auto',
    filenameStyle: 'pretty',
  };
  if (opts.audioOnly) body.audioFormat = opts.format;
  const res = await fetch(instanceUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.code || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Render success
function renderSuccess(data, url) {
  const platform     = detectPlatform(url);
  const label        = platform ? platform.name : 'Media';
  const isAudio      = audioToggle.checked;
  const qualityLabel = isAudio
    ? formatSelect.value.toUpperCase()
    : qualitySelect.options[qualitySelect.selectedIndex].text;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const iosHint = isIOS ? '<p class="ios-hint">📱 iOS: long-press the video → <strong>Save to Photos</strong> or <strong>Download Linked File</strong></p>' : '';

  if (data.status === 'stream' || data.status === 'redirect') {
    showResult(`
      <div class="result-header">
        <div class="result-icon success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div>
          <div class="result-title">Link ready — ${label}</div>
          <div class="result-sub">${isAudio ? 'Audio' : 'Video'} · ${qualityLabel}</div>
        </div>
      </div>
      <div class="result-body">
        <div class="result-url-box">
          <span class="result-url-text">${escapeHtml(data.url)}</span>
          <button class="copy-btn" data-url="${escapeHtml(data.url)}">Copy</button>
        </div>
        <a href="${escapeHtml(data.url)}" class="btn-open-download" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M3 19h18"/></svg>
          Open & download
        </a>
        ${iosHint}
      </div>
    `);
    // Auto-trigger the download
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      // iOS: fetch as blob for direct download
      fetch(data.url)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'cdownload-video.mp4';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => window.open(data.url, '_blank'));
    } else {
      const a = document.createElement('a');
      a.href = data.url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } else if (data.status === 'picker') {
    const items = data.picker.map((item, i) => `
      <div class="picker-item">
        ${item.thumb ? `<img class="picker-thumb" src="${item.thumb}" alt="Item ${i+1}" loading="lazy">` : `<div class="picker-thumb"></div>`}
        <div class="picker-info"><div class="picker-type">${item.type || 'media'} ${i+1}</div></div>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="picker-link">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v13M7 11l5 5 5-5"/></svg>
          Save
        </a>
      </div>
    `).join('');
    showResult(`
      <div class="result-header">
        <div class="result-icon success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div>
          <div class="result-title">${data.picker.length} items found — ${label}</div>
          <div class="result-sub">Select items to download individually</div>
        </div>
      </div>
      <div class="result-body"><div class="picker-grid">${items}</div></div>
    `);
  }
}

// ── Render error
function renderError(message) {
  showResult(`
    <div class="result-header">
      <div class="result-icon error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      </div>
      <div>
        <div class="result-title">Download failed</div>
        <div class="result-sub">${message}</div>
      </div>
    </div>
  `);
}

// ── Add to history
function addToHistory(url, status, opts) {
  const platform = detectPlatform(url) || { short: '↓', name: 'Media' };
  history.unshift({
    id: Date.now(), url, platform,
    type:    opts.audioOnly ? 'audio' : 'video',
    quality: opts.audioOnly ? opts.format : opts.quality,
    status,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  if (history.length > 10) history.pop();
  renderHistory();
}

// ── Render history
function renderHistory() {
  if (history.length === 0) {
    historyListEl.innerHTML = '<div class="empty-history">No downloads yet</div>';
    return;
  }
  historyListEl.innerHTML = '';
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const platform = document.createElement('div');
    platform.className = 'history-platform';
    platform.textContent = h.platform.short;
    
    const info = document.createElement('div');
    info.className = 'history-info';
    
    const urlEl = document.createElement('div');
    urlEl.className = 'history-url';
    urlEl.textContent = h.url;
    
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = `${h.platform.name} · ${h.type} · ${h.quality} · ${h.time}`;
    
    info.appendChild(urlEl);
    info.appendChild(meta);
    
    const action = document.createElement('button');
    action.className = 'history-action icon-btn';
    action.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>';
    action.addEventListener('click', () => reuseHistory(h.url));
    
    item.appendChild(platform);
    item.appendChild(info);
    item.appendChild(action);
    historyListEl.appendChild(item);
  });
}

// ── Re-use history URL
function reuseHistory(url) {
  urlInput.value = url;
  urlInput.dispatchEvent(new Event('input'));
  urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Clear history
clearHistoryBtn.addEventListener('click', () => { history = []; renderHistory(); });

// ── Main download handler
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    const platform = detectPlatform(url);
    if (!platform) {
      renderError("This URL is not supported.");
      return;
    }

    const opts = {
      quality:   qualitySelect.value,
      audioOnly: audioToggle.checked,
      format:    formatSelect.value
    };

    downloadBtn.classList.add('loading');
    downloadBtn.disabled = true;
    hideResult();

    try {
      const data = await fetchDownload(url, opts);

    if (data.status === 'error') {
      renderError(data.text || "This URL isn't supported or the content isn't available.");
      addToHistory(url, 'error', opts);
    } else if (data.status === 'rate-limit') {
      renderError('Rate limited — please wait a moment and try again.');
      addToHistory(url, 'rate-limit', opts);
    } else {
      renderSuccess(data, url);
      addToHistory(url, 'success', opts);
    }
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      renderError('Could not reach the download service. Try <a href="https://cobalt.tools" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">cobalt.tools</a> directly.');
    } else {
      renderError(`Unexpected error: ${err.message}`);
    }
    addToHistory(url, 'error', opts);
  } finally {
    downloadBtn.classList.remove('loading');
    downloadBtn.disabled = false;
  }
});

// ── Enter key submits
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !downloadBtn.disabled) downloadBtn.click();
});

// ── Init
renderHistory();

// Handle incoming share
const params = new URLSearchParams(window.location.search);
const sharedUrl = params.get('url') || params.get('text');
if (sharedUrl && isValidUrl(sharedUrl)) {
  urlInput.value = sharedUrl;
  urlInput.dispatchEvent(new Event('input'));
}
