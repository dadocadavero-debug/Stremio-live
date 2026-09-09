const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const STREMVERSE =
  "https://stremverse1.alwaysdata.net";

const HIGHFLY =
  "https://sports.highfly.dev/eyJpbmNsdWRlU3BvcnRzIjpbImZvb3RiYWxsIl19";

const API_FOOTBALL_KEY =
  process.env.API_FOOTBALL_KEY;


/* =========================================================
   SQUADRE
========================================================= */

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
  "real madrid",
  "barcelona", "fc barcelona",
  "atletico madrid", "atlético madrid",
  "athletic bilbao", "athletic club",
  "villarreal",
  "real betis", "betis",
  "sevilla", "sevilla fc",

  "manchester city",
  "manchester united",
  "liverpool",
  "arsenal",
  "chelsea",
  "tottenham",
  "newcastle united",

  "bayern munich", "bayern münchen",
  "borussia dortmund",
  "bayer leverkusen",

  "paris saint-germain",
  "paris saint germain",
  "psg",
  "marseille",
  "monaco",

  "benfica",
  "porto",
  "sporting cp",
  "sporting lisbon",

  "ajax",
  "psv",
  "feyenoord"
];

const nationalTeams = [
  "italy", "italia",
  "france",
  "germany",
  "spain",
  "england",
  "portugal",
  "netherlands",
  "belgium",
  "croatia",
  "argentina",
  "brazil",
  "uruguay",
  "colombia",
  "mexico",
  "united states",
  "usa",
  "japan",
  "morocco"
];


/* =========================================================
   NORMALIZZAZIONE
========================================================= */

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


/* =========================================================
   ESCLUSIONI
========================================================= */

function unwanted(name = "") {
  return (
    /\bwomen\b|\bfemale\b|\bfemminile\b/i.test(name) ||
    /\bu(?:15|16|17|18|19|20|21|22|23)\b/i.test(name) ||
    /\byouth\b|\bgiovanili\b|\bprimavera\b/i.test(name) ||
    /\breserves?\b|\bb team\b|\bteam b\b/i.test(name)
  );
}


/* =========================================================
   CONFRONTO NOMI SQUADRE
========================================================= */

const teamAliases = {
  "inter milan": "inter",
  "internazionale": "inter",

  "ac milan": "milan",

  "fc barcelona": "barcelona",

  "atletico de madrid": "atletico madrid",
  "atlético madrid": "atletico madrid",

  "paris saint germain": "psg",
  "paris saint-germain": "psg",

  "bayern munich": "bayern",
  "bayern munchen": "bayern",

  "borussia dortmund": "dortmund",

  "sporting lisbon": "sporting",
  "sporting cp": "sporting",

  "manchester united": "man united",
  "manchester city": "man city",

  "newcastle united": "newcastle",

  "sevilla fc": "sevilla",

  "hellas verona": "verona"
};

function canonicalTeam(name = "") {
  let n = normalize(name);

  if (teamAliases[n]) {
    n = teamAliases[n];
  }

  return n;
}


/* =========================================================
   FILTRO API-FOOTBALL

   IMPORTANTE:
   controlliamo home e away separatamente.
   Quindi "New England Patriots" NON corrisponde
   alla nazionale "England".
========================================================= */

const wantedClubNames = [
  ...italianTeams,
  ...topEuropeanTeams
].map(canonicalTeam);

const wantedNationalNames =
  nationalTeams.map(canonicalTeam);

function exactWantedTeam(name = "") {
  const n = canonicalTeam(name);

  return (
    wantedClubNames.includes(n) ||
    wantedNationalNames.includes(n)
  );
}

function wantedFixture(home = "", away = "") {
  if (unwanted(home) || unwanted(away)) {
    return false;
  }

  return (
    exactWantedTeam(home) ||
    exactWantedTeam(away)
  );
}


/* =========================================================
   FETCH JSON
========================================================= */

async function getJson(url, options = {}) {
  const controller = new AbortController();

  const timer =
    setTimeout(() => controller.abort(), 12000);

  try {
    const r = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Stremio-LIVE/2.0",
        ...(options.headers || {})
      }
    });

    if (!r.ok) {
      throw new Error(`${r.status} ${url}`);
    }

    return await r.json();

  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   DATE

   prendiamo:
   oggi + domani

   Così le partite imminenti possono comparire
   anche prima del giorno della gara.
========================================================= */

function dateString(offsetDays = 0) {
  const d = new Date();

  d.setUTCDate(
    d.getUTCDate() + offsetDays
  );

  return d.toISOString().slice(0, 10);
}


/* =========================================================
   CACHE API-FOOTBALL
========================================================= */

let fixtureCache = {
  expires: 0,
  fixtures: []
};

const FIXTURE_CACHE_MS =
  10 * 60 * 1000;


/* =========================================================
   API-FOOTBALL
========================================================= */

async function getApiFixtures() {

  if (
    fixtureCache.expires > Date.now() &&
    fixtureCache.fixtures.length
  ) {
    return fixtureCache.fixtures;
  }

  if (!API_FOOTBALL_KEY) {
    throw new Error(
      "API_FOOTBALL_KEY non configurata"
    );
  }

  const from = dateString(0);
  const to = dateString(1);

  const url =
    "https://v3.football.api-sports.io/fixtures" +
    `?from=${from}&to=${to}`;

  const data = await getJson(url, {
    headers: {
      "x-apisports-key":
        API_FOOTBALL_KEY
    }
  });

  if (
    data.errors &&
    Object.keys(data.errors).length
  ) {
    console.error(
      "API-Football errors:",
      data.errors
    );
  }

  const fixtures =
    (data.response || [])
      .map(item => ({
        fixtureId:
          item.fixture?.id,

        date:
          item.fixture?.date,

        timestamp:
          item.fixture?.timestamp,

        status:
          item.fixture?.status?.short,

        league:
          item.league?.name || "",

        country:
          item.league?.country || "",

        home:
          item.teams?.home?.name || "",

        away:
          item.teams?.away?.name || "",

        homeLogo:
          item.teams?.home?.logo,

        awayLogo:
          item.teams?.away?.logo
      }))
      .filter(item =>
        item.fixtureId &&
        wantedFixture(
          item.home,
          item.away
        )
      );

  fixtures.sort(
    (a, b) =>
      (a.timestamp || 0) -
      (b.timestamp || 0)
  );

  fixtureCache = {
    expires:
      Date.now() + FIXTURE_CACHE_MS,

    fixtures
  };

  return fixtures;
}


/* =========================================================
   CATALOGO STREMIO DA API-FOOTBALL
========================================================= */

async function getCatalogs() {

  const fixtures =
    await getApiFixtures();

  return fixtures.map(match => {

    const title =
      `${match.home} vs ${match.away}`;

    const time =
      match.date
        ? new Date(match.date)
            .toLocaleString(
              "it-IT",
              {
                timeZone: "Europe/Rome",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              }
            )
        : "";

    return {
      /*
        ID CORTISSIMO.
        Niente più Base64 da 300/400 caratteri.
      */
      id:
        `live:${match.fixtureId}`,

      type: "tv",

      name: title,

      /*
        Per ora usiamo il logo della squadra di casa
        come poster.

        Successivamente possiamo creare poster
        personalizzati con entrambe le squadre.
      */
      poster:
        match.homeLogo,

      description:
        `${match.league}` +
        (time ? ` • ${time}` : ""),

      genres: [
        "Football"
      ]
    };
  });
}


/* =========================================================
   CATALOGHI DEI PROVIDER

   Servono SOLO per trovare la partita e gli stream.
========================================================= */

async function getProviderEvents() {

  const sources = [
    {
      source: "sv",
      url:
        `${STREMVERSE}/catalog/tv/` +
        `stremverse_live_events/genre=Football.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_live.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_today.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_football.json`
    }
  ];

  const results =
    await Promise.allSettled(
      sources.map(item =>
        getJson(item.url)
      )
    );

  const events = [];

  const seen = new Set();

  results.forEach(
    (result, index) => {

      if (
        result.status !==
        "fulfilled"
      ) {
        return;
      }

      const source =
        sources[index].source;

      for (
        const meta of
        result.value.metas || []
      ) {

        const key =
          `${source}:${meta.id}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        events.push({
          source,
          id: meta.id,
          name: meta.name || ""
        });
      }
    }
  );

  return events;
}


/* =========================================================
   MATCHING PARTITA ↔ PROVIDER
========================================================= */

function eventMatchesFixture(
  eventName,
  home,
  away
) {

  const event =
    canonicalTeam(eventName);

  const h =
    canonicalTeam(home);

  const a =
    canonicalTeam(away);

  /*
    Il nome dell'evento deve contenere
    ENTRAMBE le squadre.

    Evita di associare una partita
    soltanto perché contiene "Inter",
    "Roma", ecc.
  */

  return (
    event.includes(h) &&
    event.includes(a)
  );
}


/* =========================================================
   TROVA FIXTURE DALL'ID
========================================================= */

async function findFixture(id) {

  if (!id.startsWith("live:")) {
    return null;
  }

  const fixtureId =
    Number(id.substring(5));

  if (!fixtureId) {
    return null;
  }

  const fixtures =
    await getApiFixtures();

  return (
    fixtures.find(
      item =>
        item.fixtureId === fixtureId
    ) || null
  );
}


/* =========================================================
   MANIFEST
========================================================= */

const manifest = {
  id:
    "community.stremio.live.football",

  /*
    Nuova versione perché abbiamo
    cambiato completamente il catalogo.
  */
  version: "2.0.0",

  name: "LIVE",

  description:
    "Football calendar + StremVerse + Highfly streams",

  resources: [
    "catalog",
    "meta",
    "stream"
  ],

  types: ["tv"],

  catalogs: [
    {
      type: "tv",

      /*
        NUOVO ID per evitare la cache
        del vecchio catalogo.
      */
      id: "live_football_v3",

      name: "🔴 LIVE Football ⚽"
    }
  ],

  idPrefixes: ["live:"]
};


/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});


/* =========================================================
   MANIFEST
========================================================= */

app.get(
  "/manifest.json",
  (req, res) => {
    res.json(manifest);
  }
);


/* =========================================================
   CATALOGO
========================================================= */

app.get(
  "/catalog/tv/live_football_v3.json",
  async (req, res) => {

    try {

      const metas =
        await getCatalogs();

      res.json({
        metas
      });

    } catch (e) {

      console.error(e);

      res.json({
        metas: []
      });
    }
  }
);


/* =========================================================
   META
========================================================= */

app.get(
  "/meta/tv/:id.json",
  async (req, res) => {

    try {

      const metas =
        await getCatalogs();

      const meta =
        metas.find(
          m =>
            m.id === req.params.id
        );

      res.json({
        meta: meta || null
      });

    } catch (e) {

      console.error(e);

      res.json({
        meta: null
      });
    }
  }
);


/* =========================================================
   STREAM

   Qui avviene la parte importante:
   API-Football identifica la partita,
   StremVerse + Highfly danno gli stream.
========================================================= */

app.get(
  "/stream/tv/:id.json",
  async (req, res) => {

    try {

      const fixture =
        await findFixture(
          req.params.id
        );

      if (!fixture) {

        return res.json({
          streams: []
        });
      }


      const events =
        await getProviderEvents();


      const matching =
        events.filter(event =>
          eventMatchesFixture(
            event.name,
            fixture.home,
            fixture.away
          )
        );


      const requests =
        matching.map(
          async event => {

            let url;

            if (
              event.source === "sv"
            ) {

              url =
                `${STREMVERSE}/stream/tv/` +
                `${encodeURIComponent(event.id)}.json`;

            } else {

              url =
                `${HIGHFLY}/stream/sport/` +
                `${encodeURIComponent(event.id)}.json`;
            }


            try {

              const data =
                await getJson(url);

              return (
                data.streams || []
              ).map(stream => ({
                ...stream,

                name:
                  event.source === "sv"
                    ? `StremVerse • ${stream.name || "LIVE"}`
                    : `Highfly • ${stream.name || "LIVE"}`
              }));

            } catch (e) {

              console.error(
                "Stream error:",
                event.name,
                e
              );

              return [];
            }
          }
        );


      const results =
        await Promise.all(
          requests
        );


      res.json({
        streams:
          results.flat()
      });

    } catch (e) {

      console.error(e);

      res.json({
        streams: []
      });
    }
  }
);


/* =========================================================
   DEBUG NUOVO CATALOGO
========================================================= */

app.get(
  "/debug/catalog",
  async (req, res) => {

    try {

      const fixtures =
        await getApiFixtures();

      res.json({
        count:
          fixtures.length,

        fixtures:
          fixtures.map(f => ({
            id:
              `live:${f.fixtureId}`,

            home: f.home,

            away: f.away,

            league:
              f.league,

            date:
              f.date
          }))
      });

    } catch (e) {

      res.status(500).json({
        error: String(e)
      });
    }
  }
);


/* =========================================================
   DEBUG MATCHING STREAM
========================================================= */

app.get(
  "/debug/match/:fixtureId",
  async (req, res) => {

    try {

      const fixture =
        await findFixture(
          `live:${req.params.fixtureId}`
        );

      if (!fixture) {

        return res.status(404).json({
          error:
            "Fixture non trovata"
        });
      }

      const events =
        await getProviderEvents();

      const matches =
        events.filter(event =>
          eventMatchesFixture(
            event.name,
            fixture.home,
            fixture.away
          )
        );

      res.json({
        fixture: {
          home:
            fixture.home,

          away:
            fixture.away,

          league:
            fixture.league
        },

        providerMatches:
          matches
      });

    } catch (e) {

      res.status(500).json({
        error: String(e)
      });
    }
  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
const topEuropeanTeams = [
  "real madrid",
  "barcelona", "fc barcelona",
  "atletico madrid", "atlético madrid",
  "athletic bilbao", "athletic club",
  "villarreal",
  "real betis", "betis",
  "sevilla", "sevilla fc",

  "manchester city",
  "manchester united",
  "liverpool",
  "arsenal",
  "chelsea",
  "tottenham",
  "newcastle united",

  "bayern munich", "bayern münchen",
  "borussia dortmund",
  "bayer leverkusen",

  "paris saint-germain",
  "paris saint germain",
  "psg",
  "marseille",
  "monaco",

  "benfica",
  "porto",
  "sporting cp",
  "sporting lisbon",

  "ajax",
  "psv",
  "feyenoord"
];

const nationalTeams = [
  "italy", "italia",
  "france",
  "germany",
  "spain",
  "england",
  "portugal",
  "netherlands",
  "belgium",
  "croatia",
  "argentina",
  "brazil",
  "uruguay",
  "colombia",
  "mexico",
  "united states",
  "usa",
  "japan",
  "morocco"
];

const wantedTeams = [
  ...italianTeams,
  ...topEuropeanTeams,
  ...nationalTeams
];


/* =========================================================
   NORMALIZZAZIONE
========================================================= */

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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


/* =========================================================
   ESCLUSIONI
========================================================= */

function unwanted(name = "") {
  const title = name.toLowerCase();

  return (
    /\bw\b|\bwomen\b|\bfemale\b|\bfemminile\b/i.test(title) ||
    /\bu(?:15|16|17|18|19|20|21|22|23)\b/i.test(title) ||
    /\byouth\b|\bgiovanili\b|\bprimavera\b/i.test(title) ||
    /\breserves?\b|\bb team\b|\bteam b\b/i.test(title)
  );
}


/* =========================================================
   FILTRO SQUADRE
========================================================= */

function wanted(meta = {}) {
  const text =
    `${meta.name || ""} ${meta.description || ""}`;

  if (unwanted(text)) return false;

  const n = normalize(text);

  return wantedTeams.some(team => {
    const t = normalize(team);

    return new RegExp(
      `(^| )${escapeRegex(t)}( |$)`,
      "i"
    ).test(n);
  });
}


/* =========================================================
   NOME PARTITA PER DEDUPLICAZIONE
========================================================= */

function cleanMatchName(name = "") {
  let n = normalize(
    name
      .replace(/LIVE\s*NOW/gi, "")
      .replace(/\bLIVE\b/gi, "")
      .replace(/🔴/g, "")
  );

  const aliases = {
    "inter milan": "inter",
    "internazionale": "inter",

    "fc barcelona": "barcelona",

    "atletico madrid": "atletico madrid",
    "athletic club": "athletic bilbao",

    "bayern munich": "bayern",
    "bayern munchen": "bayern",

    "borussia dortmund": "dortmund",

    "paris saint germain": "psg",

    "sporting lisbon": "sporting",
    "sporting cp": "sporting",

    "manchester united": "man united",
    "manchester city": "man city",

    "newcastle united": "newcastle",

    "sevilla fc": "sevilla",

    "villarreal cf": "villarreal"
  };

  const sortedAliases =
    Object.keys(aliases)
      .sort((a, b) => b.length - a.length);

  for (const alias of sortedAliases) {
    const canonical = aliases[alias];

    n = n.replace(
      new RegExp(
        `(^| )${escapeRegex(alias)}(?= |$)`,
        "g"
      ),
      `$1${canonical}`
    );
  }

  return n
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   FETCH
========================================================= */

async function getJson(url) {
  const controller = new AbortController();

  const timer =
    setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Stremio-LIVE/1.0"
      }
    });

    if (!r.ok) {
      throw new Error(`${r.status} ${url}`);
    }

    return await r.json();

  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   CATALOGO UNIFICATO
========================================================= */

async function getCatalogs() {

  /*
    1 = StremVerse Football
    2 = Highfly Live
    3 = Highfly Today
    4 = Highfly Football

    Sono QUATTRO sorgenti interne,
    ma Stremio vedrà sempre UN SOLO catalogo.
  */

  const sourcesToFetch = [
    {
      source: "sv",
      url:
        `${STREMVERSE}/catalog/tv/stremverse_live_events/genre=Football.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/sports_live.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/sports_today.json`
    },

    {
      source: "hf",
      url:
        `${HIGHFLY}/catalog/sport/sports_football.json`
    }
  ];

  const results = await Promise.allSettled(
    sourcesToFetch.map(item => getJson(item.url))
  );

  const all = [];

  /*
    Evita che lo stesso ID Highfly venga aggiunto
    più volte perché presente in live/today/football.
  */
  const sourceIds = new Set();


  for (let i = 0; i < results.length; i++) {

    const result = results[i];
    const sourceInfo = sourcesToFetch[i];

    if (result.status !== "fulfilled") {
      console.error(
        "Catalog error:",
        sourceInfo.url,
        result.reason
      );

      continue;
    }

    const metas = result.value.metas || [];

    for (const meta of metas) {

      if (!wanted(meta)) continue;

      const uniqueSourceId =
        `${sourceInfo.source}:${meta.id}`;

      if (sourceIds.has(uniqueSourceId)) {
        continue;
      }

      sourceIds.add(uniqueSourceId);

      all.push({
        ...meta,

        id:
          `${sourceInfo.source}:${meta.id}`,

        type: "tv",

        _source:
          sourceInfo.source,

        _originalId:
          meta.id
      });
    }
  }


  /* =======================================================
     RAGGRUPPA LA STESSA PARTITA
  ======================================================= */

  const groups = new Map();

  for (const meta of all) {

    const key =
      cleanMatchName(meta.name);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(meta);
  }


  /* =======================================================
     CREA METAS FINALI
  ======================================================= */

  const metas = [];

  for (const [key, items] of groups) {

    /*
      Se la stessa partita esiste sia su
      StremVerse che Highfly,
      preferiamo poster/metadati StremVerse.
    */

    const first =
      items.find(
        item => item._source === "sv"
      ) || items[0];


    /*
      Una partita può avere più sorgenti stream.
    */

    const sources = [];

    const seenSources = new Set();

    for (const item of items) {

      const sourceKey =
        `${item._source}:${item._originalId}`;

      if (seenSources.has(sourceKey)) {
        continue;
      }

      seenSources.add(sourceKey);

      sources.push({
        source: item._source,
        id: item._originalId
      });
    }


    const encoded =
      Buffer.from(
        JSON.stringify(sources)
      ).toString("base64url");


    metas.push({
      id: `live:${encoded}`,

      type: "tv",

      name: first.name,

      poster: first.poster,

      background: first.background,

      logo: first.logo,

      description:
        first.description || "Football",

      genres: ["Football"]
    });
  }


  return metas;
}


/* =========================================================
   MANIFEST
========================================================= */

const manifest = {
  id: "community.stremio.live.football",

  version: "1.0.1",

  name: "LIVE",

  description:
    "LIVE Football - StremVerse + Highfly",

  resources: [
    "catalog",
    "meta",
    "stream"
  ],

  types: ["tv"],

  catalogs: [
    {
      type: "tv",

      id: "live_football_v2",

      name: "🔴 LIVE Football ⚽"
    }
  ],

  idPrefixes: ["live:"]
};


/* =========================================================
   ROUTES
========================================================= */

app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});


app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});


app.get(
  "/catalog/tv/live_football_v2.json",
  async (req, res) => {

    try {

      res.json({
        metas: await getCatalogs()
      });

    } catch (e) {

      console.error(e);

      res.json({
        metas: []
      });
    }
  }
);


/* =========================================================
   DECODE SOURCES
========================================================= */

function decodeSources(id) {

  if (!id.startsWith("live:")) {
    return [];
  }

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


/* =========================================================
   META
========================================================= */

app.get(
  "/meta/tv/:id.json",
  async (req, res) => {

    try {

      const metas =
        await getCatalogs();

      const meta =
        metas.find(
          m => m.id === req.params.id
        );

      res.json({
        meta: meta || null
      });

    } catch (e) {

      console.error(e);

      res.json({
        meta: null
      });
    }
  }
);


/* =========================================================
   STREAM
========================================================= */

app.get(
  "/stream/tv/:id.json",
  async (req, res) => {

    const sources =
      decodeSources(req.params.id);

    const requests =
      sources.map(async src => {

        let url;

        if (src.source === "sv") {

          url =
            `${STREMVERSE}/stream/tv/` +
            `${encodeURIComponent(src.id)}.json`;

        } else {

          url =
            `${HIGHFLY}/stream/sport/` +
            `${encodeURIComponent(src.id)}.json`;
        }


        try {

          const data =
            await getJson(url);

          return (data.streams || [])
            .map(stream => ({
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


    const results =
      await Promise.all(requests);

    const streams =
      results.flat();

    res.json({
      streams
    });
  }
);


/* =========================================================
   DEBUG STREMVERSE
========================================================= */

app.get(
  "/debug/stremverse",
  async (req, res) => {

    try {

      const data =
        await getJson(
          `${STREMVERSE}/catalog/tv/stremverse_live_events/genre=Football.json`
        );

      const metas =
        (data.metas || [])
          .map(meta => ({
            id: meta.id,
            name: meta.name,
            description: meta.description,
            wanted: wanted(meta)
          }));

      res.json({
        count: metas.length,
        metas
      });

    } catch (e) {

      res.status(500).json({
        error: String(e)
      });
    }
  }
);


/* =========================================================
   DEBUG HIGHFLY
========================================================= */

app.get(
  "/debug/highfly",
  async (req, res) => {

    const catalogs = [
      "sports_live",
      "sports_today",
      "sports_football"
    ];

    const output = {};

    for (const catalog of catalogs) {

      try {

        const data =
          await getJson(
            `${HIGHFLY}/catalog/sport/${catalog}.json`
          );

        output[catalog] = {
          count: (data.metas || []).length,

          metas:
            (data.metas || [])
              .map(meta => ({
                id: meta.id,
                name: meta.name,
                description: meta.description,
                wanted: wanted(meta)
              }))
        };

      } catch (e) {

        output[catalog] = {
          error: String(e)
        };
      }
    }

    res.json(output);
  }
);


/* =========================================================
   DEBUG FINALE
========================================================= */

app.get(
  "/debug/final",
  async (req, res) => {

    try {

      const metas =
        await getCatalogs();

      res.json({
        count: metas.length,

        metas:
          metas.map(meta => ({
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
  }
);

app.get("/debug/ids", async (req, res) => {
  try {
    const metas = await getCatalogs();

    res.json({
      count: metas.length,
      metas: metas.map(meta => ({
        name: meta.name,
        idLength: meta.id.length,
        id: meta.id
      }))
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: String(e)
    });
  }
});

app.get("/debug/compare", async (req, res) => {
  try {
    const metas = await getCatalogs();

    const selected = metas.filter(meta => {
      const name = (meta.name || "").toLowerCase();

      return (
        name.includes("barcelona") ||
        name.includes("liverpool") ||
        name.includes("paris saint-germain")
      );
    });

    res.json({
      count: selected.length,
      metas: selected.map(meta => ({
        id: meta.id,
        idLength: meta.id.length,
        type: meta.type,
        name: meta.name,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        description: meta.description,
        genres: meta.genres
      }))
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: String(e)
    });
  }
});

/* =========================================================
   DEBUG API-FOOTBALL
========================================================= */

app.get("/debug/fixtures", async (req, res) => {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API_FOOTBALL_KEY non trovata su Render"
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          "x-apisports-key": apiKey
        }
      }
    );

    const data = await response.json();

    res.json({
      date: today,
      apiErrors: data.errors,
      results: data.results,
      fixtures: (data.response || []).map(item => ({
        id: item.fixture?.id,
        date: item.fixture?.date,
        status: item.fixture?.status?.short,
        league: item.league?.name,
        country: item.league?.country,
        home: item.teams?.home?.name,
        away: item.teams?.away?.name
      }))
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: String(e)
    });
  }
});


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
