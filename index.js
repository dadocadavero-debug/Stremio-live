const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const STREMVERSE =
  "https://stremverse1.alwaysdata.net";

const HIGHFLY =
  "https://sports.highfly.dev/eyJpbmNsdWRlU3BvcnRzIjpbImZvb3RiYWxsIl0sIm9ubHlMaXZlIjp0cnVlfQ";

const italianTeams = [
  "inter", "inter milan", "internazionale",
  "milan", "ac milan",
  "juventus", "napoli",
  "roma", "as roma", "lazio",
  "atalanta", "bologna", "fiorentina",
  "torino", "genoa", "udinese",
  "cagliari", "lecce", "parma",
  "hellas verona", "verona", "como",
  "cremonese", "sassuolo", "pisa",
  "sampdoria", "palermo", "bari",
  "spezia", "cesena", "catanzaro",
  "modena", "reggiana", "mantova",
  "sudtirol", "südtirol", "carrarese",
  "avellino", "pescara", "monza",
  "empoli", "venezia", "frosinone"
];

const topEuropeanTeams = [
  "real madrid", "barcelona", "fc barcelona",
  "atletico madrid", "atlético madrid",
  "athletic bilbao", "athletic club",
  "villarreal",
  "real betis", "betis",
  "sevilla", "sevilla fc",
  "manchester city", "manchester united",
  "liverpool", "arsenal", "chelsea", "tottenham",
  "newcastle united",
  "bayern munich", "bayern münchen",
  "borussia dortmund", "bayer leverkusen",
  "paris saint-germain", "psg",
  "marseille", "monaco",
  "benfica", "porto",
  "sporting cp", "sporting lisbon",
  "ajax", "psv", "feyenoord"
];

const nationalTeams = [
  "italy", "italia", "france", "germany",
  "spain", "england", "portugal",
  "netherlands", "belgium", "croatia",
  "argentina", "brazil", "uruguay",
  "colombia", "mexico",
  "united states", "usa",
  "japan", "morocco"
];

const wantedTeams = [
  ...italianTeams,
  ...topEuropeanTeams,
  ...nationalTeams
];

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ac|ssc|ss|as)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unwanted(name = "") {
  const title = name.toLowerCase();

  return (
    /\bw\b|\bwomen\b|\bfemale\b|\bfemminile\b/i.test(title) ||
    /\bu(?:15|16|17|18|19|20|21|22|23)\b/i.test(title) ||
    /\byouth\b|\bgiovanili\b|\bprimavera\b/i.test(title) ||
    /\breserves?\b|\bb team\b|\bteam b\b/i.test(title)
  );
}

function wanted(meta = {}) {
  const text = `${meta.name || ""} ${meta.description || ""}`;

  if (unwanted(text)) return false;

  const n = normalize(text);

  return wantedTeams.some(team => {
    const t = normalize(team);
    return new RegExp(`(^| )${escapeRegex(t)}( |$)`, "i").test(n);
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function live(meta) {
  const text = `${meta.name || ""} ${meta.description || ""}`;

  return (
    /LIVE\s*NOW/i.test(text) ||
    /\bLIVE\b/i.test(text) ||
    /🔴/.test(text)
  );
}

function cleanMatchName(name = "") {
  let n = normalize(
    name
      .replace(/LIVE\s*NOW/gi, "")
      .replace(/\bLIVE\b/gi, "")
      .replace(/🔴/g, "")
  );

  n = n
    .replace(/\binter milan\b/g, "inter")
    .replace(/\binternazionale\b/g, "inter")
    .replace(/\bbayern munich\b/g, "bayern")
    .replace(/\bbayern munchen\b/g, "bayern")
    .replace(/\bparis saint germain\b/g, "psg")
    .replace(/\bsporting lisbon\b/g, "sporting")
    .replace(/\bathletic club\b/g, "athletic bilbao");

  return n.replace(/\s+/g, " ").trim();
}

  return n.replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Stremio-LIVE/1.0"
      }
    });

    if (!r.ok) throw new Error(`${r.status} ${url}`);

    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getCatalogs() {
  const urls = [
    `${STREMVERSE}/catalog/tv/stremverse_live_events/genre=Football.json`,
    `${HIGHFLY}/catalog/sport/sports_live.json`
  ];

  const results = await Promise.allSettled(
    urls.map(url => getJson(url))
  );

  const all = [];

  if (results[0].status === "fulfilled") {
  for (const meta of results[0].value.metas || []) {
    if (!wanted(meta)) continue;
// if (!live(meta)) continue;

      all.push({
        ...meta,
        id: `sv:${meta.id}`,
        type: "tv",
        _source: "sv",
        _originalId: meta.id
      });
    }
  }

  if (results[1].status === "fulfilled") {
  for (const meta of results[1].value.metas || []) {
    if (!wanted(meta)) continue;
    all.push({
      ...meta,
      id: `hf:${meta.id}`,
      type: "tv",
      _source: "hf",
      _originalId: meta.id
    });
  }
}

  const groups = new Map();

  for (const meta of all) {
    const key = cleanMatchName(meta.name);

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meta);
  }

  const metas = [];

  for (const [key, items] of groups) {
    const first = items[0];

    const sources = items.map(item => ({
      source: item._source,
      id: item._originalId
    }));

    const encoded = Buffer.from(
      JSON.stringify(sources)
    ).toString("base64url");

    metas.push({
      id: `live:${encoded}`,
      type: "tv",
      name: first.name,
      poster: first.poster,
      background: first.background,
      logo: first.logo,
      description: first.description || "LIVE",
      genres: ["Football", "LIVE"]
    });
  }

  return metas;
}

const manifest = {
  id: "community.stremio.live.football",
  version: "1.0.0",
  name: "LIVE",
  description: "LIVE Football - StremVerse + Highfly",
  resources: ["catalog", "meta", "stream"],
  types: ["tv"],
  catalogs: [
    {
      type: "tv",
      id: "live_football",
      name: "🔴 LIVE Football ⚽"
    }
  ],
  idPrefixes: ["live:"]
};

app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});

app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/catalog/tv/live_football.json", async (req, res) => {
  try {
    res.json({
      metas: await getCatalogs()
    });
  } catch (e) {
    console.error(e);
    res.json({ metas: [] });
  }
});

function decodeSources(id) {
  if (!id.startsWith("live:")) return [];

  try {
    return JSON.parse(
      Buffer.from(
        id.substring(5),
        "base64url"
      ).toString()
    );
  } catch {
    return [];
  }
}

app.get("/meta/tv/:id.json", async (req, res) => {
  try {
    const metas = await getCatalogs();
    const meta = metas.find(m => m.id === req.params.id);

    res.json({
      meta: meta || null
    });
  } catch (e) {
    console.error(e);
    res.json({ meta: null });
  }
});

app.get("/stream/tv/:id.json", async (req, res) => {
  const sources = decodeSources(req.params.id);

  const requests = sources.map(async src => {
    let url;

    if (src.source === "sv") {
      url =
        `${STREMVERSE}/stream/tv/${encodeURIComponent(src.id)}.json`;
    } else {
      url =
        `${HIGHFLY}/stream/sport/${encodeURIComponent(src.id)}.json`;
    }

    try {
      const data = await getJson(url);

      return (data.streams || []).map(stream => ({
        ...stream,
        name:
          src.source === "sv"
            ? `StremVerse • ${stream.name || "LIVE"}`
            : `Highfly • ${stream.name || "LIVE"}`
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const results = await Promise.all(requests);
  const streams = results.flat();

  res.json({ streams });
});

app.get("/debug/highfly", async (req, res) => {
  try {
    const data = await getJson(
      `${HIGHFLY}/catalog/sport/sports_live.json`
    );

    const metas = (data.metas || []).map(meta => ({
      id: meta.id,
      name: meta.name,
      description: meta.description
    }));

    res.json({
      count: metas.length,
      metas
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: String(e)
    });
  }
});

app.get("/debug/final", async (req, res) => {
  try {
    const metas = await getCatalogs();

    res.json({
      count: metas.length,
      metas: metas.map(meta => ({
        id: meta.id,
        name: meta.name,
        description: meta.description
      }))
    });
  } catch (e) {
    res.status(500).json({
      error: String(e)
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
