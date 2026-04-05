<script setup lang="ts">
defineProps<{
  ratings?: any
  imdbId?: string
  tmdbId?: number
  tmdbType?: 'movie' | 'tv'
}>();
</script>

<template>
  <div class="rating-pills">
    <!-- IMDb -->
    <a
      v-if="ratings?.imdb?.value && imdbId"
      :href="`https://www.imdb.com/title/${imdbId}`"
      target="_blank" rel="noopener"
      class="rpill rpill-imdb"
    >
      <span class="rp-src rp-src-imdb">IMDb</span>
      <span class="rp-val">{{ ratings.imdb.value.toFixed(1) }}</span>
      <span v-if="ratings.imdb.votes" class="rp-votes">{{ Math.round(ratings.imdb.votes / 1000) }}K</span>
    </a>

    <!-- TMDB -->
    <a
      v-if="ratings?.tmdb?.value && tmdbId"
      :href="`https://www.themoviedb.org/${tmdbType ?? 'movie'}/${tmdbId}`"
      target="_blank" rel="noopener"
      class="rpill rpill-tmdb"
    >
      <span class="rp-src rp-src-tmdb">TMDB</span>
      <span class="rp-val">{{ (ratings.tmdb.value * 10).toFixed(0) }}%</span>
    </a>

    <!-- Metacritic -->
    <a
      v-if="ratings?.metacritic?.value"
      :href="`https://www.metacritic.com/search/${encodeURIComponent('')}/?category=2`"
      target="_blank" rel="noopener"
      class="rpill rpill-meta"
    >
      <span class="rp-src rp-src-meta">META</span>
      <span class="rp-val">{{ ratings.metacritic.value }}</span>
    </a>

    <!-- trakt -->
    <a
      v-if="ratings?.trakt?.value && tmdbId"
      :href="`https://trakt.tv/search/tmdb/${tmdbId}?id_type=${tmdbType === 'tv' ? 'show' : 'movie'}`"
      target="_blank" rel="noopener"
      class="rpill rpill-trakt"
    >
      <span class="rp-src rp-src-trakt">trakt</span>
      <span class="rp-val">{{ ratings.trakt.value.toFixed(1) }}</span>
    </a>

    <!-- Rotten Tomatoes -->
    <div v-if="ratings?.rottenTomatoes?.value" class="rpill rpill-rt">
      <span class="rp-src rp-src-rt">RT</span>
      <span class="rp-val">{{ ratings.rottenTomatoes.value }}%</span>
    </div>
  </div>
</template>

<style scoped>
.rating-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

/* Basis-Pill */
.rpill {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: opacity .15s, transform .1s;
  border: none;
  line-height: 1;
}
.rpill:hover { opacity: .82; transform: translateY(-1px); }

/* Source-Label (farbiges Badge links) */
.rp-src {
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .3px;
  line-height: 1;
  white-space: nowrap;
}

/* Wert */
.rp-val {
  padding: 4px 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

/* Votes (kleiner, gedimmt) */
.rp-votes {
  padding: 4px 6px 4px 0;
  color: rgba(255,255,255,.5);
  font-size: 10px;
  font-weight: 400;
  line-height: 1;
}

/* ── IMDb ── gelber Src-Badge */
.rpill-imdb           { background: rgba(20,18,10,.9); }
.rp-src-imdb          { background: #F5C518; color: #000; }

/* ── TMDB ── dunkelblau mit grünem Text */
.rpill-tmdb           { background: rgba(13,37,63,.95); }
.rp-src-tmdb          { background: #01b4e4; color: #0d253f; font-weight: 900; }

/* ── META ── dunkel mit gelbem Text */
.rpill-meta           { background: rgba(30,28,25,.95); }
.rp-src-meta          { background: #2b2b2b; color: #ffcc34; }

/* ── trakt ── schwarz mit rotem Text */
.rpill-trakt          { background: rgba(15,13,13,.95); }
.rp-src-trakt         { background: #111; color: #ed1c24; }

/* ── RT ── rot */
.rpill-rt             { background: rgba(40,10,10,.9); }
.rp-src-rt            { background: #fa3c3c; color: #fff; }
</style>
