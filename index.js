const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const STREMVERSE =
  "https://stremverse1.alwaysdata.net";

const HIGHFLY =
  "https://sports.highfly.dev/eyJpbmNsdWRlU3BvcnRzIjpbImZvb3RiYWxsIl19";


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
   FILTRO
========================================================= */

/* =========================================================
   FILTRO
========================================================= */

function unwanted(name = "") {

  const n = normalize(name);

  return (
    /\b(women|woman|female|femminile|femminili|femenino|feminino|ladies)\b/.test(n) ||
    /\bu(?:15|16|17|18|19|20|21|22|23)\b/.test(n) ||
    /\b(youth|giovanili|primavera|reserve|reserves)\b/.test(n) ||
    /\b(b team|team b)\b/.test(n)
  );
}


/*
   Squadre interessanti.
   Niente frammenti corti:
   evitiamo falsi positivi.
*/

const wantedTeams = [

  // ITALIA
  "inter",
  "milan",
  "juventus",
  "napoli",
  "roma",
  "lazio",
  "atalanta",
  "bologna",
  "fiorentina",
  "torino",
  "genoa",
  "udinese",
  "cagliari",
  "lecce",
  "parma",
  "verona",
  "como",
  "cremonese",
  "sassuolo",
  "pisa",
  "sampdoria",
  "palermo",
  "bari",
  "spezia",
  "cesena",
  "catanzaro",
  "modena",
  "reggiana",
  "mantova",
  "sudtirol",
  "carrarese",
  "avellino",
  "pescara",
  "monza",
  "empoli",
  "venezia",
  "frosinone",


  // EUROPA
  "real madrid",
  "barcelona",
  "atletico madrid",
  "athletic club",
  "villarreal",
  "real betis",
  "sevilla",

  "manchester city",
  "manchester united",
  "liverpool",
  "arsenal",
  "chelsea",
  "tottenham",
  "newcastle",

  "bayern",
  "borussia dortmund",
  "bayer leverkusen",

  "psg",
  "paris saint germain",

  "marseille",
  "monaco",

  "benfica",
  "porto",
  "sporting",

  "ajax",
  "psv",
  "feyenoord",


  // NAZIONALI
  "italy",
  "italia",
  "france",
  "germany",
  "deutschland",
  "spain",
  "espana",
  "england",
  "portugal",
  "netherlands",
  "holland",
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



/*
   Alias solo dove il nome cambia davvero.
*/

const aliases = {

  inter: [
    "internazionale",
    "inter milan",
    "inter milano"
  ],

  milan: [
    "ac milan"
  ],

  napoli: [
    "ssc napoli"
  ],

  roma: [
    "as roma"
  ],

  lazio: [
    "ss lazio"
  ],

  juventus: [
    "juventus fc",
    "juve"
  ],

  psg: [
    "paris saint germain",
    "paris saint-germain"
  ],

  bayern: [
    "bayern munich",
    "bayern munchen"
  ],

  barcelona: [
    "fc barcelona"
  ],

  atletico: [
    "atletico de madrid"
  ],

  manchester: [
    "manchester utd",
    "man united"
  ]
};



function wantedEvent(name = "") {

  if (unwanted(name)) {
    return false;
  }


  const n =
    normalize(name);


  // nome normale

  if (
    wantedTeams.some(
      team =>
        n.includes(
          normalize(team)
        )
    )
  ) {
    return true;
  }


  // alias

  for (
    const key of Object.keys(aliases)
  ) {

    for (
      const alias of aliases[key]
    ) {

      if (
        n.includes(
          normalize(alias)
        )
      ) {
        return true;
      }
    }
  }


  return false;
}


/* =========================================================
   FETCH JSON
========================================================= */

async function getJson(url) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      12000
    );

  try {

    const response =
      await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Stremio-LIVE/3.0"
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
   FONTI
========================================================= */

const PROVIDER_CATALOGS = [

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


/* =========================================================
   RECUPERO EVENTI
========================================================= */

async function getProviderEvents() {

  const results =
    await Promise.allSettled(
      PROVIDER_CATALOGS.map(
        item =>
          getJson(item.url)
      )
    );


  const events = [];


  results.forEach(
    (result, index) => {

      if (
        result.status !==
        "fulfilled"
      ) {

        console.error(
          "Provider error:",
          PROVIDER_CATALOGS[index].url
        );

        return;
      }


      const source =
        PROVIDER_CATALOGS[index].source;


      for (
  const meta of
  result.value.metas || []
) {

  if (!meta?.id) {
    continue;
  }


  const providerKey =
    `${source}:${meta.id}`;


  const alreadyExists =
    events.some(
      e =>
        `${e.source}:${e.providerId}` === providerKey
    );


  if (alreadyExists) {
    continue;
  }


  events.push({

    source,

    providerId:
      String(meta.id),

    name:
      meta.name ||
      meta.title ||
      "",

    poster:
      meta.poster ||
      meta.background ||
      meta.logo ||
      null,

    description:
      meta.description ||
      "",

    releaseInfo:
      meta.releaseInfo ||
      ""
  });
}
    }
  );


  return events;
}


/* =========================================================
   FILTRO + DEDUPLICAZIONE
========================================================= */

function eventKey(name = "") {

  let n = normalize(name);

  /*
    Eliminiamo alcune parole che possono
    differire fra StremVerse e Highfly.
  */

  n = n
    .replace(/\bvs\b/g, " ")
    .replace(/\bv\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return n;
}


async function getCatalogEvents() {

  const all =
    await getProviderEvents();


  const filtered =
    all.filter(
      event =>
        event.name &&
        wantedEvent(event.name)
    );


  /*
    Raggruppiamo lo stesso evento proveniente
    dai due provider in una sola card.
  */

  const map = new Map();


  for (const event of filtered) {

    const key =
      eventKey(event.name);


    if (!key) {
      continue;
    }


    if (!map.has(key)) {

      map.set(key, {

        key,

        name:
          event.name,

        poster:
          event.poster,

        description:
          event.description,

        releaseInfo:
          event.releaseInfo,

        providers: []
      });
    }


    const item =
      map.get(key);


    /*
      Se la prima fonte non aveva poster,
      utilizziamo quello dell'altra.
    */

    if (
      !item.poster &&
      event.poster
    ) {

      item.poster =
        event.poster;
    }


    item.providers.push({

      source:
        event.source,

      id:
        event.providerId
    });
  }


  return Array.from(
    map.values()
  );
}


/* =========================================================
   CACHE CATALOGO
========================================================= */

let catalogCache = {
  expires: 0,
  events: []
};


const CACHE_MS =
  5 * 60 * 1000;


async function getCachedCatalog() {

  if (
    catalogCache.expires >
      Date.now() &&
    catalogCache.events.length
  ) {

    return catalogCache.events;
  }


  const events =
    await getCatalogEvents();


  catalogCache = {

    expires:
      Date.now() +
      CACHE_MS,

    events
  };


  return events;
}


/* =========================================================
   ID NOSTRI
========================================================= */

function encodeEventId(key) {

  return Buffer
    .from(key, "utf8")
    .toString("base64url");
}


function decodeEventId(id) {

  try {

    return Buffer
      .from(id, "base64url")
      .toString("utf8");

  } catch {

    return "";
  }
}


/* =========================================================
   META CATALOGO
========================================================= */

function eventToMeta(event) {

  return {

    id:
      `live:${encodeEventId(
        event.key
      )}`,

    type:
      "tv",

    name:
      event.name,

    poster:
      event.poster ||
      undefined,

    posterShape:
      "square",

    description:
      event.description ||
      `⚽ ${event.name}`,

    releaseInfo:
      event.releaseInfo ||
      undefined
  };
}


/* =========================================================
   MANIFEST
========================================================= */

const manifest = {

  id:
    "community.stremio.live.football",

  version:
    "3.0.0",

  name:
    "LIVE",

  description:
    "StremVerse + Highfly LIVE Football",

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
      type:
        "tv",

      id:
        "live_football_v5",

      name:
        "🔴 LIVE Football ⚽"
    }
  ],

  idPrefixes: [
    "live:"
  ]
};


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
  "/catalog/tv/live_football_v5.json",
  async (req, res) => {

    try {

      const events =
        await getCachedCatalog();


      res.json({

        metas:
          events.map(
            eventToMeta
          )
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
   TROVA EVENTO
========================================================= */

async function findEvent(id) {

  if (
    !id ||
    !id.startsWith("live:")
  ) {

    return null;
  }


  const key =
    decodeEventId(
      id.substring(5)
    );


  if (!key) {
    return null;
  }


  const events =
    await getCachedCatalog();


  return (
    events.find(
      event =>
        event.key === key
    ) ||
    null
  );
}


/* =========================================================
   META
========================================================= */

app.get(
  "/meta/tv/:id.json",
  async (req, res) => {

    try {

      const event =
        await findEvent(
          req.params.id
        );


      if (!event) {

        return res
          .status(404)
          .json({
            error:
              "Event not found"
          });
      }


      res.json({

        meta:
          eventToMeta(event)
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
   STREAM DAL PROVIDER ORIGINALE
========================================================= */

async function getStreams(
  provider
) {

  let url;


  if (
    provider.source === "sv"
  ) {

    url =
      `${STREMVERSE}/stream/tv/` +
      `${encodeURIComponent(
        provider.id
      )}.json`;

  } else {

    url =
      `${HIGHFLY}/stream/sport/` +
      `${encodeURIComponent(
        provider.id
      )}.json`;
  }


  const data =
    await getJson(url);


  return (
    data.streams || []
  ).map(
    stream => ({

      ...stream,

      name:
        provider.source === "sv"
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


/* =========================================================
   STREAM ROUTE
========================================================= */

app.get(
  "/stream/tv/:id.json",
  async (req, res) => {

    try {

      const event =
        await findEvent(
          req.params.id
        );


      if (!event) {

        return res.json({
          streams: []
        });
      }


      const results =
        await Promise.allSettled(
          event.providers.map(
            getStreams
          )
        );


      const streams =
        results.flatMap(
          result =>
            result.status ===
            "fulfilled"
              ? result.value
              : []
        );


      /*
        Deduplicazione degli stream.
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
   DEBUG
========================================================= */

app.get(
  "/debug/catalog",
  async (req, res) => {

    try {

      const all =
        await getProviderEvents();

      const events =
        await getCachedCatalog();


      res.json({

        version:
          "PROVIDERS 3.0.0",

        raw:
          all.length,

        filtered:
          events.length,

        events:
          events.map(
            event => ({

              name:
                event.name,

              providers:
                event.providers
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
   DEBUG FILTRO
========================================================= */

app.get(
  "/debug/filter",
  async (req, res) => {

    try {

      const all =
        await getProviderEvents();


      res.json({

        totale:
          all.length,

        passati:
          all
            .filter(
              e => wantedEvent(e.name)
            )
            .map(
              e => e.name
            ),

        scartati:
          all
            .filter(
              e => !wantedEvent(e.name)
            )
            .map(
              e => e.name
            ), 

        riconosciutiComeIndesiderati:
  all
    .filter(
      e => unwanted(e.name)
    )
    .map(
      e => e.name
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
   ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.send(
      "Stremio LIVE Football - StremVerse + Highfly 3.0.0"
    );
  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `LIVE Football 3.0.0 running on port ${PORT}`
    );
  }
);
