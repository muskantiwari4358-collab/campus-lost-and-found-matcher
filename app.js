const STORAGE_KEY = "campus-lost-found-matcher-reports";

const demoReports = [
  {
    id: crypto.randomUUID(),
    type: "lost",
    title: "Blue Wildcraft backpack",
    category: "Bag",
    color: "Blue",
    brand: "Wildcraft",
    location: "Central Library",
    date: "2026-03-31",
    description: "Laptop sleeve inside, one robotics club badge attached near the top zip."
  },
  {
    id: crypto.randomUUID(),
    type: "found",
    title: "Blue backpack with club badge",
    category: "Bag",
    color: "Blue",
    brand: "Wildcraft",
    location: "Central Library",
    date: "2026-04-01",
    description: "Found near the second floor reading area. Has a robotics sticker and black bottle pocket."
  },
  {
    id: crypto.randomUUID(),
    type: "lost",
    title: "Black student ID card holder",
    category: "ID Card",
    color: "Black",
    brand: "",
    location: "Lecture Hall Complex",
    date: "2026-04-01",
    description: "Contains IIT internship application receipt and a red metro card."
  },
  {
    id: crypto.randomUUID(),
    type: "found",
    title: "ID card pouch with metro card",
    category: "ID Card",
    color: "Black",
    brand: "",
    location: "Lecture Hall Complex",
    date: "2026-04-02",
    description: "Found outside LT-3. Black pouch with institute card and red travel card."
  },
  {
    id: crypto.randomUUID(),
    type: "found",
    title: "Silver Casio calculator",
    category: "Electronics",
    color: "Silver",
    brand: "Casio",
    location: "Computer Lab",
    date: "2026-04-01",
    description: "Scientific calculator with small scratch near the display."
  }
];

const locationClusters = {
  "Central Library": "Academic Core",
  "Lecture Hall Complex": "Academic Core",
  "Computer Lab": "Academic Core",
  "Main Cafeteria": "Student Life",
  "Hostel Block A": "Residential",
  "Sports Complex": "Student Life",
  "Auditorium": "Events"
};

const form = document.getElementById("report-form");
const reportsList = document.getElementById("reports-list");
const matchesList = document.getElementById("matches-list");
const statusFilter = document.getElementById("status-filter");
const formMessage = document.getElementById("form-message");
const seedButton = document.getElementById("seed-demo");

const openCount = document.getElementById("open-count");
const matchCount = document.getElementById("match-count");
const hotspotLabel = document.getElementById("hotspot-label");

let reports = loadReports();

seedButton.addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoReports));
  reports = loadReports();
  render();
  formMessage.textContent = "Demo data reloaded.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const report = {
    id: crypto.randomUUID(),
    type: formData.get("type"),
    title: formData.get("title").trim(),
    category: formData.get("category"),
    color: formData.get("color").trim(),
    brand: formData.get("brand").trim(),
    location: formData.get("location"),
    date: formData.get("date"),
    description: formData.get("description").trim()
  };

  reports = [report, ...reports];
  persistReports();
  form.reset();
  form.querySelector('input[name="type"][value="lost"]').checked = true;
  formMessage.textContent = `Saved ${report.type} report for "${report.title}".`;
  render();
});

statusFilter.addEventListener("change", renderReports);

function loadReports() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoReports));
  return [...demoReports];
}

function persistReports() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function overlapScore(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

function dateDistanceDays(first, second) {
  const start = new Date(first);
  const end = new Date(second);
  const diff = Math.abs(end - start);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function scorePair(lost, found) {
  let score = 0;
  const reasons = [];

  if (lost.category === found.category) {
    score += 24;
    reasons.push("same category");
  }

  if (lost.color.toLowerCase() === found.color.toLowerCase()) {
    score += 16;
    reasons.push("same color");
  }

  if (lost.brand && found.brand && lost.brand.toLowerCase() === found.brand.toLowerCase()) {
    score += 18;
    reasons.push("same brand");
  }

  if (lost.location === found.location) {
    score += 18;
    reasons.push("same location");
  } else if (locationClusters[lost.location] && locationClusters[lost.location] === locationClusters[found.location]) {
    score += 8;
    reasons.push("same campus zone");
  }

  const textScore = overlapScore(`${lost.title} ${lost.description}`, `${found.title} ${found.description}`);
  if (textScore > 0) {
    score += Math.round(textScore * 28);
    reasons.push("description overlap");
  }

  const dayGap = dateDistanceDays(lost.date, found.date);
  if (dayGap === 0) {
    score += 12;
    reasons.push("same day");
  } else if (dayGap <= 2) {
    score += 8;
    reasons.push("close dates");
  } else if (dayGap <= 5) {
    score += 4;
  }

  return {
    score: Math.min(score, 100),
    reasons
  };
}

function computeMatches() {
  const lostReports = reports.filter((report) => report.type === "lost");
  const foundReports = reports.filter((report) => report.type === "found");
  const pairs = [];

  lostReports.forEach((lost) => {
    foundReports.forEach((found) => {
      const result = scorePair(lost, found);
      if (result.score >= 35) {
        pairs.push({
          lost,
          found,
          score: result.score,
          reasons: result.reasons
        });
      }
    });
  });

  return pairs.sort((a, b) => b.score - a.score);
}

function renderStats(matches) {
  openCount.textContent = reports.length;
  matchCount.textContent = matches.filter((match) => match.score >= 70).length;

  const counts = reports.reduce((acc, report) => {
    acc[report.location] = (acc[report.location] || 0) + 1;
    return acc;
  }, {});

  const hotspot = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  hotspotLabel.textContent = hotspot ? hotspot[0] : "No data yet";
}

function renderMatches() {
  const matches = computeMatches();
  renderStats(matches);

  if (!matches.length) {
    matchesList.innerHTML = `
      <article class="empty-state">
        <strong>No strong matches yet</strong>
        <p>Add more reports to see likely lost and found pairs appear here.</p>
      </article>
    `;
    return;
  }

  matchesList.innerHTML = matches
    .slice(0, 8)
    .map(
      (match) => `
        <article class="match-card">
          <div class="match-top">
            <span class="chip lost">Lost item</span>
            <span class="chip found">Found item</span>
            <span class="confidence">${match.score}/100</span>
          </div>
          <div class="pair-grid">
            <section class="pair-panel">
              <strong>${match.lost.title}</strong>
              <p>${match.lost.description}</p>
              <div class="badge-row">
                <span class="chip">${match.lost.category}</span>
                <span class="chip">${match.lost.color}</span>
                <span class="chip">${match.lost.location}</span>
              </div>
            </section>
            <section class="pair-panel">
              <strong>${match.found.title}</strong>
              <p>${match.found.description}</p>
              <div class="badge-row">
                <span class="chip">${match.found.category}</span>
                <span class="chip">${match.found.color}</span>
                <span class="chip">${match.found.location}</span>
              </div>
            </section>
          </div>
          <p><strong>Why this match:</strong> ${match.reasons.join(", ")}.</p>
        </article>
      `
    )
    .join("");
}

function renderReports() {
  const filter = statusFilter.value;
  const visibleReports = reports.filter((report) => filter === "all" || report.type === filter);

  if (!visibleReports.length) {
    reportsList.innerHTML = `
      <article class="empty-state">
        <strong>No reports to show</strong>
        <p>Try switching the filter or creating a new report.</p>
      </article>
    `;
    return;
  }

  reportsList.innerHTML = visibleReports
    .map(
      (report) => `
        <article class="report-card">
          <div class="report-meta">
            <span class="chip ${report.type}">${report.type.toUpperCase()}</span>
            <span class="chip">${report.category}</span>
            <span class="chip">${report.location}</span>
            <span class="chip">${report.date}</span>
          </div>
          <strong>${report.title}</strong>
          <p>${report.description}</p>
          <div class="badge-row">
            <span class="chip">Color: ${report.color}</span>
            <span class="chip">Brand: ${report.brand || "Not specified"}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function render() {
  renderMatches();
  renderReports();
}

render();
