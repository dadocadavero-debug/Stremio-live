// VERSIONE ESPN 2.2.0 - NO API-FOOTBALL

const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const STREMVERSE =
  "https://stremverse1.alwaysdata.net";

const HIGHFLY =
  "https://sports.highfly.dev/eyJpbmNsdWRlU3BvcnRzIjpbImZvb3RiYWxsIl19";


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
  "sudtirol", "carrarese",
  "avellino", "pescara", "monza",
  "empoli", "venezia", "frosinone"
];

const topEuropeanTeams = [
  "real madrid",
  "barcelona", "fc barcelona",
  "atletico madrid", "atletico de madrid",
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

  "bayern munich", "bayern munchen",
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
   ESCLUSIONI + FILTRO
========================================================= */

function unwanted(name = "") {
  return (
    /\bwomen\b|\bfemale\b|\bfemminile\b/i.test(name) ||
    /\bu(?:15|16|17|18|19|20|21|22|23)\b/i.test(name) ||
    /\byouth\b|\bgiovanili\b|\bprimavera\b/i.test(name) ||
    /\breserves?\b|\bb team\b|\bteam b\b/i.test(name)
  );
}

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
  const text = normalize(`${home} ${away}`);

  // Esclusioni da mantenere
  const blocked = [
    "women", "woman", "female", "femmin",
    "u15", "u16", "u17", "u18", "u19",
    "u20", "u21", "u22", "u23",
    "youth", "giovan", "primavera",
    "reserve", "reserves"
  ];

  if (blocked.some(x => text.includes(x))) {
    return false;
  }

  // Frammenti volutamente corti per questa prova
  const wanted = [
    // Italiane
    "int", "mil", "juv", "nap", "rom",
    "laz", "ata", "bol", "fio", "tor",
    "gen", "udi", "cag", "lec", "par",
    "ver", "com", "cre", "sas", "pis",
    "sam", "pal", "bar", "spe", "ces",
    "cat", "mod", "reg", "man", "sud",
    "car", "ave", "pes", "mon", "emp",
    "ven", "fro",

    // Big europee
    "rea", "bar", "atl", "ath", "vil",
    "bet", "sev", "manc", "liv", "ars",
    "che", "tot", "new", "bay", "dor",
    "lev", "pari", "mar", "mon", "ben",
    "por", "spo", "aja", "psv", "fey",

    // Nazionali
    "ita", "fra", "ger", "spa", "eng",
    "por", "net", "bel", "cro", "arg",
    "bra", "uru", "col", "mex", "uni",
    "usa", "jap", "mor"
  ];

  return wanted.some(x => text.includes(x));
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
        "User-Agent": "Stremio-LIVE/2.2",
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
   DATA EUROPE/ROME
========================================================= */

function dateString(offsetDays = 0) {
  const d =
    new Date(
      Date.now() +
      offsetDays * 86400000
    );

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(d);

  const get =
    type =>
      parts.find(
        p => p.type === type
      )?.value || "";

  return (
    `${get("year")}-` +
    `${get("month")}-` +
    `${get("day")}`
  );
}

function espnDate(offsetDays = 0) {
  return dateString(offsetDays)
    .replace(/-/g, "");
}


/* =========================================================
   ESPN
========================================================= */

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";

const ESPN_FALLBACK_LEAGUES = [
  "ita.1",
  "ita.2",

  "eng.1",
  "eng.2",
  "eng.fa",
  "eng.league_cup",

  "esp.1",
  "esp.2",
  "esp.copa_del_rey",

  "ger.1",
  "ger.2",
  "ger.dfb_pokal",

  "fra.1",
  "fra.2",

  "por.1",
  "ned.1",

  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
  "uefa.super_cup",

  "uefa.nations",
  "uefa.euro",
  "uefa.euroq",

  "fifa.world",
  "fifa.worldq.uefa",
  "fifa.worldq.conmebol",
  "fifa.worldq.concacaf",
  "fifa.worldq.afc",
  "fifa.worldq.caf",

  "conmebol.libertadores",
  "conmebol.sudamericana",

  "usa.1",
  "mex.1"
];


/* =========================================================
   CACHE ESPN
========================================================= */

let fixtureCache = {
  loaded: false,
  expires: 0,
  fixtures: [],
  source: null,
  rawCount: 0,
  lastError: null,
  updatedAt: null
};

const FIXTURE_CACHE_MS =
  30 * 60 * 1000;


/* =========================================================
   PARSING ESPN
========================================================= */

function parseEspnEvent(event) {

  const competition =
    event.competitions?.[0];

  if (!competition) {
    return null;
  }

  const competitors =
    Array.isArray(
      competition.competitors
    )
      ? competition.competitors
      : [];

  const home =
    competitors.find(
      c => c.homeAway === "home"
    );

  const away =
    competitors.find(
      c => c.homeAway === "away"
    );

  if (!home || !away) {
    return null;
  }

  const homeName =
    home.team?.displayName ||
    home.team?.name ||
    "";

  const awayName =
    away.team?.displayName ||
    away.team?.name ||
    "";

  if (!homeName || !awayName) {
    return null;
  }

  const date =
    competition.date ||
    event.date ||
    null;

  return {
    fixtureId:
      String(event.id),

    date,

    timestamp:
      date
        ? Math.floor(
            new Date(date).getTime() /
            1000
          )
        : 0,

    status:
      event.status?.type?.state ||
      event.status?.type?.name ||
      "",

    league:
      event.league?.name ||
      "",

    country: "",

    home:
      homeName,

    away:
      awayName,

    homeLogo:
      home.team?.logo ||
      home.team?.logos?.[0]?.href ||
      null,

    awayLogo:
      away.team?.logo ||
      away.team?.logos?.[0]?.href ||
      null
  };
    }

/* =========================================================
   DEDUPLICAZIONE FIXTURE
========================================================= */

function dedupeFixtures(fixtures) {

  const seen = new Set();
  const result = [];

  for (const fixture of fixtures) {

    const key =
      `${canonicalTeam(fixture.home)}|` +
      `${canonicalTeam(fixture.away)}|` +
      `${fixture.date || ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(fixture);
  }

  return result;
}


/* =========================================================
   FETCH ESPN
========================================================= */

async function fetchEspnLeague(
  league,
  date
) {

  const url =
    `${ESPN_BASE}/${league}/scoreboard` +
    `?dates=${date}&limit=1000`;

  const data =
    await getJson(url);

  return Array.isArray(data.events)
    ? data.events
    : [];
}


/* =========================================================
   FIXTURE ESPN
========================================================= */

async function getApiFixtures() {

  /*
    Se abbiamo già una cache valida,
    non richiamiamo ESPN.
  */
  if (
    fixtureCache.loaded &&
    fixtureCache.expires > Date.now()
  ) {
    return fixtureCache.fixtures;
  }

  const today =
    espnDate(0);

  let events = [];
  let source = "espn:all";
  let lastError = null;


  /*
    PRIMO TENTATIVO:
    scoreboard aggregato del calcio.
  */
  try {

    events =
      await fetchEspnLeague(
        "all",
        today
      );

    console.log(
      `ESPN ALL RAW: ${events.length}`
    );

  } catch (error) {

    lastError =
      `ESPN all: ${String(error)}`;

    console.error(
      "ESPN all error:",
      error
    );
  }


  /*
    FALLBACK:
    se il calendario aggregato non restituisce
    eventi, interroghiamo le competizioni.
  */
  if (events.length === 0) {

    source =
      "espn:fallback";

    const results =
      await Promise.allSettled(
        ESPN_FALLBACK_LEAGUES.map(
          league =>
            fetchEspnLeague(
              league,
              today
            )
        )
      );

    events =
      results.flatMap(
        result =>
          result.status === "fulfilled"
            ? result.value
            : []
      );

    const failures =
      results.filter(
        result =>
          result.status === "rejected"
      ).length;

    console.log(
      `ESPN FALLBACK RAW: ${events.length} ` +
      `(${failures} fonti fallite)`
    );
  }


  const rawCount =
    events.length;


  /*
    Convertiamo gli eventi ESPN nel nostro
    formato e applichiamo il filtro squadre.
  */
  const fixtures =
  dedupeFixtures(
    events
      .map(parseEspnEvent)
      .filter(Boolean)
      .filter(item =>
        wantedFixture(
          item.home,
          item.away
        )
      )
  );


  fixtures.sort(
    (a, b) =>
      (a.timestamp || 0) -
      (b.timestamp || 0)
  );


  console.log(
    `ESPN FILTRATE: ${fixtures.length}`
  );


  /*
    Se ESPN restituisce zero ma abbiamo
    una vecchia cache valida, la conserviamo.
  */
  if (fixtures.length === 0) {

    if (
      fixtureCache.fixtures.length > 0
    ) {

      console.log(
        "ESPN vuoto: mantengo cache precedente"
      );

      fixtureCache.loaded = true;

      fixtureCache.expires =
        Date.now() +
        FIXTURE_CACHE_MS;

      fixtureCache.lastError =
        lastError ||
        "ESPN ha restituito zero fixture filtrate";

      return fixtureCache.fixtures;
    }


    /*
      Se non abbiamo neppure una vecchia cache,
      conserviamo lo stato diagnostico soltanto
      per 5 minuti.
    */
    fixtureCache = {
      loaded: true,

      expires:
        Date.now() +
        5 * 60 * 1000,

      fixtures: [],

      source,

      rawCount,

      lastError:
        lastError ||
        "ESPN ha restituito zero fixture filtrate",

      updatedAt:
        new Date().toISOString()
    };

    return [];
  }


  /*
    Abbiamo fixture valide:
    aggiorniamo la cache per 30 minuti.
  */
  fixtureCache = {
    loaded: true,

    expires:
      Date.now() +
      FIXTURE_CACHE_MS,

    fixtures,

    source,

    rawCount,

    lastError,

    updatedAt:
      new Date().toISOString()
  };

  return fixtures;
}


/* =========================================================
   CATALOGO
========================================================= */

function fixtureToMeta(match) {

  const title =
    `${match.home} vs ${match.away}`;

  const time =
    match.date
      ? new Date(match.date).toLocaleString(
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
    id: `live:${String(match.fixtureId)}`,
    type: "tv",
    name: title,

    poster:
      match.homeLogo ||
      match.awayLogo,

    posterShape: "square",

    description:
      time
        ? `⚽ ${title} • ${time}`
        : `⚽ ${title}`
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
   StremVerse + Highfly
========================================================= */

async function getProviderEvents() {

  const sources = [

    {
      source:
        "sv",

      url:
        `${STREMVERSE}/catalog/tv/` +
        `stremverse_live_events/genre=Football.json`
    },

    {
      source:
        "hf",

      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_live.json`
    },

    {
      source:
        "hf",

      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_today.json`
    },

    {
      source:
        "hf",

      url:
        `${HIGHFLY}/catalog/sport/` +
        `sports_football.json`
    }
  ];


  const results =
    await Promise.allSettled(
      sources.map(
        source =>
          getJson(source.url)
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

          id:
            meta.id,

          name:
            meta.name || ""
        });
      }
    }
  );


  return events;
}


/* =========================================================
   MATCHING PROVIDER
========================================================= */

function eventContainsTeam(
  eventName,
  teamName
) {

  const event =
    normalize(eventName);

  const canonical =
    canonicalTeam(teamName);


  if (
    event.includes(canonical)
  ) {
    return true;
  }


  for (
    const [alias, target]
    of Object.entries(teamAliases)
  ) {

    if (
      target === canonical &&
      event.includes(
        normalize(alias)
      )
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
    eventContainsTeam(
      eventName,
      home
    ) &&
    eventContainsTeam(
      eventName,
      away
    )
  );
}


/* =========================================================
   TROVA FIXTURE

   Non richiama ESPN.
   Usa esclusivamente la cache.
========================================================= */

function findFixture(id) {

  if (
    typeof id !== "string" ||
    !id.startsWith("live:")
  ) {
    return null;
  }


  const fixtureId =
    id.substring(5);


  if (!fixtureId) {
    return null;
  }


  return (
    fixtureCache.fixtures.find(
      fixture =>
        String(
          fixture.fixtureId
        ) ===
        String(fixtureId)
    ) || null
  );
}/* =========================================================
   MANIFEST
========================================================= */

const manifest = {
  id: "community.stremio.live.football",
  version: "2.2.0",
  name: "LIVE",

  description:
    "ESPN football calendar + StremVerse + Highfly streams",

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
      name: "🔴 LIVE Football ⚽"
    }
  ],

  idPrefixes: [
    "live:"
  ]
};


/* =========================================================
   MANIFEST ROUTE
========================================================= */

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
   META ROUTE
========================================================= */

app.get(
  "/meta/tv/:id.json",
  async (req, res) => {

    try {

      /*
        Se la cache non è ancora stata
        inizializzata, la carichiamo.
      */
      if (!fixtureCache.loaded) {
        await getApiFixtures();
      }


      const fixture =
        findFixture(
          req.params.id
        );


      if (!fixture) {

        return res.status(404).json({
          error:
            "Fixture not found"
        });
      }


      const meta =
        fixtureToMeta(
          fixture
        );


      res.json({
        meta
      });

    } catch (error) {

      console.error(
        "Meta error:",
        error
      );

      res.status(500).json({
        error:
          "Meta error"
      });
    }
  }
);


/* =========================================================
   STREAM ROUTE
========================================================= */

app.get(
  "/stream/tv/:id.json",
  async (req, res) => {

    try {

      /*
        Se Render è appena partito e la cache
        non è ancora caricata, recuperiamo
        prima il calendario ESPN.
      */
      if (!fixtureCache.loaded) {
        await getApiFixtures();
      }


      const fixture =
        findFixture(
          req.params.id
        );


      if (!fixture) {

        return res.json({
          streams: []
        });
      }


      const providerEvents =
        await getProviderEvents();


      const matching =
        providerEvents.filter(
          event =>
            eventMatchesFixture(
              event.name,
              fixture.home,
              fixture.away
            )
        );


      const streamResults =
        await Promise.allSettled(

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


              const data =
                await getJson(url);


              return (
                data.streams || []
              ).map(
                stream => ({

                  ...stream,

                  name:
                    event.source === "sv"
                      ? `StremVerse • ${
                          stream.name ||
                          "Stream"
                        }`
                      : `Highfly • ${
                          stream.name ||
                          "Stream"
                        }`
                })
              );
            }
          )
        );


      const streams =
        streamResults.flatMap(
          result =>
            result.status ===
            "fulfilled"
              ? result.value
              : []
        );


      /*
        Deduplica stream identici.
      */
      const unique = [];
      const seen = new Set();


      for (
        const stream of streams
      ) {

        const key =
          stream.url ||
          stream.externalUrl ||
          stream.ytId ||
          JSON.stringify(stream);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        unique.push(stream);
      }


      res.json({
        streams: unique
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
          fixtures.map(
            fixture => ({
              id:
                fixture.fixtureId,

              home:
                fixture.home,

              away:
                fixture.away,

              date:
                fixture.date,

              league:
                fixture.league
            })
          )
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
   DEBUG CACHE

   Questa route ci permette anche di verificare
   immediatamente che Render stia usando
   davvero la versione ESPN 2.2.0.
========================================================= */

app.get(
  "/debug/cache",
  (req, res) => {

    res.json({
      version:
        "ESPN 2.2.0",

      loaded:
        fixtureCache.loaded,

      expires:
        fixtureCache.expires,

      source:
        fixtureCache.source,

      rawCount:
        fixtureCache.rawCount,

      lastError:
        fixtureCache.lastError,

      updatedAt:
        fixtureCache.updatedAt,

      count:
        fixtureCache.fixtures.length,

      fixtures:
        fixtureCache.fixtures
    });
  }
);


/* =========================================================
   DEBUG MATCH
========================================================= */

app.get(
  "/debug/match/:fixtureId",
  async (req, res) => {

    try {

      if (!fixtureCache.loaded) {
        await getApiFixtures();
      }


      const fixture =
        fixtureCache.fixtures.find(
          item =>
            String(
              item.fixtureId
            ) ===
            String(
              req.params.fixtureId
            )
        );


      if (!fixture) {

        return res.status(404).json({
          error:
            "Fixture not found"
        });
      }


      const providerEvents =
        await getProviderEvents();


      const matching =
        providerEvents.filter(
          event =>
            eventMatchesFixture(
              event.name,
              fixture.home,
              fixture.away
            )
        );


      res.json({
        fixture,
        matching
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
   ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.send(
      "Stremio LIVE Football - ESPN 2.2.0"
    );
  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Stremio LIVE ESPN 2.2.0 running on port ${PORT}`
    );
  }
);
