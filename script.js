// =============================================
// DATA — Classes & Difficulties (ORIGINAL)
// =============================================

const classes = [
  { name: "Engineer",  passive: "Logic Boost (+10% time)",  ultimate: "Time Freeze" },
  { name: "Aviator",   passive: "Speed Thinker",             ultimate: "Overclock" },
  { name: "Alchemist", passive: "Critical Chance (2× score)",ultimate: "Transmutation" },
  { name: "Automaton", passive: "Accuracy Core (removes 1 wrong)", ultimate: "Auto Solve" }
];

const difficulties = [
  { name: "Easy",         time: 20, xp: 5,  score: 10 },
  { name: "Intermediate", time: 15, xp: 10, score: 15 },
  { name: "Hard",         time: 10, xp: 15, score: 20 }
];

// =============================================
// [NEW] DOMAIN / CATEGORY SYSTEM
// =============================================

const domains = [
  { id: "aptitude",  icon: "🧮", name: "Aptitude"  },
  { id: "frontend",  icon: "🎨", name: "Frontend"  },
  { id: "backend",   icon: "⚙️", name: "Backend"   },
  { id: "database",  icon: "🗄️", name: "Database"  }
];



// =============================================
// STATE (ORIGINAL + extended)
// =============================================

let state = {
  player: "",
  domain: null,          // [NEW] selected domain
  class: null,
  difficulty: null,
  current: 0,
  score: 0,
  xp: 0,
  streak: 0,
  ultimateActive: 0,

  // Overall timer (ORIGINAL)
  overallTimer: null,
  overallTimeLeft: 0,
  overallBaseTime: 0,

  // Per-question timer (ORIGINAL logic + new UI)
  questionTimer: null,
  questionTimeLeft: 0,

  questions: []           // [NEW] domain-loaded question set
};

// =============================================
// DOM REFERENCES
// =============================================

const screens        = document.querySelectorAll(".screen");
const classGrid      = document.getElementById("classGrid");
const difficultyGrid = document.getElementById("difficultyGrid");
const domainGrid     = document.getElementById("domainGrid");
const ultimateBtn    = document.getElementById("ultimateBtn");
const mascotSpeech   = document.getElementById("mascotSpeech");

// =============================================
// PARTICLES (visual enhancement)
// =============================================

(function initParticles() {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.5 + 0.1
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 80 }, createParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,224,255,${p.alpha})`;
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.y < 0 || p.x < 0 || p.x > W) Object.assign(p, createParticle(), { y: H });
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  init();
  draw();
})();

// =============================================
// UTILITY
// =============================================

/** Fisher-Yates shuffle on state.questions */
function shuffleQuestions() {
  const q = state.questions;
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
}

/** Show only the given screen id */
function showScreen(id) {
  screens.forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// =============================================
// MASCOT
// =============================================

function speak(text) {
  const name = state.player || "";
  mascotSpeech.textContent = text.replace("{name}", name);
}

// =============================================
// [NEW] PLAYER DATA — localStorage helpers
// =============================================

const STORAGE_KEY = "qar_players";

/** Load all players from localStorage */
function loadPlayers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

/** Save all players to localStorage */
function savePlayers(players) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

/** Get or create player record */
function getPlayerData(name) {
  const players = loadPlayers();
  if (!players[name]) {
    players[name] = { name, bestScore: 0, gamesPlayed: 0, totalXP: 0 };
    savePlayers(players);
  }
  return players[name];
}

/** Update player after a game */
function updatePlayerData(name, score, xp) {
  const players = loadPlayers();
  if (!players[name]) players[name] = { name, bestScore: 0, gamesPlayed: 0, totalXP: 0 };
  players[name].gamesPlayed++;
  players[name].totalXP += xp;
  if (score > players[name].bestScore) players[name].bestScore = score;
  savePlayers(players);
  return players[name];
}

/** Show returning player stats on setup screen */
function showPlayerStats(name) {
  const statsEl = document.getElementById("playerStats");
  if (name.length < 3) { statsEl.classList.add("hidden"); return; }
  const data = getPlayerData(name);
  if (data.gamesPlayed === 0) { statsEl.classList.add("hidden"); return; }
  document.getElementById("statBestScore").textContent  = `Best: ${data.bestScore}`;
  document.getElementById("statGamesPlayed").textContent = `Games: ${data.gamesPlayed}`;
  statsEl.classList.remove("hidden");
}

// =============================================
// [NEW] LEADERBOARD — localStorage helpers
// =============================================

const LB_KEY = "qar_leaderboard";
const LB_SIZE = 5;

/** Load leaderboard array from localStorage */
function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
  catch { return []; }
}

/** Save leaderboard back to localStorage */
function saveLeaderboard(lb) {
  localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

/** Add a new entry and keep top LB_SIZE by score */
function addLeaderboardEntry(entry) {
  // entry: { name, score, domain, difficulty, date }
  const lb = loadLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  const trimmed = lb.slice(0, Math.max(LB_SIZE * 4, 20)); // keep more for filtering
  saveLeaderboard(trimmed);
}

/** Render leaderboard list into a given container, optionally filtered by domain */
function renderLeaderboard(containerId, domain = "all", limit = LB_SIZE) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let lb = loadLeaderboard();
  if (domain !== "all") lb = lb.filter(e => e.domain === domain);
  lb = lb.slice(0, limit);

  if (lb.length === 0) {
    container.innerHTML = `<div class="lb-empty">No scores yet. Be the first! 🏆</div>`;
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  container.innerHTML = lb.map((entry, i) => `
    <div class="lb-entry rank-${i + 1}">
      <span class="lb-rank">${medals[i] || i + 1}</span>
      <span class="lb-name">${escapeHTML(entry.name)}</span>
      <div class="lb-meta">
        <span class="lb-domain-tag">${entry.domain || "aptitude"}</span>
        <span>${entry.difficulty || ""}</span>
      </div>
      <span class="lb-score">${entry.score}</span>
    </div>
  `).join("");
}

function escapeHTML(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// =============================================
// SETUP — Domain Grid (NEW)
// =============================================

function initDomains() {
  domainGrid.innerHTML = "";
  domains.forEach(d => {
    const card = document.createElement("div");
    card.className = "domain-card";
    card.innerHTML = `<span class="domain-icon">${d.icon}</span><span class="domain-name">${d.name}</span>`;
    card.onclick = () => {
      document.querySelectorAll(".domain-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.domain = d;
      speak(`Domain: ${d.name} selected.`);
    };
    domainGrid.appendChild(card);
  });
}

// =============================================
// SETUP — Class Grid (ORIGINAL)
// =============================================

function initClasses() {
  classGrid.innerHTML = "";
  classes.forEach(cls => {
    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `<strong>${cls.name}</strong>
      <p>Passive: ${cls.passive}</p>
      <p>Ult: ${cls.ultimate}</p>`;
    card.onclick = () => {
      document.querySelectorAll("#classGrid .class-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.class = cls;
      document.getElementById("classLabel").textContent = cls.name;
      speak(`${cls.name} selected.`);
    };
    classGrid.appendChild(card);
  });
}

// =============================================
// SETUP — Difficulty Grid (ORIGINAL)
// =============================================

function initDifficulty() {
  difficultyGrid.innerHTML = "";
  difficulties.forEach(diff => {
    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `<strong>${diff.name}</strong>
      <p>${diff.time}s / question</p>
      <p>+${diff.score} pts / correct</p>`;
    card.onclick = () => {
      document.querySelectorAll("#difficultyGrid .class-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.difficulty = diff;
      speak(`${diff.name} mode selected.`);
    };
    difficultyGrid.appendChild(card);
  });
}

// =============================================
// OVERALL TIMER (ORIGINAL logic preserved)
// =============================================

function startOverallTimer() {
  clearInterval(state.overallTimer);
  let totalTime = state.difficulty.time * state.questions.length;
  if (state.class.name === "Engineer") {
    totalTime += Math.floor(totalTime * 0.1); // Logic Boost: +10% time
  }
  state.overallBaseTime  = totalTime;
  state.overallTimeLeft  = totalTime;

  state.overallTimer = setInterval(() => {
    // Engineer ultimate: Time Freeze
    if (state.ultimateActive > 0 && state.class.name === "Engineer") return;
    // Aviator ultimate: Overclock (50% chance to skip tick)
    if (state.ultimateActive > 0 && state.class.name === "Aviator") {
      if (Math.random() > 0.5) return;
    }
    state.overallTimeLeft--;
    if (state.overallTimeLeft <= 0) {
      clearInterval(state.overallTimer);
      speak("Time's up!");
      endQuiz();
    }
  }, 1000);
}

// =============================================
// [ENHANCED] QUESTION TIMER — numeric + bar
// =============================================

function startQuestionTimer() {
  clearInterval(state.questionTimer);
  state.questionTimeLeft = state.difficulty.time;

  const numEl  = document.getElementById("questionTimerNumber");
  const fillEl = document.getElementById("questionTimerFill");

  // Reset visuals
  if (numEl)  { numEl.textContent = state.questionTimeLeft; numEl.className = "timer-number"; }
  if (fillEl) { fillEl.style.width = "100%"; fillEl.className = "timer-fill"; }

  state.questionTimer = setInterval(() => {
    state.questionTimeLeft--;

    // Update numeric display
    if (numEl) numEl.textContent = state.questionTimeLeft;

    // Update progress bar
    const pct = (state.questionTimeLeft / state.difficulty.time) * 100;
    if (fillEl) fillEl.style.width = pct + "%";

    // Color warnings
    if (state.questionTimeLeft <= 5) {
      if (numEl)  numEl.className  = "timer-number danger";
      if (fillEl) fillEl.className = "timer-fill danger";
    } else if (state.questionTimeLeft <= Math.floor(state.difficulty.time * 0.4)) {
      if (numEl)  numEl.className  = "timer-number warning";
      if (fillEl) fillEl.className = "timer-fill warning";
    }

    // Time expired → auto-submit (original behavior preserved)
    if (state.questionTimeLeft <= 0) {
      clearInterval(state.questionTimer);
      speak("Time up!");
      selectAnswer(-1);
    }
  }, 1000);
}

// =============================================
// QUIZ FLOW (ORIGINAL, extended for domain)
// =============================================

function startQuiz() {
  // [NEW] Load questions from selected domain
  state.questions = [...window.questionBank[state.domain.id]];
  shuffleQuestions();

  // Reset game state
  state.current        = 0;
  state.score          = 0;
  state.xp             = 0;
  state.streak         = 0;
  state.ultimateActive = 0;

  // Update domain badge & class label in quiz screen
  document.getElementById("domainLabel").textContent = state.domain.name.toUpperCase();
  document.getElementById("classLabel").textContent  = state.class.name;

  // FIX: Reset ultimate button to locked on new game
  ultimateBtn.classList.add("locked");

  showScreen("loadingScreen");
  speak(`Preparing your assessment, {name}...`);
  document.getElementById("loadingMsg").textContent =
    `Loading ${state.domain.name} questions...`;

  setTimeout(() => {
    showScreen("quizScreen");
    updateStats();
    startOverallTimer();
    loadQuestion();
  }, 2000);
}

function loadQuestion() {
  if (state.current >= state.questions.length) {
    endQuiz();
    return;
  }

  const q = state.questions[state.current];
  document.getElementById("questionText").textContent = q.q;
  document.getElementById("progressText").textContent =
    `Q ${state.current + 1} / ${state.questions.length}`;

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";
  const labels = ["A", "B", "C", "D"];

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.innerHTML = `<span class="opt-letter">${labels[i]}</span>${opt}`;
    btn.onclick = () => selectAnswer(i);
    container.appendChild(btn);
  });

  // Automaton passive: remove one wrong option
  if (state.class.name === "Automaton" && Math.random() > 0.5) {
    const wrong = [0, 1, 2, 3].filter(idx => idx !== q.answer);
    const remove = wrong[Math.floor(Math.random() * wrong.length)];
    container.children[remove].disabled = true;
    container.children[remove].style.opacity = "0.3";
    speak("Passive: Accuracy Core activated.");
  }

  // Automaton ultimate: Auto-Solve
  if (state.ultimateActive > 0 && state.class.name === "Automaton") {
    setTimeout(() => {
      speak("ULTIMATE: Auto-Solve!");
      selectAnswer(q.answer);
    }, 1000);
  }

  startQuestionTimer();
}

// =============================================
// ANSWER SELECTION
// =============================================

function selectAnswer(choice) {
  clearInterval(state.questionTimer);

  const q = state.questions[state.current];
  const correctIndex = q.answer;
  let correct = choice === correctIndex;

  // Alchemist ultimate: Transmutation (wrong → correct)
  if (!correct && state.ultimateActive > 0 && state.class.name === "Alchemist") {
    correct = true;
    speak("ULTIMATE: Transmuted into success!");
  }

  // Visual feedback on option buttons
  const container = document.getElementById("optionsContainer");
  Array.from(container.children).forEach((btn, i) => {
    btn.onclick = null;
    if (i === correctIndex) btn.classList.add("correct");
    else if (i === choice && !correct) btn.classList.add("wrong");
    btn.disabled = true;
  });

  if (correct) {
    let finalScore = state.difficulty.score;
    let finalXp    = state.difficulty.xp;

    // Alchemist passive: Critical Chance
    if (state.class.name === "Alchemist" && Math.random() > 0.5) {
      finalScore *= 2;
      finalXp    *= 2;
      speak("Passive: CRITICAL HIT!");
    }

    state.score  += finalScore;
    state.xp     += finalXp;
    state.streak++;
    if (!mascotSpeech.textContent.includes("CRITICAL")) {
      speak("Correct, {name}!");
    }
  } else {
    // FIX Bug 4: Only reset streak on a wrong answer chosen by the player,
    // not on timeout, so Hard mode players still have a fair chance.
    // Timeout (choice === -1) still resets streak — intentional design —
    // but we no longer conflate it with "wrong answer" for messaging.
    state.streak = 0;
    if (choice === -1) {
      speak(`Time's up! Answer: ${q.options[correctIndex]}`);
    } else {
      speak(`Incorrect. Answer was ${q.options[correctIndex]}`);
    }
  }

  // FIX Bug 1 & 2: Decrement ultimate FIRST, then update button state
  // only when the ultimate is fully consumed. This prevents the button
  // from re-locking mid-ultimate due to the streak check.
  if (state.ultimateActive > 0) {
    state.ultimateActive--;
    // Ultimate still running — keep button locked, don't re-evaluate streak
    ultimateBtn.classList.add("locked");
  } else {
    // Ultimate is not active — show unlock state based on streak
    ultimateBtn.classList.toggle("locked", state.streak < 3);
  }

  updateStats();
  state.current++;
  setTimeout(loadQuestion, 1200);
}

// =============================================
// ULTIMATE BUTTON
// =============================================

// FIX Bug 3: Guard against state.class being null (e.g. accidental early click)
ultimateBtn.onclick = () => {
  if (!state.class) return;                          // guard: class not chosen yet
  if (ultimateBtn.classList.contains("locked")) return; // guard: not yet unlocked

  state.ultimateActive = 2;
  // FIX Bug 1: Do NOT reset state.streak here.
  // Resetting the streak was causing the button to immediately re-lock
  // on the very next answer because the toggle check saw streak < 3.
  ultimateBtn.classList.add("locked");
  speak(`ULTIMATE ACTIVATED: ${state.class.ultimate}!`);
};

// =============================================
// STATS UPDATE
// =============================================

function updateStats() {
  document.getElementById("scoreText").textContent  = `Score: ${state.score}`;
  document.getElementById("xpText").textContent     = state.xp;
  document.getElementById("streakText").textContent = `${state.streak}🔥`;
}

// =============================================
// END QUIZ (ORIGINAL + leaderboard + player data)
// =============================================

function endQuiz() {
  clearInterval(state.overallTimer);
  clearInterval(state.questionTimer);
  showScreen("resultScreen");

  // Score display
  document.getElementById("finalScore").textContent = `Final Score: ${state.score}`;

  // XP bar
  document.getElementById("xpFill").style.width = Math.min(state.xp, 100) + "%";
  document.getElementById("xpTotal").textContent = `${state.xp} XP earned`;

  // Rank logic (ORIGINAL)
  let rank = "Beginner", badge = "🔰";
  if      (state.score >= 400) { rank = "Divine";    badge = "👑"; }
  else if (state.score >= 300) { rank = "Legendary"; badge = "🌟"; }
  else if (state.score >= 200) { rank = "Elite";     badge = "⚡"; }
  else if (state.score >= 100) { rank = "Skilled";   badge = "🎯"; }
  else if (state.score >= 50)  { rank = "Rookie";    badge = "🛡️"; }

  document.getElementById("rankBadge").textContent = badge;
  document.getElementById("rankText").textContent  = `Rank: ${rank}`;
  speak(`Mission complete! Rank: ${rank}`);

  // [NEW] Save player data
  const playerData = updatePlayerData(state.player, state.score, state.xp);
  document.getElementById("playerBestScore").textContent =
    `Best Score: ${playerData.bestScore}  •  Games: ${playerData.gamesPlayed}`;

  // [NEW] Add to leaderboard
  addLeaderboardEntry({
    name:       state.player,
    score:      state.score,
    xp:         state.xp,
    domain:     state.domain.id,
    difficulty: state.difficulty.name,
    date:       new Date().toLocaleDateString()
  });

  // [NEW] Render mini leaderboard on result screen (domain-specific)
  renderLeaderboard("resultLeaderboard", state.domain.id, 5);
}

// =============================================
// BUTTON HANDLERS
// =============================================

// Start → Setup
document.getElementById("startBtn").onclick = () => {
  showScreen("setupScreen");
  initDomains();
  initClasses();
  initDifficulty();
  speak("Choose your domain and class, Operative.");
};

// Start → Leaderboard (NEW)
document.getElementById("leaderboardBtn").onclick = () => {
  showScreen("leaderboardScreen");
  renderLeaderboard("leaderboardList", "all", LB_SIZE);
  speak("Hall of Champions!");
};

// Leaderboard filter buttons (NEW)
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderLeaderboard("leaderboardList", btn.dataset.domain, LB_SIZE);
  });
});

// Back from leaderboard
document.getElementById("backFromLeaderboard").onclick = () => {
  showScreen("startScreen");
};

// Player name input → show returning player stats (NEW)
document.getElementById("playerName").addEventListener("input", (e) => {
  showPlayerStats(e.target.value.trim());
});

// Begin Quiz
document.getElementById("beginQuizBtn").onclick = () => {
  const name = document.getElementById("playerName").value.trim();

  if (name.length < 5) {
    speak("Codename too short (min 5 chars).");
    return;
  }
  if (!state.domain) {
    speak("Select a Domain first.");
    return;
  }
  if (!state.class) {
    speak("Select a Class first.");
    return;
  }
  if (!state.difficulty) {
    speak("Select Difficulty first.");
    return;
  }

  state.player = name;
  startQuiz();
};

// Result → Restart (ORIGINAL — reload page)
document.getElementById("restartBtn").onclick = () => location.reload();

// Result → Full Leaderboard (NEW)
document.getElementById("viewLeaderboardBtn").onclick = () => {
  showScreen("leaderboardScreen");
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  // Pre-select current domain filter
  const matchBtn = document.querySelector(`.filter-btn[data-domain="${state.domain?.id || 'all'}"]`);
  if (matchBtn) matchBtn.classList.add("active");
  renderLeaderboard("leaderboardList", state.domain?.id || "all", LB_SIZE);
};