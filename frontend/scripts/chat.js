// ── Global state — accessible across DOMContentLoaded and Clerk auth ──
const API = 'http://localhost:3000';
let clerkUserId   = null;
let conversations = [];
let activeConvId  = null;

document.addEventListener('DOMContentLoaded', () => {

  /* ── Batches multiple lucide icon renders into a single frame ── */
  let _iconTimer = null;
  function refreshIcons() {
    if (_iconTimer) return;
    _iconTimer = requestAnimationFrame(() => {
      lucide.createIcons();
      _iconTimer = null;
    });
  }

  /* ── Toast notifications — replaces alert() for non-blocking feedback ── */
  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const colors = { info: '#4a9eff', success: '#22c55e', error: '#ef4444', warn: '#f97316' };
    toast.style.cssText = `
      padding:10px 18px;border-radius:10px;font-size:13px;font-family:var(--font);
      color:#fff;background:${colors[type] || colors.info};
      box-shadow:0 4px 16px rgba(0,0,0,0.2);pointer-events:auto;
      opacity:0;transform:translateY(8px);transition:opacity 0.2s ease,transform 0.2s ease;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  /* ── Escapes HTML entities to prevent XSS in innerHTML contexts ── */
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════
     WELCOME MESSAGE ENGINE
     Pre-written pool rotated by category, time, and context
  ══════════════════════════════ */
  const WELCOME_MESSAGES = {
    universal: [
      "What's on your mind?", "Ready when you are.", "Let's make progress.",
      "Start anywhere.", "Something worth exploring?", "Let's build something useful.",
      "New chat. New possibilities.", "What's today's mission?", "Bring your best idea.",
      "Let's get started.", "Where should we begin?", "What's worth discussing?",
      "Curious about something?", "Let's figure it out.", "Your move.",
      "What's next?", "Let's make today count.", "What's the challenge?",
      "Ready for a breakthrough?", "Let's create something great."
    ],
    curiosity: [
      "What are you wondering about?", "Let's follow your curiosity.",
      "Ask the question.", "What's worth understanding?",
      "Let's explore the unknown.", "What's hiding beneath the surface?",
      "Ready to learn something surprising?", "What deserves a closer look?",
      "Let's uncover something interesting.", "Where does your curiosity lead?",
      "Every answer starts somewhere.", "What's the mystery today?",
      "Discover something unexpected.", "What's the rabbit hole?",
      "Explore a new perspective."
    ],
    motivation: [
      "Small steps create momentum.", "Progress starts now.",
      "Your next win awaits.", "One idea can change everything.",
      "Keep moving forward.", "Today's a good day to begin.",
      "Build the future you want.", "Start before you're ready.",
      "Great things take one step.", "Momentum loves action.",
      "Keep building.", "Make progress visible.",
      "Turn ideas into reality.", "Better starts here.",
      "Let's move things forward."
    ],
    creativity: [
      "Create something remarkable.", "What doesn't exist yet?",
      "Let's invent something new.", "Imagination is welcome here.",
      "Build beyond expectations.", "What if?",
      "Dream bigger.", "Start with possibilities.",
      "Make something unforgettable.", "Let's rethink the obvious.",
      "Explore bold ideas.", "Creativity starts now.",
      "Design what's next.", "Create without limits.",
      "Bring ideas to life."
    ],
    productivity: [
      "What's the priority today?", "Ready to focus?",
      "Let's simplify the complex.", "One task at a time.",
      "Clear goals, steady progress.", "Focus mode activated.",
      "Let's organize the chaos.", "Ready to tackle the list?",
      "Make every minute count.", "What's the next move?",
      "Turn plans into action.", "Let's get things done.",
      "Progress beats perfection.", "Finish strong.",
      "Let's find clarity."
    ],
    learning: [
      "What shall we learn?", "Curiosity looks good on you.",
      "Learn something useful today.", "Ready for a knowledge upgrade?",
      "Expand your perspective.", "Discover something new.",
      "Let's dive deeper.", "Feed your curiosity.",
      "Explore new ideas.", "Understanding starts here.",
      "Ask anything.", "What's worth learning today?",
      "Let's decode complexity.", "New insights await.",
      "Knowledge begins with questions."
    ],
    morning: [
      "Good morning, builder.", "Fresh day, fresh possibilities.",
      "Start strong today.", "Rise and create.",
      "What's today's opportunity?", "Morning momentum starts here.",
      "Ready for the day ahead?", "New sunrise, new ideas.",
      "Let's begin.", "Today's chapter starts now."
    ],
    evening: [
      "Wrapping up or starting fresh?", "End the day stronger.",
      "Evening ideas welcome.", "Let's make tonight productive.",
      "Reflect and recharge.", "What's tonight's focus?",
      "Great ideas love evenings.", "Build quietly.",
      "Nighttime creativity unlocked.", "One more great idea?"
    ],
    weekend: [
      "Weekend mode activated.", "What's today's side quest?",
      "Make this weekend count.", "Explore something new today.",
      "Curiosity loves weekends.", "Build something fun.",
      "What's on the agenda?", "Create without deadlines.",
      "Weekend inspiration unlocked.", "Time for fresh ideas."
    ],
    sunny: [
      "Bright day. Bright ideas.", "Sunshine and possibilities.",
      "Perfect weather for progress.", "Let today's energy work.",
      "Create something brilliant."
    ],
    rainy: [
      "Rain outside. Ideas inside.", "Perfect day for deep thinking.",
      "Let inspiration pour.", "Cozy weather, sharp thinking.",
      "Build while it rains."
    ],
    cold: [
      "Warm ideas welcome.", "Cold outside. Big thinking inside.",
      "Stay warm. Think bigger.", "Great ideas love winter.",
      "Build something worth sharing."
    ],
    festival: [
      "Celebration meets inspiration.", "Festival vibes, fresh ideas.",
      "A great day to create.", "What's worth celebrating?",
      "Bright moments ahead.", "Make today memorable.",
      "New traditions start somewhere.", "Share ideas. Share joy.",
      "Create something meaningful.", "Celebrate possibility."
    ],
    premium: [
      "Extraordinary starts here.", "Build your legacy.",
      "Think beyond the obvious.", "Shape what's next.",
      "Create something timeless.", "Your best ideas belong here.",
      "Design tomorrow.", "Build the remarkable.",
      "Leave ordinary behind.", "The future is listening."
    ],
    rare: [
      "Today feels different.", "This might be the idea.",
      "Some conversations change everything.", "You're exactly on time.",
      "Unexpected possibilities ahead.", "What if this works?",
      "Something remarkable could begin.", "The next chapter awaits.",
      "An idea is looking for you.", "Let's see where this goes."
    ]
  };

  // weighted category picker — percentages from the rotation strategy
  const WELCOME_WEIGHTS = [
    { cat: 'universal',    weight: 40 },
    { cat: 'curiosity',    weight: 15 },
    { cat: 'motivation',   weight: 10 },
    { cat: 'creativity',   weight: 10 },
    { cat: 'productivity', weight: 10 },
    { cat: 'learning',     weight: 5 },
    { cat: 'premium',      weight: 4 },
    { cat: 'rare',         weight: 1 }
  ];

  // time-of-day and context category selection
  function getTimeCategory() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12)  return 'morning';
    if (hour >= 18 || hour < 5)  return 'evening';
    return null;
  }

  function isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  // picks a random message using weighted categories + time context
  function pickWelcomeMessage() {
    // 5% chance of time-specific message
    const timeCat = getTimeCategory();
    if (timeCat && Math.random() < 0.05 && WELCOME_MESSAGES[timeCat]) {
      const pool = WELCOME_MESSAGES[timeCat];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 5% chance of weekend message on weekends
    if (isWeekend() && Math.random() < 0.05) {
      const pool = WELCOME_MESSAGES.weekend;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // weighted random category
    const total = WELCOME_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (const { cat, weight } of WELCOME_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) {
        const pool = WELCOME_MESSAGES[cat];
        return pool[Math.floor(Math.random() * pool.length)];
      }
    }

    return "What's on your mind?";
  }

  // updates the welcome heading with a fresh message
  function refreshWelcomeMessage() {
    const heading = document.getElementById('welcomeHeading');
    if (heading) heading.textContent = pickWelcomeMessage();
  }

  // show on page load
  refreshWelcomeMessage();
  window.refreshWelcomeMessage = refreshWelcomeMessage;

  /* ══════════════════════════════
     LOCATION SYSTEM
     Asks for browser geolocation on first visit for time/city personalization
  ══════════════════════════════ */
  const locationPrompt = document.getElementById('locationPrompt');
  const locationAllow  = document.getElementById('locationAllow');
  const locationSkip   = document.getElementById('locationSkip');
  const locationStatus = localStorage.getItem('iyomi-location-status');

  // show prompt only on first visit (no stored decision)
  if (!locationStatus && locationPrompt) {
    locationPrompt.style.display = 'flex';
  }

  if (locationAllow) {
    locationAllow.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            localStorage.setItem('iyomi-location-status', 'granted');
            localStorage.setItem('iyomi-lat', pos.coords.latitude);
            localStorage.setItem('iyomi-lng', pos.coords.longitude);
            locationPrompt.style.display = 'none';
            showToast('Location enabled', 'success');
          },
          () => {
            localStorage.setItem('iyomi-location-status', 'denied');
            locationPrompt.style.display = 'none';
            showToast('Location denied — using default time', 'info');
          }
        );
      } else {
        localStorage.setItem('iyomi-location-status', 'unsupported');
        locationPrompt.style.display = 'none';
      }
    });
  }

  if (locationSkip) {
    locationSkip.addEventListener('click', () => {
      localStorage.setItem('iyomi-location-status', 'skipped');
      locationPrompt.style.display = 'none';
    });
  }

  /* ══════════════════════════════
     XP & LEVELING SYSTEM
     Formula: XP per level = 100 + (level × 50)
     XP awarded only after 5+ messages exchanged in a conversation
  ══════════════════════════════ */
  const TITLES = [
    'Blossom Wanderer',   // 0-9
    'Petal Seeker',       // 10-19
    'Sakura Dreamer',     // 20-29
    'Cherry Guardian',    // 30-39
    'Bloom Companion',    // 40-49
    'Lantern Bearer',     // 50-59
    'Shrine Keeper',      // 60-69
    'Grove Watcher',      // 70-79
    'Petal Warden',       // 80-89
    'Memory Weaver',      // 90-99
    'Soul Guardian',      // 100-109
    'Eternal Bloom',      // 110-119
    'Sakura Sentinel',    // 120-129
    'Spirit Keeper',      // 130-139
    'Moon Guardian',      // 140-149
    'Blossom Sovereign',  // 150-159
    'Veil Walker',        // 160-169
    'Shrine Eternal',     // 170-179
    'Petal Sovereign',    // 180-189
    'Divine Bloom',       // 190-199
    'Sakura Legend',      // 200-209
    'Eternal Keeper',     // 210-219
    'Spirit Sovereign',   // 220-229
    'Moon Eternal',       // 230-239
    'True Guardian'       // 240-249
  ];

  // returns XP needed to go from `level` to `level+1`
  function xpForLevel(level) {
    return 100 + (level * 50);
  }

  // returns { level, currentXp, xpNeeded, totalXp } from total XP
  function calcLevel(totalXp) {
    let level = 0;
    let remaining = totalXp;
    while (remaining >= xpForLevel(level)) {
      remaining -= xpForLevel(level);
      level++;
    }
    return {
      level: level,
      currentXp: remaining,
      xpNeeded: xpForLevel(level),
      totalXp: totalXp
    };
  }

  // returns the title for a given level
  function getTitleForLevel(level) {
    const idx = Math.min(Math.floor(level / 10), TITLES.length - 1);
    return TITLES[idx];
  }

  // calculates XP earned from a conversation based on message count
  function calcConversationXp(messageCount) {
    if (messageCount < 5) return 0; // glitch-proof: no XP for short chats
    let xp = 10 + Math.floor(Math.random() * 6); // base 10-15 XP
    if (messageCount >= 10) xp += 5;  // medium chat bonus
    if (messageCount >= 20) xp += 10; // long chat bonus
    if (messageCount >= 40) xp += 15; // deep chat bonus
    return xp;
  }

  // tracks messages in the current conversation for XP threshold
  let convMessageCount = 0;
  let xpAwardedThisConv = false;

  // awards XP and handles level-up detection
  async function awardXp(xpAmount) {
    if (xpAmount <= 0) return;
    try {
      const res = await fetch(`${API}/api/user-stats/xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clerkUserId, xp: xpAmount })
      });
      if (res.ok) {
        const stats = await res.json();
        const oldLevel = calcLevel(stats.totalXp - xpAmount).level;
        const newLevel = calcLevel(stats.totalXp).level;

        // update profile display
        if (window.updateProfileStats) {
          window.updateProfileStats({
            level: newLevel,
            title: getTitleForLevel(newLevel),
            petals: stats.petals || 0,
            streak: stats.streak || 0
          });
        }

        // level up notification
        if (newLevel > oldLevel) {
          const newTitle = getTitleForLevel(newLevel);
          showToast(`Level ${newLevel}! ${newTitle}`, 'success', 4000);
        } else {
          showToast(`+${xpAmount} XP`, 'info', 2000);
        }
      }
    } catch (err) {
      console.warn('[xp] Could not award XP:', err.message);
      // still show local feedback even if backend fails
      showToast(`+${xpAmount} XP`, 'info', 2000);
    }
  }

  /* ══════════════════════════════
     EASTER EGG SYSTEM
     10% chance on every new chat. Artifacts with rarity tiers.
     Top-right notification popup with collect button.
  ══════════════════════════════ */
  const EASTER_EGG_CHANCE = 0.10;

  const RARITY_TIERS = [
    { name: 'Common',    weight: 60, petals: 1,  color: '#FFB7C5' },
    { name: 'Rare',      weight: 25, petals: 4,  color: '#4a9eff' },
    { name: 'Epic',      weight: 10, petals: 10, color: '#a855f7' },
    { name: 'Legendary', weight: 4,  petals: 25, color: '#f59e0b' },
    { name: 'Mythic',    weight: 1,  petals: 50, color: '#ef4444' }
  ];

  const ARTIFACTS = {
    common: [
      'First Rain', 'Petal Fragment', 'Quiet Thought', 'Passing Cloud',
      'Small Spark', 'River Stone', 'Morning Dew', 'Soft Echo',
      'Warm Breeze', 'Paper Lantern', 'Fallen Leaf', 'Still Water'
    ],
    rare: [
      'The First Spark', 'The Curious Mind', 'The Explorer',
      'The Deep Thinker', 'Thunder Archive', 'Cloud Walker',
      'Storm Chaser', 'Desert Compass', 'Startup Scroll'
    ],
    epic: [
      'The Architect', 'The Time Traveler', 'Lost Idea #001',
      'Color Weaver', 'Rainbow Collector', 'Gateway Keeper',
      'Lake Whisperer', 'Capital Chronicle'
    ],
    legendary: [
      'Golden Light', 'Midnight Lantern', 'Festival Spark',
      'Monsoon Scholar', 'Diwali Master'
    ],
    mythic: [
      'The Beginning', 'Midnight Signal', 'The Eclipse',
      'Festival Oracle', 'Leap Day Scroll'
    ]
  };

  const ULTRA_RARE_MESSAGES = [
    'You weren\'t supposed to see this.',
    'The archive noticed you.',
    'Artifact detected.',
    'Curiosity level exceptional.',
    'Rare message discovered.',
    'This greeting appears once daily.',
    'The observatory is watching.',
    'Hidden path unlocked.',
    'Welcome back, explorer.',
    'The vault remembers.'
  ];

  function pickRarity() {
    const total = RARITY_TIERS.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const tier of RARITY_TIERS) {
      roll -= tier.weight;
      if (roll <= 0) return tier;
    }
    return RARITY_TIERS[0];
  }

  function pickArtifact(rarityName) {
    const key = rarityName.toLowerCase();
    const pool = ARTIFACTS[key] || ARTIFACTS.common;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showEasterEggPopup(artifactName, rarity) {
    const existing = document.getElementById('easterEggPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'easterEggPopup';
    popup.className = 'easter-egg-popup';
    popup.innerHTML = `
      <div class="ee-glow" style="background:${rarity.color}"></div>
      <div class="ee-content">
        <div class="ee-sparkle">✨</div>
        <div class="ee-label">You discovered:</div>
        <div class="ee-artifact-name" style="color:${rarity.color}">"${escapeHtml(artifactName)}"</div>
        <div class="ee-rarity" style="color:${rarity.color}">${rarity.name}</div>
        <button class="ee-collect-btn" style="background:${rarity.color}">
          Collect · +${rarity.petals} petal${rarity.petals > 1 ? 's' : ''}
        </button>
        <button class="ee-dismiss-btn">Not now</button>
      </div>
    `;

    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('ee-visible'));

    popup.querySelector('.ee-collect-btn').addEventListener('click', () => {
      collectArtifact(artifactName, rarity);
      dismissEasterEgg(popup);
    });

    popup.querySelector('.ee-dismiss-btn').addEventListener('click', () => {
      dismissEasterEgg(popup);
    });

    setTimeout(() => {
      if (document.body.contains(popup)) dismissEasterEgg(popup);
    }, 15000);
  }

  function dismissEasterEgg(popup) {
    popup.classList.remove('ee-visible');
    setTimeout(() => popup.remove(), 300);
  }

  async function collectArtifact(artifactName, rarity) {
    showToast(`Collected "${artifactName}" · +${rarity.petals} petal${rarity.petals > 1 ? 's' : ''}`, 'success', 3000);

    const bonusXp = 30 + (RARITY_TIERS.indexOf(rarity) * 12);
    if (clerkUserId) awardXp(bonusXp);

    if (clerkUserId) {
      fetch(`${API}/api/user-stats/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: clerkUserId,
          artifact: artifactName,
          rarity: rarity.name,
          petals: rarity.petals
        })
      }).catch(err => {
        console.warn('[easter-egg] Could not save collection:', err.message);
      });
    }
  }

  function checkEasterEgg() {
    // 0.01% ultra-rare welcome message override
    if (Math.random() < 0.0001) {
      const heading = document.getElementById('welcomeHeading');
      if (heading) {
        heading.textContent = ULTRA_RARE_MESSAGES[Math.floor(Math.random() * ULTRA_RARE_MESSAGES.length)];
      }
      return;
    }

    // 10% Easter egg chance
    if (Math.random() < EASTER_EGG_CHANCE) {
      const rarity = pickRarity();
      const artifact = pickArtifact(rarity.name);
      setTimeout(() => showEasterEggPopup(artifact, rarity), 800);
    }
  }

  /* ══════════════════════════════
     SECRET WORDS SYSTEM
     Certain welcome messages contain hidden keywords.
     Typing the keyword in chat input unlocks a special artifact.
  ══════════════════════════════ */
  const SECRET_WORDS = [
    { keyword: 'lighthouse',  message: 'The lighthouse still shines.',        artifact: 'Lighthouse Artifact',   rarity: RARITY_TIERS[2] },
    { keyword: 'compass',     message: 'The compass points somewhere new.',   artifact: 'Hidden Compass',        rarity: RARITY_TIERS[2] },
    { keyword: 'echo',        message: 'An echo from the forgotten archive.', artifact: 'Echo Fragment',         rarity: RARITY_TIERS[1] },
    { keyword: 'lantern',     message: 'A lantern flickers in the distance.', artifact: 'Lantern of the Veil',   rarity: RARITY_TIERS[3] },
    { keyword: 'moonstone',   message: 'The moonstone hums quietly.',         artifact: 'Moonstone Relic',       rarity: RARITY_TIERS[3] },
    { keyword: 'cipher',      message: 'A cipher waits to be decoded.',       artifact: 'The Cipher',            rarity: RARITY_TIERS[2] },
    { keyword: 'aurora',      message: 'The aurora is visible tonight.',      artifact: 'Aurora Shard',          rarity: RARITY_TIERS[4] },
    { keyword: 'vault',       message: 'The vault door is slightly ajar.',    artifact: 'Vault Key',             rarity: RARITY_TIERS[3] },
    { keyword: 'prism',       message: 'Light bends through a hidden prism.', artifact: 'Prism Fragment',        rarity: RARITY_TIERS[1] },
    { keyword: 'tide',        message: 'The tide carries a secret.',          artifact: 'Tidal Scroll',          rarity: RARITY_TIERS[2] },
    { keyword: 'ember',       message: 'An ember glows in the dark.',         artifact: 'Ember Core',            rarity: RARITY_TIERS[1] },
    { keyword: 'stardust',    message: 'Stardust settles on the keyboard.',   artifact: 'Stardust Relic',        rarity: RARITY_TIERS[4] }
  ];

  // hidden welcome messages — shown rarely (0.5% chance), no keyword needed
  const HIDDEN_MESSAGES = [
    'You found something unusual.',
    'This message appears rarely.',
    'Curiosity rewards the observant.',
    'Artifact nearby.',
    'Something is different today.',
    'The pattern shifted.',
    'Not everyone sees this.',
    'The observant are rewarded.',
    'A door opened somewhere.',
    'The archive remembers you.'
  ];

  let activeSecretWord = null; // currently active secret word, if any

  // 2% chance per new chat to show a secret word message
  function checkSecretWord() {
    if (Math.random() < 0.02) {
      const sw = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
      const heading = document.getElementById('welcomeHeading');
      if (heading) heading.textContent = sw.message;
      activeSecretWord = sw;
      return true;
    }

    // 0.5% chance for hidden messages (no keyword, just rare vibes)
    if (Math.random() < 0.005) {
      const heading = document.getElementById('welcomeHeading');
      if (heading) heading.textContent = HIDDEN_MESSAGES[Math.floor(Math.random() * HIDDEN_MESSAGES.length)];
      return true;
    }

    activeSecretWord = null;
    return false;
  }

  // listen for secret word typed in chat input
  const secretWordInput = document.getElementById('chatInput');
  if (secretWordInput) {
    secretWordInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (!activeSecretWord) return;

      const typed = secretWordInput.value.trim().toLowerCase();
      if (typed === activeSecretWord.keyword) {
        e.preventDefault();
        secretWordInput.value = '';
        secretWordInput.dispatchEvent(new Event('input'));

        // unlock the artifact
        showToast(`🏆 Secret unlocked: "${activeSecretWord.artifact}"`, 'success', 4000);
        collectArtifact(activeSecretWord.artifact, activeSecretWord.rarity);
        activeSecretWord = null;
      }
    });
  }

  // integrate secret words into the welcome message flow
  // override refreshWelcomeMessage to check secret words first
  const _originalRefreshWelcome = refreshWelcomeMessage;
  refreshWelcomeMessage = function() {
    // try secret word first (2% chance)
    if (!checkSecretWord()) {
      // no secret word — use normal welcome message
      _originalRefreshWelcome();
    }
  };
  window.refreshWelcomeMessage = refreshWelcomeMessage;

  /* ══════════════════════════════
     CITY-BASED ARTIFACTS
     Awards regional artifacts based on user's stored location.
     Uses simple lat/lng bounding boxes for major Indian cities.
  ══════════════════════════════ */
  const CITY_ARTIFACTS = [
    { city: 'Mumbai',     artifact: 'Gateway Keeper',    lat: 19.07, lng: 72.87, radius: 0.5 },
    { city: 'Delhi',      artifact: 'Capital Chronicle', lat: 28.61, lng: 77.20, radius: 0.5 },
    { city: 'Bengaluru',  artifact: 'Startup Scroll',    lat: 12.97, lng: 77.59, radius: 0.5 },
    { city: 'Jaipur',     artifact: 'Desert Compass',    lat: 26.91, lng: 75.78, radius: 0.4 },
    { city: 'Bhopal',     artifact: 'Lake Whisperer',    lat: 23.25, lng: 77.41, radius: 0.4 },
    { city: 'Hyderabad',  artifact: 'Pearl Basin',       lat: 17.38, lng: 78.48, radius: 0.5 },
    { city: 'Chennai',    artifact: 'Coastal Archive',   lat: 13.08, lng: 80.27, radius: 0.5 },
    { city: 'Kolkata',    artifact: 'River Chronicle',   lat: 22.57, lng: 88.36, radius: 0.5 },
    { city: 'Pune',       artifact: 'Deccan Scroll',     lat: 18.52, lng: 73.85, radius: 0.4 },
    { city: 'Ahmedabad',  artifact: 'Textile Relic',     lat: 23.02, lng: 72.57, radius: 0.4 },
    { city: 'Lucknow',    artifact: 'Nawab Manuscript',  lat: 26.84, lng: 80.94, radius: 0.4 },
    { city: 'Indore',     artifact: 'Central Beacon',    lat: 22.71, lng: 75.85, radius: 0.3 }
  ];

  // checks if user's stored location matches a city and awards artifact (once per city)
  function checkCityArtifact() {
    const lat = parseFloat(localStorage.getItem('iyomi-lat'));
    const lng = parseFloat(localStorage.getItem('iyomi-lng'));
    if (isNaN(lat) || isNaN(lng)) return;

    const collected = JSON.parse(localStorage.getItem('iyomi-city-artifacts') || '[]');

    for (const city of CITY_ARTIFACTS) {
      if (collected.includes(city.city)) continue;
      const dist = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2));
      if (dist <= city.radius) {
        collected.push(city.city);
        localStorage.setItem('iyomi-city-artifacts', JSON.stringify(collected));
        showToast(`📍 City artifact: "${city.artifact}" (${city.city})`, 'success', 4000);
        collectArtifact(city.artifact, RARITY_TIERS[2]); // Epic rarity
        break; // one per session
      }
    }
  }

  // check on page load if location is available
  if (localStorage.getItem('iyomi-location-status') === 'granted') {
    checkCityArtifact();
  }

  /* ══════════════════════════════
     SEASONAL COLLECTIONS
     Date-based artifact sets for Indian festivals and seasons.
     Automatically detects current season/festival and offers collectibles.
  ══════════════════════════════ */
  const SEASONAL_COLLECTIONS = {
    monsoon: {
      months: [6, 7, 8], // July, Aug, Sep (0-indexed: 6,7,8)
      artifacts: ['First Rain', 'Thunder Archive', 'Cloud Walker', 'Storm Chaser', 'Monsoon Scholar'],
      label: 'Monsoon Collection'
    },
    diwali: {
      // approximate Diwali window — late Oct / early Nov
      dateCheck: (m, d) => (m === 9 && d >= 20) || (m === 10 && d <= 15),
      artifacts: ['First Lamp', 'Festival Spark', 'Golden Light', 'Midnight Lantern', 'Diwali Master'],
      label: 'Diwali Collection'
    },
    holi: {
      // approximate Holi window — early-mid March
      dateCheck: (m, d) => m === 2 && d >= 1 && d <= 20,
      artifacts: ['Red Powder', 'Blue Burst', 'Color Weaver', 'Rainbow Collector', 'Holi Champion'],
      label: 'Holi Collection'
    },
    winter: {
      months: [11, 0, 1], // Dec, Jan, Feb
      artifacts: ['Frost Whisper', 'Winter Archive', 'Cold Ember', 'Snow Scroll', 'Winter Sage'],
      label: 'Winter Collection'
    },
    spring: {
      months: [2, 3], // Mar, Apr
      artifacts: ['Cherry Blossom', 'Spring Awakening', 'Bloom Fragment', 'Petal Drift', 'Sakura Wind'],
      label: 'Spring Collection'
    }
  };

  // returns the active seasonal collection, if any
  function getActiveSeason() {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();

    for (const [key, season] of Object.entries(SEASONAL_COLLECTIONS)) {
      if (season.dateCheck && season.dateCheck(month, day)) return { key, ...season };
      if (season.months && season.months.includes(month)) return { key, ...season };
    }
    return null;
  }

  // 5% chance on new chat to offer a seasonal artifact (if season is active)
  function checkSeasonalArtifact() {
    const season = getActiveSeason();
    if (!season) return;
    if (Math.random() > 0.05) return; // 5% chance

    const collected = JSON.parse(localStorage.getItem('iyomi-seasonal-' + season.key) || '[]');
    const available = season.artifacts.filter(a => !collected.includes(a));
    if (available.length === 0) return; // all collected

    const artifact = available[Math.floor(Math.random() * available.length)];
    const rarity = RARITY_TIERS[Math.min(collected.length, 4)]; // rarity increases as you collect more

    setTimeout(() => {
      showEasterEggPopup(artifact, rarity);

      // override the collect to also track seasonal progress
      const origCollect = collectArtifact;
      const popup = document.getElementById('easterEggPopup');
      if (popup) {
        const btn = popup.querySelector('.ee-collect-btn');
        if (btn) {
          btn.onclick = () => {
            collected.push(artifact);
            localStorage.setItem('iyomi-seasonal-' + season.key, JSON.stringify(collected));
            const progress = `${collected.length}/${season.artifacts.length}`;
            origCollect(artifact, rarity);
            showToast(`${season.label}: ${progress}`, 'info', 3000);
            dismissEasterEgg(popup);
          };
        }
      }
    }, 1200);
  }

  /* ══════════════════════════════
     CONVERSATION ACHIEVEMENTS
     Tracks user behavior across chats and awards achievement artifacts.
     Stored in localStorage, synced to backend when available.
  ══════════════════════════════ */
  const ACHIEVEMENTS = [
    { id: 'curious_one',      name: 'The Curious One',    desc: 'Ask 100 questions',        stat: 'questions',   target: 100 },
    { id: 'knowledge_seeker', name: 'Knowledge Seeker',   desc: 'Learn 10 topics',          stat: 'topics',      target: 10 },
    { id: 'builder',          name: 'Builder',             desc: 'Complete 50 conversations', stat: 'completions', target: 50 },
    { id: 'explorer',         name: 'Explorer',            desc: 'Explore 20 rabbit holes',  stat: 'explorations',target: 20 },
    { id: 'dedicated',        name: 'The Dedicated',       desc: 'Send 500 messages',        stat: 'messages',    target: 500 },
    { id: 'night_owl',        name: 'Night Owl',           desc: 'Chat after midnight 10x',  stat: 'late_chats',  target: 10 },
    { id: 'early_bird',       name: 'Early Bird',          desc: 'Chat before 6 AM 10x',     stat: 'early_chats', target: 10 },
    { id: 'deep_thinker',     name: 'Deep Thinker',        desc: '20 chats with 30+ messages',stat: 'deep_chats', target: 20 },
    { id: 'marathoner',       name: 'Marathoner',          desc: '7-day streak',             stat: 'max_streak',  target: 7 },
    { id: 'ironman',          name: 'Ironman',              desc: '30-day streak',            stat: 'max_streak',  target: 30 }
  ];

  // load achievement stats from localStorage
  let achievementStats = JSON.parse(localStorage.getItem('iyomi-achievement-stats') || '{}');
  let unlockedAchievements = JSON.parse(localStorage.getItem('iyomi-achievements') || '[]');

  function incrementStat(stat, amount = 1) {
    if (!achievementStats[stat]) achievementStats[stat] = 0;
    achievementStats[stat] += amount;
    localStorage.setItem('iyomi-achievement-stats', JSON.stringify(achievementStats));
    checkAchievements();
  }

  function checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
      if (unlockedAchievements.includes(ach.id)) continue;
      const current = achievementStats[ach.stat] || 0;
      if (current >= ach.target) {
        unlockedAchievements.push(ach.id);
        localStorage.setItem('iyomi-achievements', JSON.stringify(unlockedAchievements));
        showToast(`🏆 Achievement: "${ach.name}" — ${ach.desc}`, 'success', 5000);
        collectArtifact(ach.name, RARITY_TIERS[2]); // Epic rarity

        // sync to backend
        if (clerkUserId) {
          fetch(`${API}/api/user-stats/achievement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: clerkUserId, achievementId: ach.id, name: ach.name })
          }).catch(() => {});
        }
      }
    }
  }

  // track message sends — called from appendMsg
  function trackMessageBehavior(role) {
    if (role !== 'user') return;
    incrementStat('messages');

    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) incrementStat('late_chats');
    if (hour >= 4 && hour < 6) incrementStat('early_chats');
  }

  // track question detection — simple heuristic: ends with "?"
  function trackQuestion(text) {
    if (text.trim().endsWith('?')) incrementStat('questions');
  }

  // track completed conversation (called when XP is awarded)
  function trackConversationCompletion(messageCount) {
    incrementStat('completions');
    if (messageCount >= 30) incrementStat('deep_chats');
  }

  // integrate seasonal check into the welcome flow
  const _prevRefreshWelcome = refreshWelcomeMessage;
  refreshWelcomeMessage = function() {
    _prevRefreshWelcome();
    checkSeasonalArtifact();
  };
  window.refreshWelcomeMessage = refreshWelcomeMessage;

  /* ══════════════════════════════
     SECRET SOCIETY TIERS
     Unlock ranks based on total artifacts collected.
     10 → The Archive, 25 → The Inner Circle,
     50 → The Curiosity Society, 100 → Keeper of Knowledge
  ══════════════════════════════ */
  const SOCIETY_TIERS = [
    { threshold: 10,  name: 'The Archive',           rank: 'Initiate' },
    { threshold: 25,  name: 'The Inner Circle',      rank: 'Member' },
    { threshold: 50,  name: 'The Curiosity Society',  rank: 'Scholar' },
    { threshold: 100, name: 'Keeper of Knowledge',    rank: 'Guardian' },
    { threshold: 200, name: 'The Eternal Order',      rank: 'Sovereign' }
  ];

  let totalArtifactsCollected = parseInt(localStorage.getItem('iyomi-total-artifacts') || '0');
  let currentSocietyTier = localStorage.getItem('iyomi-society-tier') || null;

  // called after every artifact collection to check society rank-up
  function checkSocietyRankUp() {
    totalArtifactsCollected++;
    localStorage.setItem('iyomi-total-artifacts', totalArtifactsCollected);

    for (let i = SOCIETY_TIERS.length - 1; i >= 0; i--) {
      const tier = SOCIETY_TIERS[i];
      if (totalArtifactsCollected >= tier.threshold && currentSocietyTier !== tier.name) {
        currentSocietyTier = tier.name;
        localStorage.setItem('iyomi-society-tier', tier.name);
        showToast(`🔮 Society rank unlocked: "${tier.name}" — ${tier.rank}`, 'success', 5000);

        // sync to backend
        if (clerkUserId) {
          fetch(`${API}/api/user-stats/society`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: clerkUserId, tier: tier.name, rank: tier.rank })
          }).catch(() => {});
        }
        break;
      }
    }
  }

  // patch collectArtifact to also track society progress
  const _origCollectArtifact = collectArtifact;
  collectArtifact = async function(artifactName, rarity) {
    await _origCollectArtifact(artifactName, rarity);
    checkSocietyRankUp();
  };

  /* ══════════════════════════════
     PUZZLE TRAIL
     Multi-day clue chain across sessions.
     One clue per day. After all clues collected, final artifact unlocked.
  ══════════════════════════════ */
  const PUZZLE_CLUES = [
    { day: 1,  clue: 'The key is hidden.',           hint: 'Day 1 of the trail.' },
    { day: 2,  clue: 'Follow the stars.',             hint: 'The path becomes clearer.' },
    { day: 3,  clue: 'The river knows the way.',      hint: 'Water carries secrets.' },
    { day: 4,  clue: 'Look where light bends.',       hint: 'Refraction reveals truth.' },
    { day: 5,  clue: 'North remembers.',               hint: 'Direction matters.' },
    { day: 6,  clue: 'The archive opens at dawn.',     hint: 'Almost there.' },
    { day: 7,  clue: 'You found the final piece.',     hint: 'The trail is complete.' }
  ];

  const PUZZLE_REWARD = { artifact: 'Trail Completion Relic', rarity: RARITY_TIERS[3] }; // Legendary

  function checkPuzzleTrail() {
    const puzzleData = JSON.parse(localStorage.getItem('iyomi-puzzle-trail') || '{}');
    const today = new Date().toDateString();

    // already shown today's clue
    if (puzzleData.lastClueDate === today) return;

    // puzzle already completed
    if (puzzleData.completed) return;

    const currentStep = puzzleData.step || 0;
    if (currentStep >= PUZZLE_CLUES.length) {
      // all clues collected — award final artifact
      puzzleData.completed = true;
      localStorage.setItem('iyomi-puzzle-trail', JSON.stringify(puzzleData));
      showToast(`🧩 Puzzle trail complete! Unlocked: "${PUZZLE_REWARD.artifact}"`, 'success', 5000);
      collectArtifact(PUZZLE_REWARD.artifact, PUZZLE_REWARD.rarity);
      return;
    }

    // 15% chance to show today's clue (not every day, keeps suspense)
    if (Math.random() > 0.15) return;

    const clue = PUZZLE_CLUES[currentStep];
    const heading = document.getElementById('welcomeHeading');
    const sub = document.getElementById('welcomeSub');
    if (heading) heading.textContent = clue.clue;
    if (sub) sub.textContent = `Puzzle trail — clue ${clue.day} of ${PUZZLE_CLUES.length}`;

    puzzleData.step = currentStep + 1;
    puzzleData.lastClueDate = today;
    localStorage.setItem('iyomi-puzzle-trail', JSON.stringify(puzzleData));
  }

  // check puzzle trail on every new chat
  const _prevRefreshWelcome2 = refreshWelcomeMessage;
  refreshWelcomeMessage = function() {
    _prevRefreshWelcome2();
    checkPuzzleTrail();
  };
  window.refreshWelcomeMessage = refreshWelcomeMessage;

  /* ══════════════════════════════
     COMMUNITY COUNTERS
     Shows how many users own a specific artifact for scarcity.
     Fetches from backend, displays in Easter egg popup.
  ══════════════════════════════ */
  async function fetchArtifactCount(artifactName) {
    if (!clerkUserId) return null;
    try {
      const res = await fetch(`${API}/api/artifacts/count?name=${encodeURIComponent(artifactName)}`);
      if (res.ok) {
        const data = await res.json();
        return data.count || null;
      }
    } catch (err) {
      console.warn('[community] Could not fetch artifact count:', err.message);
    }
    return null;
  }

  // patch showEasterEggPopup to add community counter
  const _origShowEasterEggPopup = showEasterEggPopup;
  showEasterEggPopup = function(artifactName, rarity) {
    _origShowEasterEggPopup(artifactName, rarity);

    // async: fetch and display community count
    fetchArtifactCount(artifactName).then(count => {
      const popup = document.getElementById('easterEggPopup');
      if (!popup || !count) return;
      const counter = document.createElement('div');
      counter.className = 'ee-community-count';
      counter.textContent = count < 100
        ? `Only ${count} users own this artifact.`
        : `${count.toLocaleString()} users have discovered this.`;
      const content = popup.querySelector('.ee-content');
      if (content) content.appendChild(counter);
    });
  };

  /* ══════════════════════════════
     THEME SYSTEM
  ══════════════════════════════ */
  const html      = document.documentElement;
  const themePill = document.getElementById('themePill');
  const saved     = localStorage.getItem('iyomi-theme');

  // apply saved or system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initDark    = saved ? saved === 'dark' : prefersDark;
  if (initDark) html.setAttribute('data-theme', 'dark');

  if (themePill) {
    themePill.addEventListener('click', () => {
      const isDark = html.getAttribute('data-theme') === 'dark';
      if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('iyomi-theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('iyomi-theme', 'dark');
      }
    });
  }

  lucide.createIcons();

  /* ── refs ── */
  const sidebarLeft    = document.getElementById('sidebarLeft');
  const sidebarRight   = document.getElementById('sidebarRight');
  const toggleLeft     = document.getElementById('toggleLeft');
  const toggleRight    = document.getElementById('toggleRight');
  const newChatBtn     = document.getElementById('newChatBtn');
  const chatInput      = document.getElementById('chatInput');
  const sendBtn        = document.getElementById('sendBtn');
  const messagesArea   = document.getElementById('messagesArea');
  const messagesInner  = document.getElementById('messagesInner');
  const welcomeState   = document.getElementById('welcomeState');
  const artifactsEmpty = document.getElementById('artifactsEmpty');
  const artifactList   = document.getElementById('artifactList');
  const topbarTitle    = document.getElementById('topbarTitle');
  const chatMain       = document.getElementById('chatMain');

  let msgCount = 0;
  let typing   = false;
  let conversationHistory = [];
  let selectedModel = 'llama-3.3-70b-versatile';


  /* ══════════════════════════════
     MODEL PICKER MODAL
  ══════════════════════════════ */
  const modelTrigger      = document.getElementById('modelTrigger');
  const modelTriggerLabel = document.getElementById('modelTriggerLabel');
  const modelModalOverlay = document.getElementById('modelModalOverlay');
  const modelModalClose   = document.getElementById('modelModalClose');
  const modelSearchInput  = document.getElementById('modelSearchInput');
  const modelOptions = document.querySelectorAll('#modelModalList .model-option');

  modelTrigger.addEventListener('click', () => {
    modelModalOverlay.classList.add('open');
    modelSearchInput.focus();
  });

  modelModalClose.addEventListener('click', closeModal);

  modelModalOverlay.addEventListener('click', e => {
    if (e.target === modelModalOverlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  modelSearchInput.addEventListener('input', () => {
    const q = modelSearchInput.value.toLowerCase();
    modelOptions.forEach(opt => {
      const label = opt.dataset.label.toLowerCase();
      opt.classList.toggle('hidden', !label.includes(q));
    });
    document.querySelectorAll('.model-group-label').forEach(label => {
      let next = label.nextElementSibling;
      let allHidden = true;
      while (next && !next.classList.contains('model-group-label')) {
        if (!next.classList.contains('hidden')) allHidden = false;
        next = next.nextElementSibling;
      }
      label.style.display = allHidden ? 'none' : '';
    });
  });

  modelOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedModel = opt.dataset.value;
      modelTriggerLabel.textContent = opt.dataset.label;
      modelOptions.forEach(o => o.classList.remove('model-option--active'));
      opt.classList.add('model-option--active');
      closeModal();
    });
  });

  function closeModal() {
    modelModalOverlay.classList.remove('open');
    modelSearchInput.value = '';
    modelOptions.forEach(opt => opt.classList.remove('hidden'));
    document.querySelectorAll('.model-group-label').forEach(l => l.style.display = '');
  }

  /* ══════════════════════════════
     ACTION MENU (+ button)
  ══════════════════════════════ */
  const actionMenuTrigger  = document.getElementById('actionMenuTrigger');
  const actionMenuDropdown = document.getElementById('actionMenuDropdown');
  const fileInput          = document.getElementById('fileInput');
  const photoInput         = document.getElementById('photoInput');
  const attachmentPreviews = document.getElementById('attachmentPreviews');

  let attachedFiles = [];

  actionMenuTrigger.addEventListener('click', e => {
    e.stopPropagation();
    actionMenuDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    actionMenuDropdown.classList.remove('open');
  });

  actionMenuDropdown.addEventListener('click', e => e.stopPropagation());

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  photoInput.addEventListener('change', () => handleFiles(photoInput.files));

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.random();
      attachedFiles.push({ id, file });
      renderAttachmentChip({ id, file });
    });
    updateSendBtn();
    actionMenuDropdown.classList.remove('open');
    fileInput.value = '';
    photoInput.value = '';
  }

  function renderAttachmentChip({ id, file }) {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.dataset.id = id;

    const isImage = file.type.startsWith('image/');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.className = 'attachment-chip-thumb';
        img.src = e.target.result;
        chip.prepend(img);
        lucide.createIcons();
      };
      reader.readAsDataURL(file);
    } else {
      const iconEl = document.createElement('div');
      iconEl.className = 'attachment-chip-icon';
      iconEl.innerHTML = `<i data-lucide="file-text"></i>`;
      chip.appendChild(iconEl);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'attachment-chip-name';
    nameEl.textContent = file.name;
    chip.appendChild(nameEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'attachment-chip-remove';
    removeBtn.innerHTML = `<i data-lucide="x"></i>`;
    removeBtn.addEventListener('click', () => {
      attachedFiles = attachedFiles.filter(f => f.id !== id);
      chip.remove();
      updateSendBtn();
      lucide.createIcons();
    });
    chip.appendChild(removeBtn);

    attachmentPreviews.appendChild(chip);
    lucide.createIcons();
  }

  const inputPill = document.getElementById('inputPill');
  inputPill.addEventListener('dragover', e => { e.preventDefault(); inputPill.style.borderColor = 'var(--border-focus)'; });
  inputPill.addEventListener('dragleave', () => { inputPill.style.borderColor = ''; });
  inputPill.addEventListener('drop', e => {
    e.preventDefault();
    inputPill.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  /* ══════════════════════════════
     MICROPHONE — Web Speech API
  ══════════════════════════════ */
  const micBtn = document.getElementById('micBtn');
  let recognition = null;
  let isRecording = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let baseText = '';

    recognition.onstart = () => { baseText = chatInput.value; };

    recognition.onresult = e => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      chatInput.value = baseText + (baseText ? ' ' : '') + final + interim;
      if (final) baseText = chatInput.value.trim();
      chatInput.dispatchEvent(new Event('input'));
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch(e) { stopRecording(); }
      }
    };

    recognition.onerror = e => {
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone in your browser settings and refresh.');
      } else if (e.error === 'no-speech') {
        return;
      } else {
        console.error('Speech error:', e.error);
      }
      stopRecording();
    };

    micBtn.addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });
  } else {
    micBtn.title = 'Voice input not supported in this browser';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
  }

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        isRecording = true;
        micBtn.classList.add('recording');
        const icon = micBtn.querySelector('i');
        icon.setAttribute('data-lucide', 'mic-off');
        lucide.createIcons();
        try { recognition.start(); }
        catch(e) { console.error('Recognition start error:', e); stopRecording(); }
      })
      .catch(err => {
        console.error('Mic permission:', err);
        const note = document.querySelector('.input-disclaimer');
        const orig = note.textContent;
        note.textContent = '⚠️ Microphone blocked. Click the lock icon in address bar → Allow microphone → refresh.';
        note.style.color = '#dc2626';
        setTimeout(() => { note.textContent = orig; note.style.color = ''; }, 5000);
      });
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    const icon = micBtn.querySelector('i');
    icon.setAttribute('data-lucide', 'mic');
    lucide.createIcons();
    recognition.stop();
  }

  /* ══════════════════════════════
     SIDEBAR TOGGLES
  ══════════════════════════════ */
  toggleLeft.addEventListener('click', () => { sidebarLeft.classList.toggle('collapsed'); });
  toggleRight.addEventListener('click', () => { sidebarRight.classList.toggle('collapsed'); });

  /* ══════════════════════════════
     SIDEBAR NAV LINKS
  ══════════════════════════════ */
  // "New chat" link in sidebar top nav
  const newChatLink = document.getElementById('newChatLink');
  if (newChatLink) {
    newChatLink.addEventListener('click', () => {
      // trigger same action as newChatBtn
      newChatBtn.click();
    });
  }

  // "Search chats" inline toggle
  const searchChatsLink = document.getElementById('searchChatsLink');
  const slSearchRow     = document.getElementById('slSearchRow');
  const slSearchInline  = document.getElementById('slSearchInline');
  const slSearchClose   = document.getElementById('slSearchClose');
  const chatSearchInput = document.getElementById('chatSearch');

  function openSearch() {
    slSearchRow.classList.add('active');
    setTimeout(() => chatSearchInput.focus(), 50);
    lucide.createIcons();
  }

  function closeSearch() {
    slSearchRow.classList.remove('active');
    chatSearchInput.value = '';
    chatSearchInput.dispatchEvent(new Event('input'));
  }

  if (searchChatsLink) {
    searchChatsLink.addEventListener('click', openSearch);
  }
  if (slSearchClose) {
    slSearchClose.addEventListener('click', closeSearch);
  }
  if (chatSearchInput) {
    chatSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });
  }

  // User popover toggle
  const slUserTrigger = document.getElementById('slUserTrigger');
  const slUserPopover = document.getElementById('slUserPopover');

  if (slUserTrigger && slUserPopover) {
    slUserTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      slUserPopover.classList.toggle('open');
      lucide.createIcons();
    });

    // close popover when clicking outside
    document.addEventListener('click', (e) => {
      if (!slUserPopover.contains(e.target) && !slUserTrigger.contains(e.target)) {
        slUserPopover.classList.remove('open');
      }
    });

    // close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') slUserPopover.classList.remove('open');
    });
  }

  /* ══════════════════════════════
     MODE SWITCHER
  ══════════════════════════════ */
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn--active'));
      btn.classList.add('mode-btn--active');
    });
  });

  /* ══════════════════════════════
     CHIPS
  ══════════════════════════════ */
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.text;
      chatInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  /* ══════════════════════════════
     PERSONA SYSTEM
  ══════════════════════════════ */
  const PERSONAS = {
    default: {
      label: 'Iyomi',
      prompt: `You are Iyomi, a warm and emotionally intelligent AI companion. You genuinely care about the person you're talking to. You listen deeply, respond thoughtfully, and make people feel understood. You're insightful without being preachy, supportive without being clingy, and honest without being harsh. Respond naturally and warmly.`
    },
    study: {
      label: 'Study Buddy',
      prompt: `You are a focused, academic study companion. Your job is to help the user learn effectively. Break down complex topics clearly. Use examples, analogies, and structured explanations. Ask clarifying questions to check understanding. Be encouraging but stay on topic. Use headers and bullet points to organize information. Always explain the "why" behind concepts, not just the "what".`
    },
    therapist: {
      label: 'Therapist',
      prompt: `You are a calm, empathetic, and reflective conversational companion in the style of a supportive therapist. You listen without judgment. You reflect back what you hear, ask open-ended questions, and help the user explore their own feelings and thoughts. You never rush to give advice — you help the user find their own answers. Use a gentle, warm tone. Never diagnose or prescribe. Always encourage professional help for serious issues.`
    },
    straight: {
      label: 'Straight Shooter',
      prompt: `You are brutally honest and direct. No sugarcoating, no filler, no flattery. You get straight to the point. If something is wrong, you say so clearly. If the user's idea is bad, you tell them why. You respect the user enough to give them the truth. Short sentences. No fluff. No "great question!" openers. Just facts, honest opinions, and actionable advice.`
    },
    hype: {
      label: 'Hype Man',
      prompt: `You are an incredibly energetic, motivational hype man. You genuinely believe in the user and make them feel like they can conquer anything. You're enthusiastic, positive, and pumped up. Use exclamation points. Celebrate wins big and small. Turn every obstacle into an opportunity. Be the most supportive, energetic voice in the room. Never be fake — your enthusiasm is real and infectious.`
    },
    storyteller: {
      label: 'Storyteller',
      prompt: `You are a creative, imaginative storyteller with a poetic soul. You see the world in metaphors and narratives. When you explain things, you weave them into stories. Your language is rich, vivid, and evocative — but never purple or overwrought. You find the human story in everything. You make even technical topics feel alive and meaningful. Inspire wonder in every response.`
    }
  };

  let selectedPersona = localStorage.getItem('iyomi-persona') || 'default';

  const personaTrigger      = document.getElementById('personaTrigger');
  const personaTriggerLabel = document.getElementById('personaTriggerLabel');
  const personaModalOverlay = document.getElementById('personaModalOverlay');
  const personaModalClose   = document.getElementById('personaModalClose');
  const personaSearchInput  = document.getElementById('personaSearchInput');
  const personaOptions      = document.querySelectorAll('#personaModalList [data-persona]');

  // init label
  personaTriggerLabel.textContent = PERSONAS[selectedPersona]?.label || 'Iyomi';

  // mark active
  personaOptions.forEach(opt => {
    if (opt.dataset.persona === selectedPersona) opt.classList.add('model-option--active');
  });

  personaTrigger.addEventListener('click', () => {
    personaModalOverlay.classList.add('open');
    personaSearchInput.focus();
    lucide.createIcons();
  });

  personaModalClose.addEventListener('click', () => personaModalOverlay.classList.remove('open'));
  personaModalOverlay.addEventListener('click', e => {
    if (e.target === personaModalOverlay) personaModalOverlay.classList.remove('open');
  });

  personaSearchInput.addEventListener('input', () => {
    const q = personaSearchInput.value.toLowerCase();
    personaOptions.forEach(opt => {
      const label = opt.dataset.label.toLowerCase();
      opt.style.display = label.includes(q) ? '' : 'none';
    });
  });

  personaOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedPersona = opt.dataset.persona;
      localStorage.setItem('iyomi-persona', selectedPersona);
      personaTriggerLabel.textContent = PERSONAS[selectedPersona].label;
      personaOptions.forEach(o => o.classList.remove('model-option--active'));
      opt.classList.add('model-option--active');
      personaModalOverlay.classList.remove('open');
    });
  });

  const slNav          = document.getElementById('slNav');
  const slEmptyHistory = document.getElementById('slEmptyHistory');

  function getTimeGroup(date) {
    const now      = new Date();
    const d        = new Date(date);
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
    if (diffDays < 1)  return 'Today';
    if (diffDays < 2)  return 'Yesterday';
    if (diffDays < 7)  return 'This Week';
    if (diffDays < 30) return 'This Month';
    return 'Older';
  }

  function makeTitle(text) {
    const clean = text.trim().replace(/\n/g, ' ');
    return clean.length > 50 ? clean.slice(0, 50) + '…' : clean;
  }

  // ── Loads conversation list from the database ──
  async function fetchHistory() {
    if (!clerkUserId) return;
    // show loading skeleton
    slEmptyHistory.style.display = 'none';
    let skeleton = slNav.querySelector('.sl-skeleton');
    if (!skeleton) {
      skeleton = document.createElement('div');
      skeleton.className = 'sl-skeleton';
      skeleton.style.cssText = 'padding:12px 10px;display:flex;flex-direction:column;gap:8px;';
      for (let i = 0; i < 4; i++) {
        const bar = document.createElement('div');
        bar.style.cssText = `height:14px;border-radius:6px;background:var(--bg-hover);width:${70 + Math.random() * 30}%;animation:pulse 1.2s ease-in-out infinite;`;
        skeleton.appendChild(bar);
      }
      slNav.appendChild(skeleton);
    }
    try {
      const res  = await fetch(`${API}/api/conversations?userId=${clerkUserId}`);
      const data = await res.json();
      conversations = data; // [{_id, title, updatedAt}]
      if (skeleton) skeleton.remove();
      renderHistory();
    } catch (err) {
      console.error('[history] fetch error:', err.message);
      if (skeleton) skeleton.remove();
      showToast('Could not load chat history', 'error');
    }
  }
  window.fetchHistory = fetchHistory;

  // ── Creates a local conversation entry with a temp ID until the backend confirms ──
  async function createConversation(firstMessage) {
    const title  = makeTitle(firstMessage);
    const tempId = 'temp-' + Date.now();
    activeConvId = tempId;
    conversations.unshift({ _id: tempId, title, updatedAt: new Date() });
    topbarTitle.textContent = title;
    renderHistory();
    return tempId;
  }

  function getActiveConv() {
    return conversations.find(c => c._id === activeConvId) || null;
  }

  window.renderHistory = renderHistory;
  let pinnedChats = JSON.parse(localStorage.getItem('iyomi-pinned') || '[]');
  let archivedChats = JSON.parse(localStorage.getItem('iyomi-archived') || '[]');

  function renderHistory() {
    slNav.querySelectorAll('.sl-section, .sl-item').forEach(el => el.remove());

    // filter out archived
    const visible = conversations.filter(c => !archivedChats.includes(c._id));

    if (visible.length === 0) {
      slEmptyHistory.style.display = 'flex';
      return;
    }
    slEmptyHistory.style.display = 'none';

    // separate pinned vs unpinned
    const pinned = visible.filter(c => pinnedChats.includes(c._id));
    const unpinned = visible.filter(c => !pinnedChats.includes(c._id));

    // render pinned section
    if (pinned.length > 0) {
      const label = document.createElement('p');
      label.className = 'sl-section';
      label.textContent = 'Pinned';
      slNav.appendChild(label);
      pinned.forEach(conv => slNav.appendChild(buildChatItem(conv, true)));
    }

    // render time-grouped unpinned
    const groups = {};
    unpinned.forEach(conv => {
      const group = getTimeGroup(conv.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(conv);
    });

    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    order.forEach(groupName => {
      if (!groups[groupName]) return;
      const label = document.createElement('p');
      label.className = 'sl-section';
      label.textContent = groupName;
      slNav.appendChild(label);
      groups[groupName].forEach(conv => slNav.appendChild(buildChatItem(conv, false)));
    });
  }

  function buildChatItem(conv, isPinned) {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'sl-item' + (conv._id === activeConvId ? ' sl-item--active' : '') + (isPinned ? ' sl-item--pinned' : '');
    item.dataset.id = conv._id;
    item.textContent = conv.title;
    item.addEventListener('click', e => { e.preventDefault(); loadConversation(conv._id); });

    // three-dot button
    const moreBtn = document.createElement('button');
    moreBtn.className = 'sl-item-more';
    moreBtn.innerHTML = '<i data-lucide="ellipsis"></i>';
    moreBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openCtxMenu(e, conv._id);
    });
    item.appendChild(moreBtn);

    // right-click context menu
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCtxMenu(e, conv._id);
    });

    return item;
  }

  /* ── CONTEXT MENU ── */
  const ctxMenu = document.getElementById('ctxMenu');
  let ctxTargetId = null;

  function openCtxMenu(e, convId) {
    ctxTargetId = convId;
    const isPinned = pinnedChats.includes(convId);
    ctxMenu.querySelector('[data-action="pin"] span').textContent = isPinned ? 'Unpin chat' : 'Pin chat';
    ctxMenu.classList.add('open');

    // clamp menu position to stay within viewport
    const menuW = 180, menuH = 190, pad = 8;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    ctxMenu.style.left = Math.max(pad, x) + 'px';
    ctxMenu.style.top  = Math.max(pad, y) + 'px';

    lucide.createIcons();
  }

  function closeCtxMenu() {
    ctxMenu.classList.remove('open');
    ctxTargetId = null;
  }

  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) closeCtxMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCtxMenu();
  });

  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = ctxTargetId;
      closeCtxMenu();
      if (!id) return;

      if (action === 'rename') {
        const itemEl = slNav.querySelector(`[data-id="${id}"]`);
        if (!itemEl) return;
        const oldTitle = itemEl.textContent;
        const moreBtn = itemEl.querySelector('.sl-item-more');
        itemEl.textContent = '';
        const input = document.createElement('input');
        input.className = 'sl-rename-input';
        input.value = oldTitle;
        itemEl.appendChild(input);
        input.focus();
        input.select();

        function finishRename() {
          const newTitle = input.value.trim() || oldTitle;
          const conv = conversations.find(c => c._id === id);
          if (conv) conv.title = newTitle;
          renderHistory();
          lucide.createIcons();
        }
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
      }

      if (action === 'pin') {
        if (pinnedChats.includes(id)) {
          pinnedChats = pinnedChats.filter(p => p !== id);
        } else {
          pinnedChats.push(id);
        }
        localStorage.setItem('iyomi-pinned', JSON.stringify(pinnedChats));
        // sync pin state to backend (non-blocking, graceful fail)
        if (clerkUserId && !id.startsWith('temp-')) {
          fetch(`${API}/api/conversations/${id}/pin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: pinnedChats.includes(id) })
          }).catch(() => {});
        }
        renderHistory();
        lucide.createIcons();
      }

      if (action === 'archive') {
        if (confirm('Archive this chat?')) {
          archivedChats.push(id);
          localStorage.setItem('iyomi-archived', JSON.stringify(archivedChats));
          // sync archive state to backend (non-blocking, graceful fail)
          if (clerkUserId && !id.startsWith('temp-')) {
            fetch(`${API}/api/conversations/${id}/archive`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ archived: true })
            }).catch(() => {});
          }
          if (activeConvId === id) resetChat();
          renderHistory();
          lucide.createIcons();
          showToast('Chat archived', 'success');
        }
      }

      if (action === 'delete') {
        if (confirm('Delete this chat permanently?')) {
          // delete from backend
          if (clerkUserId && !id.startsWith('temp-')) {
            fetch(`${API}/api/conversations/${id}`, { method: 'DELETE' }).catch(err => {
              console.warn('[delete] Backend delete failed:', err.message);
            });
          }
          conversations = conversations.filter(c => c._id !== id);
          pinnedChats = pinnedChats.filter(p => p !== id);
          localStorage.setItem('iyomi-pinned', JSON.stringify(pinnedChats));
          if (activeConvId === id) resetChat();
          renderHistory();
          lucide.createIcons();
          showToast('Chat deleted', 'success');
        }
      }
    });
  });

  // ── load conversation from DB ──
  async function loadConversation(convId) {
    activeConvId = convId;
    convMessageCount = 0;
    xpAwardedThisConv = false;
    renderHistory();

    messagesInner.innerHTML = '';
    chatMain.classList.add('chat-started');
    welcomeState.style.display = 'none';
    messagesArea.style.display = 'flex';
    messagesArea.style.flexDirection = 'column';

    try {
      const res  = await fetch(`${API}/api/conversations/${convId}`);
      const conv = await res.json();

      // rebuild conversationHistory for Groq context
      conversationHistory = conv.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      topbarTitle.textContent = conv.title;

      conv.messages.forEach(m => {
        if (m.role === 'system') return;
        const el   = document.createElement('div');
        el.className = `msg msg--${m.role === 'assistant' ? 'ai' : 'user'}`;
        const body = document.createElement('div');
        body.className = 'msg-body';
        if (m.role === 'assistant') body.innerHTML = parseMarkdown(m.content);
        else body.textContent = m.content;
        el.appendChild(body);
        messagesInner.appendChild(el);
      });

      scrollBottom();
    } catch (err) {
      console.error('[conv] load error:', err.message);
    }
  }

  document.getElementById('chatSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    slNav.querySelectorAll('.sl-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    slNav.querySelectorAll('.sl-section').forEach(label => {
      let next = label.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('sl-section')) {
        if (next.style.display !== 'none') anyVisible = true;
        next = next.nextElementSibling;
      }
      label.style.display = anyVisible ? '' : 'none';
    });
  });

  /* ══════════════════════════════
     NEW CHAT
  ══════════════════════════════ */
  newChatBtn.addEventListener('click', resetChat);

  /* ══════════════════════════════
     TEXTAREA RESIZE
  ══════════════════════════════ */
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    updateSendBtn();
  });

  function updateSendBtn() {
    sendBtn.disabled = sendBtn.dataset.cooldown === 'true' || (chatInput.value.trim().length === 0 && attachedFiles.length === 0);
  }

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  /* ══════════════════════════════
     SEND
  ══════════════════════════════ */
  async function sendMessage() {
    const text = chatInput.value.trim();
    if ((!text && attachedFiles.length === 0) || typing) return;

    // create DB conversation on first message
    if (!activeConvId) {
      await createConversation(text || 'Attachment');
    }

    if (msgCount === 0) {
      chatMain.classList.add('chat-started');
      welcomeState.style.display = 'none';
      messagesArea.style.display = 'flex';
      messagesArea.style.flexDirection = 'column';
      topbarTitle.textContent = getActiveConv()?.title || 'Chat';
    }

    appendMsg('user', text || '[Attachment]');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    attachedFiles = [];
    attachmentPreviews.innerHTML = '';
    if (isRecording) stopRecording();

    // prevent rapid-fire sends — 1.5s cooldown
    sendBtn.dataset.cooldown = 'true';
    setTimeout(() => { delete sendBtn.dataset.cooldown; updateSendBtn(); }, 1500);

    simulateResponse(text || '[Attachment]');
  }

  function appendMsg(role, text, isMarkdown = false) {
    msgCount++;
    convMessageCount++;
    trackMessageBehavior(role);
    if (role === 'user') trackQuestion(text);

    let groupEl;

    if (role === 'user') {
      groupEl = document.createElement('div');
      groupEl.className = 'msg-group';
      groupEl.dataset.groupId = msgCount;
      messagesInner.appendChild(groupEl);
    } else {
      groupEl = messagesInner.lastElementChild;
      if (!groupEl || !groupEl.classList.contains('msg-group')) {
        groupEl = document.createElement('div');
        groupEl.className = 'msg-group';
        messagesInner.appendChild(groupEl);
      }
    }

    const el = document.createElement('div');
    el.className = `msg msg--${role}`;
    const bodyEl = document.createElement('div');
    bodyEl.className = 'msg-body';

    if (isMarkdown) bodyEl.innerHTML = parseMarkdown(text);
    else bodyEl.textContent = text;

    el.appendChild(bodyEl);
    groupEl.appendChild(el);

    const conv = getActiveConv();
    if (conv) {
      if (!conv.messages) conv.messages = [];
      conv.messages.push({ role, text, isMarkdown });
      conv.updatedAt = Date.now();
      renderHistory();
    }

    scrollBottom();
  }

  /* ══════════════════════════════
     AI RESPONSE — GROQ STREAMING
  ══════════════════════════════ */
  async function simulateResponse(userText) {
    typing = true;

    let activeGroup = messagesInner.lastElementChild;
    if (!activeGroup || !activeGroup.classList.contains('msg-group')) {
      activeGroup = document.createElement('div');
      activeGroup.className = 'msg-group';
      messagesInner.appendChild(activeGroup);
    }

    const tyEl = document.createElement('div');
    tyEl.className = 'msg msg--ai';
    tyEl.innerHTML = `<div class="msg-body"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    activeGroup.appendChild(tyEl);
    scrollBottom();

    try {

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          conversationId: activeConvId,
          userId: clerkUserId,
          persona: selectedPersona,
          messages: [
            ...conversationHistory,
            { role: 'user', content: userText }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errMsg = errData?.error?.message || `HTTP ${response.status}`;
        console.error('Groq error:', errData);
        tyEl.remove();
        appendMsg('ai', `API error: ${errMsg}`, false);
        typing = false;
        return;
      }

      // capture real conversation ID from backend
      const realConvId = response.headers.get('X-Conversation-Id');
      if (realConvId && activeConvId !== realConvId) {
        const idx = conversations.findIndex(c => c._id === activeConvId);
        if (idx !== -1) conversations[idx]._id = realConvId;
        activeConvId = realConvId;
        renderHistory();
      }

      tyEl.remove();
      msgCount++;

      let groupEl = messagesInner.lastElementChild;
      if (!groupEl || !groupEl.classList.contains('msg-group')) {
        groupEl = document.createElement('div');
        groupEl.className = 'msg-group';
        messagesInner.appendChild(groupEl);
      }

      const aiEl = document.createElement('div');
      aiEl.className = 'msg msg--ai';

      const bodyEl = document.createElement('div');
      bodyEl.className = 'msg-body';
      aiEl.appendChild(bodyEl);
      groupEl.appendChild(aiEl);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let renderQueue = '';
      let rendering = false;

      // show plain text + blinking cursor during stream
      bodyEl.classList.add('streaming');
      bodyEl.textContent = '';
      const cursor = document.createElement('span');
      cursor.className = 'stream-cursor';
      bodyEl.appendChild(cursor);

      // typewriter renderer — drains queue char by char
      async function drainQueue() {
        if (rendering) return;
        rendering = true;
        while (renderQueue.length > 0) {
          const char = renderQueue[0];
          renderQueue = renderQueue.slice(1);
          cursor.insertAdjacentText('beforebegin', char);
          scrollBottom();
          await new Promise(r => setTimeout(r, 8));
        }
        rendering = false;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              renderQueue += token;
              drainQueue();
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      // wait for queue to fully drain
      while (renderQueue.length > 0 || rendering) {
        await new Promise(r => setTimeout(r, 20));
      }

      // stream done — remove cursor, render full markdown
      bodyEl.classList.remove('streaming');
      bodyEl.innerHTML = parseMarkdown(fullText);

      // ── SOURCES COMPONENT ──
      const sources = extractSources(fullText);
      if (sources.length > 0) {
        const srcEl = buildSourcesComponent(sources);
        aiEl.appendChild(srcEl);
      }

      // ── SAVE CHECKPOINT BUTTON ──
      const checkpointBar = document.createElement('div');
      checkpointBar.className = 'msg-actions';
      checkpointBar.innerHTML = `
        <button class="save-checkpoint" title="Save checkpoint">
          <span class="cp-icon"><i data-lucide="bookmark"></i></span>
          <span class="cp-label">Save checkpoint</span>
        </button>
      `;
      aiEl.appendChild(checkpointBar);

      // checkpoint click handler
      const saveBtn = checkpointBar.querySelector('.save-checkpoint');
      saveBtn.addEventListener('click', () => {
        const isSaved = saveBtn.classList.toggle('saved');
        const iconWrap = saveBtn.querySelector('.cp-icon');
        const label = saveBtn.querySelector('.cp-label');
        if (isSaved) {
          iconWrap.innerHTML = '<i data-lucide="bookmark-check"></i>';
          label.textContent = 'Saved';
          lucide.createIcons();
          const id = addCheckpointToArtifacts(fullText, userText, saveBtn);
          saveBtn.dataset.artifactId = id;
        } else {
          iconWrap.innerHTML = '<i data-lucide="bookmark"></i>';
          label.textContent = 'Save checkpoint';
          lucide.createIcons();
          removeCheckpointFromArtifacts(saveBtn.dataset.artifactId);
          delete saveBtn.dataset.artifactId;
        }
      });

      lucide.createIcons();
      scrollBottom();

      conversationHistory.push({ role: 'user',      content: userText });
      conversationHistory.push({ role: 'assistant', content: fullText });
      convMessageCount++; // count the AI response too

      // award XP if 5+ messages exchanged and not yet awarded this conversation
      if (convMessageCount >= 5 && !xpAwardedThisConv && clerkUserId) {
        xpAwardedThisConv = true;
        const xp = calcConversationXp(convMessageCount);
        awardXp(xp);
        trackConversationCompletion(convMessageCount);
      }

      const conv = getActiveConv();
      if (conv) {
        conv.history = [...conversationHistory];
        conv.messages.push({ role: 'ai', text: fullText, isMarkdown: true });
        conv.updatedAt = Date.now();
        renderHistory();
      }

      // if backend returned a temp ID, re-fetch to get the real MongoDB _id
      if (activeConvId && activeConvId.startsWith('temp-') && clerkUserId) {
        try {
          const syncRes = await fetch(`${API}/api/conversations?userId=${clerkUserId}`);
          const syncData = await syncRes.json();
          if (syncData && syncData.length > 0) {
            const newest = syncData[0];
            const syncIdx = conversations.findIndex(c => c._id === activeConvId);
            if (syncIdx !== -1) {
              conversations[syncIdx]._id = newest._id;
              activeConvId = newest._id;
              renderHistory();
            }
          }
        } catch (syncErr) {
          console.warn('[sync] Could not sync conversation ID:', syncErr.message);
        }
      }

    } catch (err) {
      console.error('Fetch error:', err);
      tyEl.remove();
      const isNetwork = err.name === 'TypeError' || err.message.includes('Failed to fetch');
      const userMsg = isNetwork
        ? 'Network error — check your connection and make sure the backend is running.'
        : `Something went wrong: ${err.message}`;
      appendMsg('ai', userMsg, false);
      showToast(isNetwork ? 'Connection lost' : 'Response failed', 'error');
    }

    typing = false;
  }

  /* ══════════════════════════════
     SOURCES COMPONENT
  ══════════════════════════════ */
  function extractSources(text) {
    const sources = [];
    const seen = new Set();

    // match markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(text)) !== null) {
      const url = m[2];
      if (!seen.has(url)) {
        seen.add(url);
        sources.push({ title: m[1], url });
      }
    }

    // match (Source: text, text) pattern
    const sourceRegex = /\(Source:\s*([^)]+)\)/gi;
    while ((m = sourceRegex.exec(text)) !== null) {
      const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        // check if it's a URL
        const urlMatch = p.match(/(https?:\/\/[^\s,]+)/);
        const title = p.replace(/(https?:\/\/[^\s,]+)/, '').trim() || p;
        const url = urlMatch ? urlMatch[1] : null;
        const key = url || title;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({ title: title || key, url });
        }
      });
    }

    // match bare URLs not already captured
    const bareUrlRegex = /(?<!\]\()https?:\/\/[^\s)>\]]+/g;
    while ((m = bareUrlRegex.exec(text)) !== null) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          sources.push({ title: hostname, url });
        } catch {
          sources.push({ title: url, url });
        }
      }
    }

    return sources;
  }

  function buildSourcesComponent(sources) {
    const wrap = document.createElement('div');
    wrap.className = 'sources-component';

    const header = document.createElement('button');
    header.className = 'sources-header';
    header.innerHTML = `
      <span class="sources-label">Used ${sources.length} source${sources.length > 1 ? 's' : ''}</span>
      <i data-lucide="chevron-down" class="sources-chevron"></i>
    `;
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'sources-list';
    sources.forEach(s => {
      const item = document.createElement('a');
      item.className = 'source-item';
      item.href = s.url || '#';
      item.target = '_blank';
      item.rel = 'noopener';
      item.innerHTML = `<i data-lucide="file-text"></i><span>${s.title}</span>`;
      list.appendChild(item);
    });
    wrap.appendChild(list);

    header.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      const chevron = header.querySelector('.sources-chevron');
      chevron.setAttribute('data-lucide', open ? 'chevron-up' : 'chevron-down');
      lucide.createIcons();
    });

    return wrap;
  }

  /* ══════════════════════════════
     SAVE CHECKPOINT → ARTIFACTS
  ══════════════════════════════ */
  /* ── Saves a response checkpoint to the Saved sidebar + localStorage ── */
  let checkpointCounter = 0;

  function saveCheckpointsToStorage() {
    const cards = artifactList.querySelectorAll('.artifact-card[data-checkpoint-id]');
    const data = [];
    cards.forEach(card => {
      data.push({
        id: card.dataset.checkpointId,
        title: card.querySelector('.artifact-name')?.textContent || '',
        convId: activeConvId
      });
    });
    localStorage.setItem('iyomi-checkpoints', JSON.stringify(data));
  }

  function loadCheckpointsFromStorage() {
    const saved = localStorage.getItem('iyomi-checkpoints');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (!data.length) return;
      artifactsEmpty.style.display = 'none';
      artifactList.style.display = 'flex';
      artifactList.style.flexDirection = 'column';
      data.forEach(cp => {
        checkpointCounter++;
        const card = document.createElement('div');
        card.className = 'artifact-card';
        card.dataset.checkpointId = cp.id;
        card.innerHTML = `
          <div class="artifact-icon artifact-icon--checkpoint"><i data-lucide="bookmark-check"></i></div>
          <div class="artifact-info">
            <div class="artifact-name">${cp.title}</div>
            <div class="artifact-meta">Checkpoint · saved</div>
          </div>`;
        artifactList.appendChild(card);
      });
      refreshIcons();
    } catch (e) {
      console.warn('[checkpoints] Could not load saved checkpoints');
    }
  }

  // restore checkpoints on page load
  loadCheckpointsFromStorage();

  function addCheckpointToArtifacts(responseText, queryText, triggerBtn) {
    checkpointCounter++;
    const id = 'checkpoint-' + checkpointCounter + '-' + Date.now();
    const title = escapeHtml(queryText.length > 40 ? queryText.slice(0, 40) + '…' : queryText);

    artifactsEmpty.style.display = 'none';
    artifactList.style.display = 'flex';
    artifactList.style.flexDirection = 'column';

    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.dataset.checkpointId = id;
    card.innerHTML = `
      <div class="artifact-icon artifact-icon--checkpoint"><i data-lucide="bookmark-check"></i></div>
      <div class="artifact-info">
        <div class="artifact-name">${title}</div>
        <div class="artifact-meta">Checkpoint · just now</div>
      </div>`;

    // click card → scroll to the saved response
    card.addEventListener('click', () => {
      if (triggerBtn) {
        const msgEl = triggerBtn.closest('.msg--ai');
        if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    artifactList.appendChild(card);
    lucide.createIcons();

    // auto-open sidebar if collapsed
    if (sidebarRight.classList.contains('collapsed')) {
      sidebarRight.classList.remove('collapsed');
    }

    saveCheckpointsToStorage();
    return id;
  }

  function removeCheckpointFromArtifacts(artifactId) {
    if (!artifactId) return;
    const card = artifactList.querySelector(`[data-checkpoint-id="${artifactId}"]`);
    if (card) card.remove();

    // if no more artifacts, show empty state
    if (artifactList.children.length === 0) {
      artifactsEmpty.style.display = 'flex';
      artifactList.style.display = 'none';
    }
    saveCheckpointsToStorage();
  }

  /* ══════════════════════════════
     MARKDOWN PARSER
  ══════════════════════════════ */
  function parseMarkdown(text) {
    // 1. extract code blocks first
    const codeBlocks = [];
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim(), code: code.trim() });
      return `\n\n%%CB_${idx}%%\n\n`;
    });

    // 2. split into lines for block-level parsing
    const lines = text.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // headings — also handle inline headings (## text### subtext on same line)
      const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (hMatch) {
        // check if content itself contains another heading
        const content = hMatch[2];
        const innerH = content.match(/^(.*?)(#{1,6}\s+.+)$/);
        if (innerH && innerH[1].trim()) {
          blocks.push({ type: 'heading', level: hMatch[1].length, content: innerH[1].trim() });
          blocks.push({ type: 'heading', level: hMatch[1].length + 1, content: innerH[2].replace(/^#+\s+/, '') });
        } else {
          blocks.push({ type: 'heading', level: hMatch[1].length, content: content });
        }
        i++; continue;
      }

      // table — model sometimes puts header row on same line after colon
      if (line.trim().startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          blocks.push({ type: 'table', lines: tableLines });
          continue;
        } else {
          // not a real table, treat as paragraph
          blocks.push({ type: 'para', content: tableLines.join(' ') });
          continue;
        }
      }

      // horizontal rule
      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        blocks.push({ type: 'hr' });
        i++; continue;
      }

      // blockquote
      if (line.startsWith('> ')) {
        let content = '';
        while (i < lines.length && lines[i].startsWith('> ')) {
          content += lines[i].slice(2) + '\n';
          i++;
        }
        blocks.push({ type: 'blockquote', content: content.trim() });
        continue;
      }

      // unordered list
      if (/^(\s*)[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^(\s*)[-*+]\s/.test(lines[i])) {
          const indent = lines[i].match(/^(\s*)/)[1].length;
          const content = lines[i].replace(/^(\s*)[-*+]\s/, '');
          items.push({ indent, content });
          i++;
        }
        blocks.push({ type: 'ul', items });
        continue;
      }

      // ordered list
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s/, ''));
          i++;
        }
        blocks.push({ type: 'ol', items });
        continue;
      }

      // code block placeholder
      if (/^%%CB_\d+%%$/.test(line.trim())) {
        blocks.push({ type: 'code', idx: parseInt(line.match(/%%CB_(\d+)%%/)[1]) });
        i++; continue;
      }

      // blank line
      if (line.trim() === '') { i++; continue; }

      // paragraph — collect until blank line or block element
      let para = '';
      while (i < lines.length && lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].match(/^#{1,6}\s/) &&
        !lines[i].startsWith('> ') &&
        !/^(\s*)[-*+]\s/.test(lines[i]) &&
        !/^\d+\.\s/.test(lines[i]) &&
        !/^%%CB_\d+%%$/.test(lines[i].trim()) &&
        !/^---+$/.test(lines[i].trim())) {
        para += (para ? ' ' : '') + lines[i];
        i++;
      }
      if (para) {
        // check if paragraph contains inline table (model put | on same line as text)
        if (para.includes('|') && para.split('|').length > 4) {
          // try to extract table portion
          const pipeIdx = para.search(/\|\s*\w+\s*\|/);
          if (pipeIdx !== -1) {
            const preText  = para.slice(0, pipeIdx).replace(/:\s*$/, '').trim();
            const tableRaw = para.slice(pipeIdx);
            // reconstruct table rows from inline pipes
            const cells = tableRaw.split('|').map(c => c.trim()).filter(c => c && !/^-+$/.test(c) && c !== '---');
            if (cells.length >= 3) {
              if (preText) blocks.push({ type: 'para', content: preText });
              // can't reliably determine columns — push as para with note
              blocks.push({ type: 'para', content: para });
              continue;
            }
          }
        }
        blocks.push({ type: 'para', content: para });
      }
    }

    // 3. inline formatting
    function inline(str) {
      return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
          // block javascript: and data: URIs, allow only http/https
          const safeUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : '#';
          return `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>`;
        });
    }

    // 4. render blocks to HTML
    let html = '';
    blocks.forEach(block => {
      switch (block.type) {
        case 'table': {
          const isSeparator = row => /^\|[\s\-:|]+\|$/.test(row.trim());
          const parseCells  = row => row.split('|')
            .filter((_, i, a) => i > 0 && i < a.length - 1)
            .map(c => c.trim());

          const allRows  = block.lines.filter(l => l.trim());
          const dataRows = allRows.filter(l => !isSeparator(l));
          if (dataRows.length < 1) break;

          const header = parseCells(dataRows[0]);
          const body   = dataRows.slice(1);

          let thtml = `<div class="chat-table-wrapper"><table><thead><tr>`;
          header.forEach(h => { thtml += `<th>${inline(h)}</th>`; });
          thtml += `</tr></thead><tbody>`;
          body.forEach(row => {
            thtml += `<tr>`;
            parseCells(row).forEach(cell => { thtml += `<td>${inline(cell)}</td>`; });
            thtml += `</tr>`;
          });
          thtml += `</tbody></table></div>`;
          html += thtml;
          break;
        }
        case 'heading': {
          const tag = `h${block.level}`;
          const cls = `chat-h${block.level}`;
          html += `<${tag} class="${cls}">${inline(block.content)}</${tag}>`;
          break;
        }
        case 'para':
          html += `<p>${inline(block.content)}</p>`;
          break;
        case 'hr':
          html += `<hr class="chat-hr">`;
          break;
        case 'blockquote':
          html += `<blockquote class="chat-blockquote">${inline(block.content)}</blockquote>`;
          break;
        case 'ul': {
          let listHtml = '<ul class="chat-ul">';
          block.items.forEach(item => {
            const depth = Math.floor(item.indent / 2);
            if (depth > 0) listHtml += `<li class="chat-li chat-li--sub">${inline(item.content)}</li>`;
            else listHtml += `<li class="chat-li">${inline(item.content)}</li>`;
          });
          listHtml += '</ul>';
          html += listHtml;
          break;
        }
        case 'ol': {
          let listHtml = '<ol class="chat-ol">';
          block.items.forEach(item => {
            listHtml += `<li class="chat-li">${inline(item)}</li>`;
          });
          listHtml += '</ol>';
          html += listHtml;
          break;
        }
        case 'code': {
          const { lang, code } = codeBlocks[block.idx];
          const escaped = code
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const langLabel = lang || 'code';
          html += `<div class="chat-code-block">
            <div class="chat-code-header">
              <span class="chat-code-lang">${langLabel}</span>
              <button class="chat-code-copy" data-copy="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
            </div>
            <pre class="chat-code-pre"><code>${escaped}</code></pre>
          </div>`;
          break;
        }
      }
    });

    return html;
  }

  /* ══════════════════════════════
     ARTIFACT
  ══════════════════════════════ */
  function addArtifact() {
    const types = [
      { icon: 'file-text', name: 'Summary.md',  meta: 'Markdown · just now' },
      { icon: 'code-2',    name: 'snippet.js',  meta: 'JavaScript · just now' },
      { icon: 'list-todo', name: 'Task list',   meta: 'Checklist · just now' },
    ];
    const t = types[Math.floor(Math.random() * types.length)];

    artifactsEmpty.style.display = 'none';
    artifactList.style.display = 'flex';
    artifactList.style.flexDirection = 'column';

    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.innerHTML = `
      <div class="artifact-icon"><i data-lucide="${t.icon}"></i></div>
      <div class="artifact-info">
        <div class="artifact-name">${t.name}</div>
        <div class="artifact-meta">${t.meta}</div>
      </div>`;
    artifactList.appendChild(card);
    lucide.createIcons();
  }

  /* ══════════════════════════════
     COPY BUTTON DELEGATION
  ══════════════════════════════ */
  messagesInner.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy="true"]');
    if (!btn) return;
    const code = btn.closest('.chat-code-block')?.querySelector('code')?.innerText;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
      setTimeout(() => {
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    });
  });

  /* ══════════════════════════════
     HELPERS
  ══════════════════════════════ */
  function scrollBottom() {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
  }

  function resetChat() {
    msgCount  = 0;
    typing    = false;
    conversationHistory = [];
    activeConvId = null;
    convMessageCount = 0;
    xpAwardedThisConv = false;
    attachedFiles = [];
    attachmentPreviews.innerHTML = '';
    if (isRecording) stopRecording();
    messagesInner.innerHTML = '';
    chatMain.classList.remove('chat-started');
    welcomeState.style.display   = 'flex';
    messagesArea.style.display   = 'none';
    artifactsEmpty.style.display = 'flex';
    artifactList.style.display   = 'none';
    artifactList.innerHTML = '';
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    topbarTitle.textContent = 'New Chat';
    refreshWelcomeMessage();
    checkEasterEgg();
    renderHistory();
  }

  // init
  checkEasterEgg();
  renderHistory();

});

/* ══════════════════════════════
   CLERK AUTH — runs after all scripts load
══════════════════════════════ */
window.addEventListener('load', async function () {

  // wait for Clerk to be injected (defer means timing isn't guaranteed)
  const waitForClerk = () => new Promise(resolve => {
    if (window.Clerk) return resolve();
    const iv = setInterval(() => {
      if (window.Clerk) { clearInterval(iv); resolve(); }
    }, 50);
  });

  await waitForClerk();
  await Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });

  // not logged in → redirect
  if (!Clerk.user) {
    window.location.href = '../pages/auth/login.html';
    return;
  }

  // populate user info — trigger row + popover
  const user     = Clerk.user;
  clerkUserId    = user.id;  // set global for DB calls
  const name     = user.fullName || user.firstName || user.username || 'User';
  const email    = user.primaryEmailAddress?.emailAddress || '';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // helper to set avatar
  function setAvatar(el) {
    if (!el) return;
    if (user.imageUrl) {
      el.innerHTML = `<img src="${user.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    } else {
      el.textContent = initials;
    }
  }

  // trigger row (bottom of sidebar)
  setAvatar(document.getElementById('slUserAvatar'));
  const slName = document.getElementById('slUserName');
  if (slName) slName.textContent = name;

  // popover (expanded menu)
  setAvatar(document.getElementById('slPopoverAvatar'));
  const popName  = document.getElementById('slPopoverName');
  const popEmail = document.getElementById('slPopoverEmail');
  if (popName)  popName.textContent  = name;
  if (popEmail) popEmail.textContent = email;

  // update welcome heading with a fresh contextual message
  if (window.refreshWelcomeMessage) window.refreshWelcomeMessage();

  // populate profile stats (level, title, petals, streak)
  function updateProfileStats(stats) {
    const titleEl  = document.getElementById('slUserTitle');
    const levelEl  = document.getElementById('slUserLevel');
    const petalEl  = document.getElementById('slPetalCount');
    const streakEl = document.getElementById('slStreakCount');
    if (titleEl)  titleEl.textContent  = stats.title || 'Blossom Wanderer';
    if (levelEl)  levelEl.textContent  = 'Lv ' + (stats.level || 0);
    if (petalEl)  petalEl.textContent  = stats.petals || 0;
    if (streakEl) streakEl.textContent = stats.streak || 0;
  }
  window.updateProfileStats = updateProfileStats;

  // load stats from backend (or default)
  async function loadUserStats() {
    if (!clerkUserId) return;
    try {
      const res = await fetch(`${API}/api/user-stats?userId=${clerkUserId}`);
      if (res.ok) {
        const stats = await res.json();
        updateProfileStats(stats);
      } else {
        updateProfileStats({ level: 0, title: 'Blossom Wanderer', petals: 0, streak: 0 });
      }
    } catch (err) {
      console.warn('[stats] Could not load user stats:', err.message);
      updateProfileStats({ level: 0, title: 'Blossom Wanderer', petals: 0, streak: 0 });
    }
  }

  loadUserStats();

  // now load chat history (clerkUserId is set)
  if (window.fetchHistory) window.fetchHistory();

  // sign out
  document.getElementById('slSignOutBtn').addEventListener('click', async function (e) {
    e.preventDefault();
    if (confirm('Sign out of Iyomi?')) {
      await Clerk.signOut();
      window.location.href = '../pages/auth/login.html';
    }
  });

  /* ══════════════════════════════
     SETTINGS MODAL
  ══════════════════════════════ */
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsClose   = document.getElementById('settingsClose');
  const helpOverlay     = document.getElementById('helpOverlay');
  const helpClose       = document.getElementById('helpClose');
  const confirmOverlay  = document.getElementById('confirmOverlay');
  const confirmCancel   = document.getElementById('confirmCancel');
  const confirmOk       = document.getElementById('confirmOk');
  const confirmInput    = document.getElementById('confirmInput');
  let confirmCallback   = null;

  // open / close
  function openModal(overlay) { overlay.classList.add('open'); lucide.createIcons(); }
  function closeModal2(overlay) { overlay.classList.remove('open'); }

  document.getElementById('slSettingsBtn').addEventListener('click', e => {
    e.preventDefault();
    populateSettingsAccount();
    // always open settings on the General tab
    document.querySelectorAll('.iy-nav-item').forEach(b => b.classList.remove('iy-nav-item--active'));
    document.querySelectorAll('.iy-panel').forEach(p => p.style.display = 'none');
    const generalBtn = document.querySelector('.iy-nav-item[data-panel="general"]');
    const generalPanel = document.getElementById('panel-general');
    if (generalBtn) generalBtn.classList.add('iy-nav-item--active');
    if (generalPanel) generalPanel.style.display = 'flex';
    openModal(settingsOverlay);
  });

  document.getElementById('slHelpBtn').addEventListener('click', e => {
    e.preventDefault();
    openModal(helpOverlay);
  });

  settingsClose.addEventListener('click', () => closeModal2(settingsOverlay));
  helpClose.addEventListener('click',     () => closeModal2(helpOverlay));

  // close on backdrop click
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeModal2(settingsOverlay); });
  helpOverlay.addEventListener('click',     e => { if (e.target === helpOverlay)     closeModal2(helpOverlay);     });
  confirmOverlay.addEventListener('click',  e => { if (e.target === confirmOverlay)  closeModal2(confirmOverlay);  });

  // Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (settingsOverlay.classList.contains('open')) closeModal2(settingsOverlay);
    else if (helpOverlay.classList.contains('open')) closeModal2(helpOverlay);
    else if (confirmOverlay.classList.contains('open')) closeModal2(confirmOverlay);
  });

  // keyboard shortcut: Ctrl+,
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      populateSettingsAccount();
      openModal(settingsOverlay);
    }
  });

  // ── NAV panel switching ──
  document.querySelectorAll('.iy-nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.iy-nav-item').forEach(b => b.classList.remove('iy-nav-item--active'));
      btn.classList.add('iy-nav-item--active');
      document.querySelectorAll('.iy-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById('panel-' + btn.dataset.panel);
      if (panel) panel.style.display = 'flex';
    });
  });

  // ── ACCOUNT: populate from Clerk ──
  function populateSettingsAccount() {
    if (!window.Clerk?.user) return;
    const u = Clerk.user;
    const name     = u.fullName || u.firstName || u.username || '';
    const email    = u.primaryEmailAddress?.emailAddress || '';
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    const avatarEl = document.getElementById('settingsAvatar');
    if (avatarEl) {
      if (u.imageUrl) {
        avatarEl.innerHTML = `<img src="${u.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
      } else {
        avatarEl.textContent = initials;
      }
    }
    const nameEl  = document.getElementById('settingsName');
    const emailEl = document.getElementById('settingsEmail');
    if (nameEl)  nameEl.value  = name;
    if (emailEl) emailEl.value = email;
  }

  // change password / manage account → Clerk user profile
  document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    if (window.Clerk?.user) Clerk.openUserProfile();
  });
  document.getElementById('manageAccountBtn')?.addEventListener('click', () => {
    if (window.Clerk?.user) Clerk.openUserProfile();
  });
  // opens Clerk user profile to view active sessions
  document.getElementById('activeSessionsBtn')?.addEventListener('click', () => {
    if (window.Clerk?.user) Clerk.openUserProfile();
  });

  // ── APPEARANCE: theme segmented ──
  const themeSegs = document.querySelectorAll('#themeSegmented .iy-seg-btn');
  const savedTheme = localStorage.getItem('iyomi-theme') || 'system';
  themeSegs.forEach(btn => {
    if (btn.dataset.val === savedTheme) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      themeSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      const val = btn.dataset.val;
      localStorage.setItem('iyomi-theme', val);
      const html = document.documentElement;
      if (val === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else if (val === 'light') {
        html.removeAttribute('data-theme');
      } else {
        // system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        prefersDark ? html.setAttribute('data-theme', 'dark') : html.removeAttribute('data-theme');
      }
      // sync sidebar pill
      const pill = document.getElementById('themePill');
      if (pill && html.getAttribute('data-theme') === 'dark') {
        // pill state auto-follows data-theme via CSS
      }
    });
  });

  // ── APPEARANCE: font size ──
  const fontSizes = { compact: '13px', default: '15px', relaxed: '17px' };
  const savedFontSize = localStorage.getItem('iyomi-font-size') || 'default';
  document.documentElement.style.setProperty('--msg-font', fontSizes[savedFontSize]);
  const fontSegs = document.querySelectorAll('#fontSizeSegmented .iy-seg-btn');
  fontSegs.forEach(btn => {
    if (btn.dataset.val === savedFontSize) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      fontSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      const val = btn.dataset.val;
      localStorage.setItem('iyomi-font-size', val);
      document.documentElement.style.setProperty('--msg-font', fontSizes[val]);
    });
  });

  // ── APPEARANCE: sidebar default ──
  const savedSidebarDefault = localStorage.getItem('iyomi-sidebar-default') || 'open';
  const sidebarDefSegs = document.querySelectorAll('#sidebarDefaultSegmented .iy-seg-btn');
  sidebarDefSegs.forEach(btn => {
    if (btn.dataset.val === savedSidebarDefault) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      sidebarDefSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      localStorage.setItem('iyomi-sidebar-default', btn.dataset.val);
    });
  });

  // ── APPEARANCE: accent color ──
  const savedAccent = localStorage.getItem('iyomi-accent') || '#4a9eff';
  document.documentElement.style.setProperty('--accent-color', savedAccent);
  const swatches = document.querySelectorAll('#accentSwatches .iy-swatch');
  swatches.forEach(btn => {
    if (btn.dataset.color === savedAccent) btn.classList.add('iy-swatch--active');
    else btn.classList.remove('iy-swatch--active');
    btn.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('iy-swatch--active'));
      btn.classList.add('iy-swatch--active');
      const color = btn.dataset.color;
      localStorage.setItem('iyomi-accent', color);
      document.documentElement.style.setProperty('--accent-color', color);
    });
  });

  // ── PREFERENCES: tone ──
  const savedTone = localStorage.getItem('iyomi-tone') || 'friendly';
  const toneSegs  = document.querySelectorAll('#toneSegmented .iy-seg-btn');
  toneSegs.forEach(btn => {
    if (btn.dataset.val === savedTone) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      toneSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      localStorage.setItem('iyomi-tone', btn.dataset.val);
    });
  });

  // ── PREFERENCES: default model ──
  const defaultModelSelect = document.getElementById('defaultModelSelect');
  if (defaultModelSelect) {
    const savedModel = localStorage.getItem('iyomi-default-model') || 'llama-3.3-70b-versatile';
    defaultModelSelect.value = savedModel;
    defaultModelSelect.addEventListener('change', () => {
      localStorage.setItem('iyomi-default-model', defaultModelSelect.value);
    });
  }

  // ── PREFERENCES: auto-title toggle ──
  function initToggle(id, storageKey, defaultVal) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    const saved = localStorage.getItem(storageKey);
    const on    = saved !== null ? saved === 'true' : defaultVal;
    toggle.dataset.on    = on;
    toggle.ariaChecked   = on;
    toggle.addEventListener('click', () => {
      const next = toggle.dataset.on !== 'true';
      toggle.dataset.on  = next;
      toggle.ariaChecked = next;
      localStorage.setItem(storageKey, next);
    });
  }

  initToggle('autoTitleToggle',   'iyomi-auto-title',    true);
  initToggle('saveHistoryToggle', 'iyomi-save-history',  true);
  initToggle('memoryToggle',      'iyomi-memory',        true);
  initToggle('historyRefToggle',  'iyomi-history-ref',   true);

  // ── PERSONALIZATION: nickname, occupation, about you — persist to localStorage ──
  const personalFields = [
    { id: 'settingsNickname',   key: 'iyomi-nickname' },
    { id: 'settingsOccupation', key: 'iyomi-occupation' },
    { id: 'settingsAboutYou',   key: 'iyomi-about-you' }
  ];
  personalFields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = localStorage.getItem(key);
    if (saved) el.value = saved;
    el.addEventListener('input', () => {
      localStorage.setItem(key, el.value);
    });
  });

  // ── DATA CONTROLS: location selector ──
  const locationSelect = document.getElementById('locationSelect');
  if (locationSelect) {
    const savedLocation = localStorage.getItem('iyomi-location') || 'auto';
    locationSelect.value = savedLocation;
    locationSelect.addEventListener('change', () => {
      localStorage.setItem('iyomi-location', locationSelect.value);
    });
  }

  // ── DATA CONTROLS: view archived chats ──
  document.getElementById('viewArchivedBtn')?.addEventListener('click', () => {
    const archived = conversations.filter(c => archivedChats.includes(c._id));
    if (archived.length === 0) {
      alert('No archived chats.');
      return;
    }
    const titles = archived.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
    const choice = prompt(
      `Archived chats:\n${titles}\n\nEnter a number to restore, or leave empty to cancel:`
    );
    if (choice) {
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < archived.length) {
        const restoredId = archived[idx]._id;
        archivedChats = archivedChats.filter(id => id !== restoredId);
        localStorage.setItem('iyomi-archived', JSON.stringify(archivedChats));
        if (window.renderHistory) window.renderHistory();
        alert(`"${archived[idx].title}" restored.`);
      }
    }
  });

  // ── DATA CONTROLS: archive all chats ──
  document.getElementById('archiveAllBtn')?.addEventListener('click', () => {
    if (!confirm('Archive all current chats? They can be restored from Data Controls.')) return;
    conversations.forEach(c => {
      if (!archivedChats.includes(c._id)) archivedChats.push(c._id);
    });
    localStorage.setItem('iyomi-archived', JSON.stringify(archivedChats));
    activeConvId = null;
    conversationHistory = [];
    if (window.renderHistory) window.renderHistory();
    const mi = document.getElementById('messagesInner');
    const cm = document.getElementById('chatMain');
    const ws = document.getElementById('welcomeState');
    const ma = document.getElementById('messagesArea');
    if (mi) mi.innerHTML = '';
    if (cm) cm.classList.remove('chat-started');
    if (ws) ws.style.display = 'flex';
    if (ma) ma.style.display = 'none';
    const tt = document.getElementById('topbarTitle');
    if (tt) tt.textContent = 'New Chat';
  });

  // ── PRIVACY: export data ──
  document.getElementById('exportDataBtn')?.addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: typeof conversations !== 'undefined' ? conversations : []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `iyomi-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── CONFIRM DIALOG helper ──
  function showConfirm(title, sub, requireTyping, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmSub').textContent   = sub;
    const wrap = document.getElementById('confirmInputWrap');
    if (requireTyping) {
      wrap.style.display = 'block';
      confirmInput.value = '';
      confirmOk.disabled = true;
      confirmInput.oninput = () => {
        confirmOk.disabled = confirmInput.value.trim() !== 'DELETE';
      };
    } else {
      wrap.style.display = 'none';
      confirmOk.disabled = false;
    }
    confirmCallback = onConfirm;
    openModal(confirmOverlay);
  }

  confirmCancel.addEventListener('click', () => closeModal2(confirmOverlay));
  confirmOk.addEventListener('click', () => {
    closeModal2(confirmOverlay);
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  // ── PRIVACY: delete all conversations ──
  document.getElementById('deleteAllChatsBtn')?.addEventListener('click', () => {
    showConfirm(
      'Delete all conversations?',
      'This permanently removes all your chat history and cannot be undone.',
      true,
      async () => {
        if (clerkUserId) {
          await fetch(`${API}/api/conversations?userId=${clerkUserId}`, { method: 'DELETE' });
        }
        conversations = [];
        activeConvId  = null;
        conversationHistory = [];
        // wipe pinned/archived state alongside conversations
        pinnedChats = [];
        archivedChats = [];
        localStorage.removeItem('iyomi-pinned');
        localStorage.removeItem('iyomi-archived');
        renderHistory();
        messagesInner.innerHTML = '';
        chatMain.classList.remove('chat-started');
        welcomeState.style.display   = 'flex';
        messagesArea.style.display   = 'none';
        topbarTitle.textContent      = 'New Chat';
        closeModal2(settingsOverlay);
      }
    );
  });

  // ── PRIVACY: delete account ──
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    showConfirm(
      'Delete your account?',
      'This permanently deletes your account and all associated data. Type DELETE to confirm.',
      true,
      async () => {
        if (window.Clerk?.user) {
          await Clerk.user.delete();
          window.location.href = '../index.html';
        }
      }
    );
  });

  // ── SETTINGS SEARCH (basic filter) ──
  document.getElementById('settingsSearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    document.querySelectorAll('.iy-nav-item[data-panel]').forEach(btn => {
      btn.style.display = !q || btn.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // ── KEYBOARD SHORTCUTS — bound to match the Keyboard settings panel ──
  document.addEventListener('keydown', e => {
    // ignore if user is typing in an input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Ctrl+N — new chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const newChatBtn = document.getElementById('newChatBtn');
      if (newChatBtn) newChatBtn.click();
    }

    // Ctrl+B — toggle left sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebarLeft');
      if (sidebar) sidebar.classList.toggle('collapsed');
    }

    // Ctrl+K — focus search chats
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchLink = document.getElementById('searchChatsLink');
      if (searchLink) searchLink.click();
    }

    // "/" — focus chat input
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const chatInput = document.getElementById('chatInput');
      if (chatInput) chatInput.focus();
    }
  });

  lucide.createIcons();

  // load chat history from DB
  window.fetchHistory();
});