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
  "sudtirol", "sÃ¼dtirol", "carrarese",
  "avellino", "pescara", "monza",
  "empoli", "venezia", "frosinone"
];

const topEuropeanTeams = [
  "real madrid",
  "barcelona", "fc barcelona",
  "atletico madrid", "atlÃ©tico madrid",
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

  "bayern munich", "bayern mÃ¼nchen",
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

const teamAliases = {
  "inter milan": "inter",
  "internazionale": "inter",
  "ac milan": "milan",

  "atletico de madrid": "atletico madrid",

  "paris saint germain": "psg",

  "bayern munich": "bayern",
  "bayern munchen": "bayern",

  "borussia dortmund": "dortmund",

  "sporting lisbon": "sporting",
  "sporting cp": "sporting",

  "manchester united": "man united",
  "manchester city": "man city",

  "newcastle united": "newcastle",

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
   FILTRO SQUADRE
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
    setTimeout(
      () => controller.abort(),
      12000
    );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Stremio-LIVE/2.1",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${url}`
      );
    }

    return await response.json();

  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   DATA
========================================================= */

function dateString(offsetDays = 0) {
  const d = new Date();

  d.setUTCDate(
    d.getUTCDate() + offsetDays
  );

  return d
    .toISOString()
    .slice(0, 10);
}


/* =========================================================
   CACHE API-FOOTBALL
========================================================= */

let fixtureCache = {
  loaded: false,
  expires: 0,
  fixtures: []
};

const FIXTURE_CACHE_MS =
  2 * 60 * 60 * 1000;


/* =========================================================
   API-FOOTBALL
========================================================= */

async function getApiFixtures() {

  /*
    Se la cache Ã¨ ancora valida,
    NON chiamiamo API-Football.
  */
  if (
    fixtureCache.loaded &&
    fixtureCache.expires > Date.now()
  ) {
    return fixtureCache.fixtures;
  }

  if (!API_FOOTBALL_KEY) {
    throw new Error(
      "API_FOOTBALL_KEY non configurata"
    );
  }

  /*
    Questa Ã¨ la stessa forma di richiesta
    ?date=... che aveva restituito 324 fixture.
  */
  const today = dateString(0);

  const url =
    "https://v3.football.api-sports.io/fixtures" +
    `?date=${today}`;

  try {

    const data = await getJson(url, {
      headers: {
        "x-apisports-key":
          API_FOOTBALL_KEY
      }
    });

    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {
      console.error(
        "API-Football errors:",
        data.errors
      );

      if (fixtureCache.fixtures.length > 0) {
        fixtureCache.expires =
          Date.now() + FIXTURE_CACHE_MS;

        return fixtureCache.fixtures;
      }
    }

    const rawFixtures =
      Array.isArray(data.response)
        ? data.response
        : [];

    console.log(
      `API-Football RAW: ${rawFixtures.length}`
    );

    const fixtures =
      rawFixtures
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
            item.teams?.home?.logo || null,

          awayLogo:
            item.teams?.away?.logo || null
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

    console.log(
      `API-Football FILTRATE: ${fixtures.length}`
    );

    /*
      Se abbiamo partite valide,
      aggiorniamo la cache.
    */
    if (fixtures.length > 0) {

      fixtureCache = {
        loaded: true,
        expires:
          Date.now() + FIXTURE_CACHE_MS,
        fixtures
      };

      return fixtures;
    }

    /*
      Se API-Football restituisce zero
      ma abbiamo dati precedenti,
      NON distruggiamo la vecchia cache.
    */
    if (fixtureCache.fixtures.length > 0) {

      console.log(
        "Risposta vuota: uso cache precedente"
      );

      fixtureCache.loaded = true;
      fixtureCache.expires =
        Date.now() + FIXTURE_CACHE_MS;

      return fixtureCache.fixtures;
    }

    /*
      Cache vuota per 2 ore:
      evita una richiesta ad ogni refresh.
    */
    fixtureCache = {
      loaded: true,
      expires:
        Date.now() + FIXTURE_CACHE_MS,
      fixtures: []
    };

    return [];

  } catch (error) {

    console.error(
      "Errore API-Football:",
      error
    );

    if (fixtureCache.fixtures.length > 0) {
      fixtureCache.loaded = true;
      fixtureCache.expires =
        Date.now() + FIXTURE_CACHE_MS;

      return fixtureCache.fixtures;
    }

    fixtureCache = {
      loaded: true,
      expires:
        Date.now() + FIXTURE_CACHE_MS,
      fixtures: []
    };

    return [];
  }
}


/* =========================================================
   CATALOGO
========================================================= */

function fixtureToMeta(match) {

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
    id:
      `live:${match.fixtureId}`,

    type: "tv",

    name: title,

    poster:
      match.homeLogo,

    description:
      `${match.league}` +
      (time ? ` â€¢ ${time}` : ""),

    genres: [
      "Football"
    ]
  };
}

async function getCatalogs() {
  const fixtures =
    await getApiFixtures();

  return fixtures.map(
    fixtureToMeta
  );
}


/* =========================================================
   PROVIDER EVENTS
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
      sources.map(source =>
        getJson(source.url)
      )
    );

  const events = [];
  const seen = new Set();

  results.forEach(
    (result, index) => {

      if (
        result.status !== "fulfilled"
      ) {
        console.error(
          "Provider catalog error:",
          sources[index].url
        );

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
   MATCHING PROVIDER

   Qui normalizziamo anche gli alias dentro il nome
   completo dell'evento.
========================================================= */

function eventContainsTeam(
  eventName,
  teamName
) {

  const event =
    normalize(eventName);

  const canonical =
    canonicalTeam(teamName);

  /*
    Proviamo prima il nome canonico.
  */
  if (event.includes(canonical)) {
    return true;
  }

  /*
    Poi tutti gli alias che corrispondono
    alla stessa squadra.
  */
  for (
    const [alias, target]
    of Object.entries(teamAliases)
  ) {

    if (
      target === canonical &&
      event.includes(normalize(alias))
    ) {
      return true;
    }
  }

  return false;
}

function eventMatchesFixture(
  eventName,
  home,
  away
) {

  return (
    eventContainsTeam(eventName, home) &&
    eventContainsTeam(eventName, away)
  );
}


/* =========================================================
   TROVA FIXTURE

   IMPORTANTE:
   NON chiama API-Football.
   Usa esclusivamente la cache giÃ  caricata dal catalogo.
========================================================= */

function findFixture(id) {

  if (
    typeof id !== "string" ||
    !id.startsWith("live:")
  ) {
    return null;
  }

  const fixtureId =
    Number(
      id.substring(5)
    );

  if (!fixtureId) {
    return null;
  }

  return (
    fixtureCache.fixtures.find(
      fixture =>
        fixture.fixtureId === fixtureId
    ) || null
  );
}


/* =========================================================
   MANIFEST
========================================================= */

const manifest = {
  id:
    "community.stremio.live.football",

  version:
    "2.1.0",

  name:
    "LIVE",

  description:
    "Football calendar + StremVerse + Highfly streams",

  resources: [
    "catalog",
    "meta",
    "stream"
  ],

  types: [
    "tv"
  ],

  catalogs: [
    {
      type: "tv",
      id: "live_football_v4",
      name: "ðŸ”´ LIVE Football âš½"
    }
  ],

  idPrefixes: [
    "live:"
  ]
};


/* =========================================================
   ROOT + MANIFEST
========================================================= */

app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});

app.get(
  "/manifest.json",
  (req, res) => {
    res.json(manifest);
  }
);


/* =========================================================
   CATALOG ROUTE
========================================================= */

app.get(
  "/catalog/tv/live_football_v4.json",
  async (req, res) => {

    try {

      const metas =
        await getCatalogs();

      res.json({
        metas
      });

    } catch (error) {

      console.error(
        "Catalog error:",
        error
      );

      res.json({
        metas: []
      });
    }
  }
);


/* =========================================================
   META

   Non effettua una nuova chiamata API.
========================================================= */

app.get(
  "/meta/tv/:id.json",
  (req, res) => {

    try {

      const fixture =
        findFixture(
          req.params.id
        );

      res.json({
        meta:
          fixture
            ? fixtureToMeta(fixture)
            : null
      });

    } catch (error) {

      console.error(
        "Meta error:",
        error
      );

      res.json({
        meta: null
      });
    }
  }
);


/* =========================================================
   STREAM

   API-Football NON viene chiamata qui.
========================================================= */

app.get(
  "/stream/tv/:id.json",
  async (req, res) => {

    try {

      const fixture =
        findFixture(
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

            const url =
              event.source === "sv"
                ? `${STREMVERSE}/stream/tv/${encodeURIComponent(event.id)}.json`
                : `${HIGHFLY}/stream/sport/${encodeURIComponent(event.id)}.json`;

            try {

              const data =
                await getJson(url);

              return (
                data.streams || []
              ).map(stream => ({
                ...stream,

                name:
                  event.source === "sv"
                    ? `StremVerse â€¢ ${stream.name || "LIVE"}`
                    : `Highfly â€¢ ${stream.name || "LIVE"}`
              }));

            } catch (error) {

              console.error(
                "Stream provider error:",
                event.name,
                error
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

    } catch (error) {

      console.error(
        "Stream error:",
        error
      );

      res.json({
        streams: []
      });
    }
  }
);


/* =========================================================
   DEBUG CATALOGO

   Usa la stessa cache del catalogo.
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

            home:
              f.home,

            away:
              f.away,

            league:
              f.league,

            date:
              f.date
          }))
      });

    } catch (error) {

      res.status(500).json({
        error:
          String(error)
      });
    }
  }
);


/* =========================================================
   DEBUG API

   Serve a vedere cosa ha ricevuto l'ultima cache.
   NON effettua una nuova richiesta API.
========================================================= */

app.get(
  "/debug/cache",
  (req, res) => {

    res.json({
      loaded:
        fixtureCache.loaded,

      expires:
        fixtureCache.expires,

      count:
        fixtureCache.fixtures.length,

      fixtures:
        fixtureCache.fixtures.map(f => ({
          id:
            f.fixtureId,

          home:
            f.home,

          away:
            f.away,

          league:
            f.league,

          date:
            f.date
        }))
    });
  }
);


/* =========================================================
   DEBUG MATCHING PROVIDER

   Anche questo NON richiama API-Football.
========================================================= */

app.get(
  "/debug/match/:fixtureId",
  async (req, res) => {

    try {

      const fixture =
        findFixture(
          `live:${req.params.fixtureId}`
        );

      if (!fixture) {
        return res.status(404).json({
          error:
            "Fixture non presente nella cache"
        });
      }

      const events =
        await getProviderEvents();

      const providerMatches =
        events.filter(event =>
          eventMatchesFixture(
            event.name,
            fixture.home,
            fixture.away
          )
        );

      res.json({
        fixture: {
          id:
            fixture.fixtureId,

          home:
            fixture.home,

          away:
            fixture.away,

          league:
            fixture.league
        },

        providerMatches
      });

    } catch (error) {

      res.status(500).json({
        error:
          String(error)
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
