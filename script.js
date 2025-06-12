const clientId = '23cd83a8778d4274a8721e203c4dba70';
const redirectUri = window.location.origin + window.location.pathname;
let accessToken = null;
let user = null;
let animeTracks = [];
let playerAudio = null;
let currentTrackIndex = 0;

// SPA Navigation
let currentRoute = 'home';

// --- PKCE AUTH HELPERS ---
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// --- PLAYER DINÂMICO ---
function renderPlayer() {
  if (document.getElementById('player')) return; // evita duplicar
  const playerHTML = `
    <footer id="player" class="hidden">
      <div class="track-info">
        <img id="album-cover" src="" alt="Album Cover" />
        <div class="track-text">
          <span id="track-title">---</span>
          <span id="track-artist">---</span>
        </div>
      </div>
      <div class="controls">
        <button id="prev"><i class="fas fa-backward"></i></button>
        <button id="play"><i class="fas fa-play"></i></button>
        <button id="next"><i class="fas fa-forward"></i></button>
      </div>
      <div class="lyrics-toggle">
        <button id="toggle-lyrics"><i class="fas fa-chevron-up"></i></button>
      </div>
    </footer>
  `;
  document.querySelector('.container').insertAdjacentHTML('beforeend', playerHTML);
  setupPlayerEventListeners();
}

function removePlayer() {
  const player = document.getElementById('player');
  if (player) player.remove();
}

// --- EVENTOS DOS BOTÕES DO PLAYER ---
function setupPlayerEventListeners() {
  const toggleLyricsBtn = document.getElementById('toggle-lyrics');
  if (toggleLyricsBtn) {
    toggleLyricsBtn.onclick = () => {
      const lyricsPanel = document.getElementById('lyrics-panel');
      if (lyricsPanel) lyricsPanel.classList.toggle('hidden');
    };
  }
  const prevBtn = document.getElementById('prev');
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (!animeTracks.length) return;
      currentTrackIndex = (currentTrackIndex - 1 + animeTracks.length) % animeTracks.length;
      playPreview();
    };
  }
  const nextBtn = document.getElementById('next');
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!animeTracks.length) return;
      currentTrackIndex = (currentTrackIndex + 1) % animeTracks.length;
      playPreview();
    };
  }
}

// --- AUTH FLOW ---
document.getElementById('spotifyLoginBtn').addEventListener('click', async () => {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    scope: 'user-read-private user-read-email'
  });

  window.location = `https://accounts.spotify.com/authorize?${params}`;
});

async function handleRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  const codeVerifier = localStorage.getItem('code_verifier');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await res.json();
  accessToken = data.access_token;
  localStorage.setItem('access_token', accessToken);
  window.history.replaceState({}, document.title, redirectUri);
  await loadSpotifyProfile();
  showHome();
}

async function loadSpotifyProfile() {
  accessToken = accessToken || localStorage.getItem('access_token');
  if (!accessToken) return;
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  user = await res.json();

  // Header
  document.getElementById('loginArea').style.display = 'none';
  document.getElementById('userInfo').style.display = 'flex';
  document.getElementById('userNickname').textContent = user.display_name || 'Usuário';
  document.getElementById('userAvatar').src = user.images?.[0]?.url || 'https://ui-avatars.com/api/?name=AnimeBeat';
  document.getElementById('userAvatar').onclick = () => {
    if (user && user.external_urls && user.external_urls.spotify) {
      window.open(user.external_urls.spotify, '_blank');
    }
  };
}

// --- SPA VIEWS ---
function showHome() {
  currentRoute = 'home';
  document.getElementById('mainHeader').style.display = 'flex';
  document.getElementById('mainContentArea').style.display = 'flex';
  removePlayer(); // Remove player, se existir
  const lyricsPanel = document.getElementById('lyrics-panel');
  if (lyricsPanel) lyricsPanel.classList.add('hidden');
  document.getElementById('view-root').innerHTML = `
    <div class="text-content" id="mainText">
      ${user ? `
        <h1>Bem-vindo, ${user.display_name || 'usuário'}!</h1>
        <p>Explore o mundo dos animes e músicas agora.</p>
        <button id="startListeningBtn">Começar a Ouvir</button>
      ` : `
        <h1>DESCUBRA NOVOS SONS,<br>EMOÇÕES E MUNDOS</h1>
        <p>SINTONIZE AGORA COM O MELHOR DA MÚSICA,<br>ANIME E CULTURA JOVEM.</p>
        <button id="exploreBtn">Explorar</button>
      `}
    </div>
  `;
  if (user) {
    document.getElementById('startListeningBtn').onclick = showExplore;
  } else {
    document.getElementById('exploreBtn').onclick = () => alert('Faça login com o Spotify primeiro!');
  }
}

function showExplore() {
  // Oculta o layout principal
  document.getElementById('mainHeader').style.display = "none";
  document.getElementById('mainContentArea').style.display = "none";
  removePlayer();

  // Remove navegação fullscreen antiga se já existir
  if (document.getElementById('musicNavMain')) {
    document.getElementById('musicNavMain').remove();
  }

  // Cria a navegação de músicas em tela cheia
  document.body.insertAdjacentHTML('beforeend', `
    <div class="music-nav-fullscreen" id="musicNavMain">
      <div class="music-side">
        <div class="bell"><i class="fas fa-bell"></i></div>
        <div class="library-label">Blibioteca</div>
        <div class="library-list">
          <img class="library-thumb" src="https://i.imgur.com/eKj8V2R.png" >
          <img class="library-thumb" src="https://i.imgur.com/7OZ1UOh.png" >
          <img class="library-thumb" src="https://i.imgur.com/9kJo7jE.png" >
        </div>
        <button class="add-thumb-btn"><span>+</span></button>
      </div>
      <div class="music-nav-main">
        <div class="music-nav-header">
          <div class="music-nav-categories">
            <button class="active">Classicas</button>
            <button>Recentes</button>
            <button>Populares</button>
            <button>Iconicas</button>
            <button>encerramentos</button>
          </div>
          <div class="music-nav-search">
            <input type="text" placeholder="Buscar" />
            <i class="fas fa-search"></i>
            <i class="fas fa-microphone"></i>
          </div>
          <div class="music-nav-user">
            <span>ola, ${user?.display_name?.split(' ')[0] || "usuário"}</span>
            <img class="user-avatar" src="${user?.images?.[0]?.url || 'https://ui-avatars.com/api/?name=AnimeBeat'}" alt="Avatar">
          </div>
        </div>
        <div class="music-nav-content">
          <div class="music-section-title">Atemporais</div>
          <div class="music-track-grid">
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/eKj8V2R.png"><div class="track-title">Cruel Angel's Thesis</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/7OZ1UOh.png"><div class="track-title">Guren no Yumiya</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/4BKkZ7w.png"><div class="track-title">Tank! – Cowboy Bebop</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/vg7O8yV.png"><div class="track-title">Blue Bird</div></div>
          </div>
          <div class="music-section-title">Favoritas da Comunidade</div>
          <div class="music-track-grid">
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/9kJo7jE.png"><div class="track-title">Gurenge<br>Demon Slayer</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/eKj8V2R.png"><div class="track-title">ankoku na Tenshi no Thesis</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/3OZ3aYB.png"><div class="track-title">Sign – Flow</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/4BKkZ7w.png"><div class="track-title">Closer – Joe Inoue</div></div>
          </div>
          <div class="music-section-title">Músicas de Batalha/Temas Emocionais</div>
          <div class="music-track-grid">
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/5W4BfJD.png"><div class="track-title">My War<br>Shinsei Kamattechan</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/6r3GZGI.png"><div class="track-title">Inferno<br>Mrs. GREEN APPLE</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/1oU1hBf.png"><div class="track-title">This Game<br>Konomi Suzuki</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/0Ue5i3U.png"><div class="track-title">Colors – FLOW</div></div>
          </div>
          <div class="music-section-title">Encerramentos Marcantes</div>
          <div class="music-track-grid">
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/eKj8V2R.png"><div class="track-title">Zankoku na Tenshi no Thesis</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/7OZ1UOh.png"><div class="track-title">Shiki no Uta</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/1oU1hBf.png"><div class="track-title">Namae wo Yobu yo</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/4BKkZ7w.png"><div class="track-title">The Real Folk Blues</div></div>
          </div>
          <div class="music-section-title">Aberturas românticas</div>
          <div class="music-track-grid">
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/0Ue5i3U.png"><div class="track-title">Hikaru Nara<br>Goose house</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/3OZ3aYB.png"><div class="track-title">Kimi no Shirana Monogatari</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/7OZ1UOh.png"><div class="track-title">Renai Circulation<br>Kana Hanazawa</div></div>
            <div class="music-track-card"><img class="cover" src="https://i.imgur.com/5W4BfJD.png"><div class="track-title">Kaibutsu YOASOBI</div></div>
          </div>
        </div>
      </div>
    </div>
  `);
}

// --- BUSCA E GRID ---
async function loadAnimeTracksGrid() {
  animeTracks = [];
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=genre:anime&type=track&limit=30`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  animeTracks = (await res.json()).tracks.items.filter(t => t.preview_url);
  renderAnimeTracksGrid(animeTracks);
}

function renderAnimeTracksGrid(tracks, searchTerm = '') {
  tracks = tracks || animeTracks;
  let filtered = tracks;
  if (searchTerm) {
    filtered = tracks.filter(
      t => t.name.toLowerCase().includes(searchTerm) ||
           t.artists.map(a=>a.name).join(',').toLowerCase().includes(searchTerm)
    );
  }
  if (filtered.length === 0) {
    document.getElementById('animeTracksGrid').innerHTML = '<div style="color:#fff;opacity:0.7;">Nenhuma música encontrada.</div>';
    return;
  }
  let html = '<div class="anime-section"><div class="anime-grid">';
  for (const track of filtered) {
    html += `
      <div class="anime-card" onclick="playThisTrack('${track.id}')">
        <img src="${track.album.images[0].url}" alt="${track.name}">
        <div class="track-title">${track.name}</div>
        <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
      </div>
    `;
  }
  html += '</div></div>';
  document.getElementById('animeTracksGrid').innerHTML = html;
}

// --- PLAYER ---
window.playThisTrack = function(trackId) {
  const idx = animeTracks.findIndex(t => t.id === trackId);
  if (idx === -1) return;
  currentTrackIndex = idx;
  playPreview();
};

async function playPreview() {
  if (!animeTracks.length) return;
  const track = animeTracks[currentTrackIndex];
  updatePlayerUI(track);

  if (playerAudio) playerAudio.pause();
  playerAudio = new Audio(track.preview_url);
  playerAudio.play();

  const playBtn = document.getElementById('play');
  if (playBtn) {
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    playBtn.onclick = () => {
      if (playerAudio.paused) {
        playerAudio.play();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        playerAudio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
    };
  }
}

function updatePlayerUI(track) {
  const albumCover = document.getElementById('album-cover');
  const trackTitle = document.getElementById('track-title');
  const trackArtist = document.getElementById('track-artist');
  const lyrics = document.getElementById('lyrics');
  if (albumCover) albumCover.src = track.album.images[0].url;
  if (trackTitle) trackTitle.textContent = track.name;
  if (trackArtist) trackArtist.textContent = track.artists.map(a => a.name).join(', ');
  if (lyrics) lyrics.textContent = 'Letra indisponível para prévias.';
}

// --- LOGOUT ---
document.getElementById('logoutBtn').onclick = () => {
  localStorage.removeItem('access_token');
  user = null;
  accessToken = null;
  animeTracks = [];
  document.getElementById('loginArea').style.display = '';
  document.getElementById('userInfo').style.display = 'none';
  removePlayer();
  showHome();
};

// --- INIT ---
window.addEventListener('DOMContentLoaded', async () => {
  accessToken = localStorage.getItem('access_token');
  if (new URLSearchParams(window.location.search).get('code')) {
    await handleRedirect();
    return;
  }
  if (accessToken) {
    await loadSpotifyProfile();
  }
  removePlayer();
  showHome();
});