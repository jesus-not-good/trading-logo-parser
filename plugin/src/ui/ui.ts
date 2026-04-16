const WORKER_BASE = 'https://trading-logo-worker.tradinglogos.workers.dev';

const searchInput = document.getElementById('search-input') as HTMLInputElement;
const stateInitial = document.getElementById('state-initial')!;
const stateLoading = document.getElementById('state-loading')!;
const stateFound = document.getElementById('state-found')!;
const stateNotFound = document.getElementById('state-not-found')!;
const stateError = document.getElementById('state-error')!;
const stateSuccess = document.getElementById('state-success')!;
const previewImage = document.getElementById('preview-image')!;
const previewFallback = document.getElementById('preview-fallback')!;
const companyName = document.getElementById('company-name')!;
const tickerLabel = document.getElementById('ticker-label')!;
const tickerLabelFallback = document.getElementById('ticker-label-fallback')!;
const btnInsert = document.getElementById('btn-insert')!;
const btnInsertFallback = document.getElementById('btn-insert-fallback')!;
const btnRetry = document.getElementById('btn-retry')!;

interface LogoFoundResponse {
  found: true;
  ticker: string;
  companyName: string;
  imageUrl: string;
  source: string;
}

interface LogoNotFoundResponse {
  found: false;
  ticker: string;
  companyName: string | null;
}

type LogoResponse = LogoFoundResponse | LogoNotFoundResponse;

let currentResult: LogoResponse | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastQuery = '';

function showState(state: HTMLElement): void {
  [stateInitial, stateLoading, stateFound, stateNotFound, stateError, stateSuccess].forEach(
    (el) => el.classList.add('hidden')
  );
  state.classList.remove('hidden');
}

function getLetters(ticker: string, companyNameStr: string | null): string {
  if (companyNameStr) {
    const words = companyNameStr.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyNameStr.slice(0, 2).toUpperCase();
  }
  return ticker.slice(0, 2).toUpperCase();
}

async function searchTicker(query: string): Promise<void> {
  if (!query.trim()) {
    showState(stateInitial);
    return;
  }

  showState(stateLoading);

  try {
    const response = await fetch(
      `${WORKER_BASE}/logo?ticker=${encodeURIComponent(query.trim())}`
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: LogoResponse = await response.json();
    currentResult = data;

    if (data.found) {
      previewImage.style.backgroundImage = `url(${data.imageUrl})`;
      companyName.textContent = data.companyName;
      tickerLabel.textContent = data.ticker;
      showState(stateFound);
    } else {
      const letters = getLetters(data.ticker, data.companyName);
      previewFallback.textContent = letters;
      tickerLabelFallback.textContent = data.ticker;
      showState(stateNotFound);
    }
  } catch {
    currentResult = null;
    showState(stateError);
  }
}

function handleInsertSuccess(): void {
  showState(stateSuccess);
  searchInput.value = '';
  lastQuery = '';
  currentResult = null;

  setTimeout(() => {
    showState(stateInitial);
    searchInput.focus();
  }, 1500);
}

// Search input: debounce 500ms + Enter
searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (query === lastQuery) return;

  debounceTimer = setTimeout(() => {
    lastQuery = query;
    searchTicker(query);
  }, 500);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (debounceTimer) clearTimeout(debounceTimer);
    const query = searchInput.value;
    lastQuery = query;
    searchTicker(query);
  }
});

// Insert buttons
btnInsert.addEventListener('click', () => {
  if (currentResult?.found) {
    parent.postMessage(
      { pluginMessage: { type: 'insert-image', imageUrl: currentResult.imageUrl } },
      '*'
    );
  }
});

btnInsertFallback.addEventListener('click', () => {
  if (currentResult && !currentResult.found) {
    const letters = getLetters(currentResult.ticker, currentResult.companyName);
    parent.postMessage(
      { pluginMessage: { type: 'insert-fallback', letters } },
      '*'
    );
  }
});

// Double-click on preview to insert
previewImage.addEventListener('dblclick', () => btnInsert.click());
previewFallback.addEventListener('dblclick', () => btnInsertFallback.click());

// Retry button
btnRetry.addEventListener('click', () => {
  searchTicker(lastQuery);
});

// Messages from sandbox
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'insert-success') {
    handleInsertSuccess();
  } else if (msg.type === 'insert-error') {
    showState(stateError);
  }
};

// Focus input on load
searchInput.focus();
