const form = document.getElementById('search-form');
const input = document.getElementById('title-input');
const button = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const pickerEl = document.getElementById('match-picker');
const matchesListEl = document.getElementById('matches-list');
const resultEl = document.getElementById('result');
const matchedTitleEl = document.getElementById('matched-title');
const synopsisEl = document.getElementById('synopsis');
const yearEl = document.getElementById('year');
const genresEl = document.getElementById('genres');
const ratingEl = document.getElementById('rating');
const trailerEl = document.getElementById('trailer');
const seriesInfoCardEl = document.getElementById('series-info-card');
const seriesInfoEl = document.getElementById('series-info');
const tableBody = document.getElementById('table-body');

let activeQuery = '';
let currentMatches = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff8f8f' : 'var(--muted)';
}

function yesCell(value) {
  if (!value) return '<td></td>';
  return '<td class="yes">Yes</td>';
}

function renderTable(rows) {
  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="5">No availability found for Netflix, Amazon Prime Video, or Max.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.country}</td>
        <td>${row.code}</td>
        ${yesCell(row.netflix)}
        ${yesCell(row.amazonPrimeVideo)}
        ${yesCell(row.max)}
      </tr>`
    )
    .join('');
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${(count || 0) === 1 ? singular : plural}`;
}

function renderSeriesInfo(data) {
  if (data.mediaType !== 'tv') {
    seriesInfoCardEl.classList.add('hidden');
    seriesInfoEl.textContent = '-';
    return;
  }

  const seasonText = pluralize(data.numberOfSeasons, 'season');
  const episodeText = pluralize(data.numberOfEpisodes, 'episode');
  const runtimeText = data.runtimeMinutes ? `, about ${data.runtimeMinutes}m per episode` : '';
  const seasonList = (data.seasons || [])
    .slice(0, 4)
    .map((season) => `${season.name} (${pluralize(season.episodeCount, 'episode')})`)
    .join('; ');

  seriesInfoEl.textContent = `${seasonText}, ${episodeText}${runtimeText}${seasonList ? `. ${seasonList}` : ''}`;
  seriesInfoCardEl.classList.remove('hidden');
}

function resetResults() {
  resultEl.classList.add('hidden');
  pickerEl.classList.add('hidden');
  matchesListEl.innerHTML = '';
  seriesInfoCardEl.classList.add('hidden');
  seriesInfoEl.textContent = '-';
}

function matchButtonLabel(match) {
  return `${match.title} (${match.mediaType}, ${match.year})`;
}

async function loadSelection(match, triggerButton) {
  const buttons = matchesListEl.querySelectorAll('button');
  buttons.forEach((item) => {
    item.disabled = true;
  });
  button.disabled = true;
  setStatus(`Loading availability for ${match.title}...`);

  if (triggerButton) {
    triggerButton.classList.add('selected');
  }

  try {
    const data = await window.streamerApi.selectTitle(activeQuery, match);
    matchedTitleEl.textContent = `${data.matched} (${data.mediaType})`;
    synopsisEl.textContent = data.synopsis;
    yearEl.textContent = data.year;
    genresEl.textContent = data.genres;
    ratingEl.textContent = data.rating;
    renderSeriesInfo(data);

    if (data.trailer && data.trailer !== 'N/A') {
      trailerEl.href = data.trailer;
      trailerEl.textContent = 'Open trailer';
    } else {
      trailerEl.removeAttribute('href');
      trailerEl.textContent = 'N/A';
    }

    renderTable(data.rows);
    resultEl.classList.remove('hidden');
    setStatus(`Showing ${data.matched} in ${data.rows.length} countries.`);
  } catch (error) {
    setStatus(error.message || 'Selection failed.', true);
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
    button.disabled = false;
  }
}

function renderMatches(matches) {
  currentMatches = matches;
  matchesListEl.innerHTML = matches
    .map(
      (match, index) => `
      <button type="button" class="match-option" data-index="${index}">
        <span class="match-title">${match.title}</span>
        <span class="match-meta">${match.mediaType.toUpperCase()} • ${match.year}</span>
      </button>`
    )
    .join('');
  pickerEl.classList.remove('hidden');
}

matchesListEl.addEventListener('click', async (event) => {
  const buttonEl = event.target.closest('button[data-index]');
  if (!buttonEl) return;

  const index = Number(buttonEl.dataset.index);
  const match = currentMatches[index];
  if (!match) return;

  await loadSelection(match, buttonEl);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) {
    setStatus('Enter a movie or TV show title.', true);
    return;
  }

  button.disabled = true;
  activeQuery = title;
  currentMatches = [];
  resetResults();
  setStatus('Searching TMDB for matching titles...');

  try {
    const data = await window.streamerApi.searchTitle(title);
    renderMatches(data.matches);

    if (data.matches.length === 1) {
      setStatus(`One match found: ${matchButtonLabel(data.matches[0])}. Loading details...`);
      await loadSelection(data.matches[0]);
      return;
    }

    setStatus(`Found ${data.matches.length} matches. Pick the title you want.`);
  } catch (error) {
    setStatus(error.message || 'Search failed.', true);
  } finally {
    button.disabled = false;
  }
});
