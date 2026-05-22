#!/usr/bin/env node
/**
 * One-time enrichment script.
 * Reads collection_movies.json, fetches poster_path, release_date, vote_average
 * from TMDB for every unique movie id, then writes the enriched data back.
 *
 * Run from the project root:
 *   node scripts/enrich-collection-movies.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TMDB_API_KEY = 'd90e408fc05fa0c35ebbbc220515d376';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const JSON_PATH = path.resolve(__dirname, '../collection_movies.json');

// Concurrency + rate-limit settings (TMDB allows ~40 req/s on free tier)
const CONCURRENCY = 10;
const DELAY_MS = 30; // ~33 req/s — safe margin

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchMovieDetails(id) {
  const url = `${TMDB_BASE}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
  try {
    const data = await get(url);
    return {
      poster_path: data.poster_path || null,
      release_date: data.release_date || null,
      vote_average: typeof data.vote_average === 'number' ? data.vote_average : null,
    };
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch id=${id}: ${err.message}`);
    return null;
  }
}

async function runInBatches(ids, batchSize) {
  const results = new Map();
  const total = ids.length;
  let done = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetches = batch.map(async (id) => {
      const detail = await fetchMovieDetails(id);
      results.set(id, detail);
      done++;
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\r  Fetched ${done}/${total} movies...`);
      }
      await sleep(DELAY_MS);
    });
    await Promise.all(fetches);
  }

  console.log(''); // newline after progress
  return results;
}

async function main() {
  console.log('📖 Reading collection_movies.json...');
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const movies = JSON.parse(raw);
  console.log(`   ${movies.length} entries found.`);

  // Collect unique movie ids that are missing enrichment data
  const needsEnrichment = movies.filter(
    (m) => m.poster_path === undefined || m.release_date === undefined || m.vote_average === undefined
  );
  const uniqueIds = [...new Set(needsEnrichment.map((m) => m.id))];
  console.log(`🔍 ${uniqueIds.length} unique movie ids need enrichment.`);

  if (uniqueIds.length === 0) {
    console.log('✅ All entries already enriched. Nothing to do.');
    return;
  }

  console.log(`🌐 Fetching from TMDB (concurrency=${CONCURRENCY})...`);
  const detailMap = await runInBatches(uniqueIds, CONCURRENCY);

  console.log('✏️  Merging enrichment data into entries...');
  let enriched = 0;
  let skipped = 0;

  for (const movie of movies) {
    // Skip if already has all fields
    if (movie.poster_path !== undefined && movie.release_date !== undefined && movie.vote_average !== undefined) {
      skipped++;
      continue;
    }
    const detail = detailMap.get(movie.id);
    if (detail) {
      movie.poster_path = detail.poster_path;
      movie.release_date = detail.release_date;
      movie.vote_average = detail.vote_average;
      enriched++;
    }
  }

  console.log(`   Enriched: ${enriched} | Already complete: ${skipped}`);

  console.log('💾 Writing enriched JSON back to disk...');
  fs.writeFileSync(JSON_PATH, JSON.stringify(movies, null, 4), 'utf8');
  console.log('✅ Done! collection_movies.json has been updated.');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
