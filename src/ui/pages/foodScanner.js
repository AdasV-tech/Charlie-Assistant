// Food Analyzer Pro: photo capture/upload for the user's own reference,
// plus a name-based lookup against FOOD_DATABASE. Intentionally NOT
// computer vision — see the on-page disclaimer — but every piece of it is
// real and functional: six scores, macros, estimated micronutrients and
// hydration, computed warnings/suggestions, favourites, and a trend chart
// across saved history.
import { FOOD_DATABASE, findFoodMatch } from '../../data/foods.js';
import { foodHistoryStore, favouriteFoodsStore } from '../../store/stores.js';
import { escapeHtml } from '../../lib/utils.js';
import { scoreRingHTML, scoreQuality } from '../../lib/scoreRing.js';
import { computeWarnings, computeSuggestions } from '../../food/foodInsights.js';
import { addLogLine } from '../transcript.js';
import { flashState } from '../../core/assistant.js';

const photoInput = document.getElementById('foodPhotoInput');
const previewWrap = document.getElementById('photoPreviewWrap');
const previewImg = document.getElementById('photoPreview');
const clearScanBtn = document.getElementById('clearScanBtn');
const searchInput = document.getElementById('foodSearchInput');
const suggestionsList = document.getElementById('foodSuggestions');
const analyzeBtn = document.getElementById('analyzeFoodBtn');
const quickFoodsWrap = document.getElementById('quickFoods');
const resultBox = document.getElementById('foodResult');
const saveRow = document.getElementById('saveRow');
const mealNameInput = document.getElementById('mealNameInput');
const saveMealBtn = document.getElementById('saveMealBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('foodHistoryList');
const historyCount = document.getElementById('historyCount');
const trendChart = document.getElementById('historyTrendChart');
const showAllHistoryBtn = document.getElementById('showAllHistoryBtn');
const showFavouritesBtn = document.getElementById('showFavouritesBtn');

let currentScannedFood = null; // the food currently shown in the result card, so Save knows what to store
let historyFilter = 'all'; // 'all' | 'favourites'

function isFavourite(foodName) {
  return favouriteFoodsStore.get().includes(foodName);
}

function toggleFavourite(foodName) {
  const favourites = favouriteFoodsStore.get();
  favouriteFoodsStore.set(
    favourites.includes(foodName)
      ? favourites.filter((name) => name !== foodName)
      : [...favourites, foodName],
  );
}

function scoreRingChip(value, label, size = 64) {
  return `
    <div class="score-chip">
      ${scoreRingHTML(value, 10, { size, quality: scoreQuality(value, 10) })}
      <div class="score-chip-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function renderFoodResult(food) {
  currentScannedFood = food;
  resultBox.classList.remove('hidden');
  const warnings = computeWarnings(food);
  const suggestions = computeSuggestions(food);

  resultBox.innerHTML = `
    <div class="result-header">
      <div>
        <h3 class="result-heading">CHARLIE FOOD ANALYSIS</h3>
        <p class="result-meal-name">${escapeHtml(food.name)}</p>
      </div>
      <button
        type="button"
        class="favourite-btn${isFavourite(food.name) ? ' active' : ''}"
        data-favourite-toggle="${escapeHtml(food.name)}"
        aria-label="${isFavourite(food.name) ? 'Remove from favourites' : 'Add to favourites'}"
      >★</button>
    </div>

    <div class="scores-grid">
      <div class="score-chip primary">
        ${scoreRingHTML(food.healthScore, 10, { size: 76, quality: scoreQuality(food.healthScore, 10) })}
        <div class="score-chip-label">Overall Health</div>
      </div>
      ${scoreRingChip(food.gymScore, 'Gym Score')}
      ${scoreRingChip(food.weightLossScore, 'Weight Loss')}
      ${scoreRingChip(food.muscleBuildingScore, 'Muscle Building')}
      ${scoreRingChip(food.energyScore, 'Energy')}
      ${scoreRingChip(food.recoveryScore, 'Recovery')}
    </div>

    <div class="macro-grid">
      <div class="macro-stat"><div class="macro-value">${food.calories}</div><div class="macro-label">kcal</div></div>
      <div class="macro-stat"><div class="macro-value">${food.protein}g</div><div class="macro-label">Protein</div></div>
      <div class="macro-stat"><div class="macro-value">${food.carbs}g</div><div class="macro-label">Carbs</div></div>
      <div class="macro-stat"><div class="macro-value">${food.fat}g</div><div class="macro-label">Fat</div></div>
      <div class="macro-stat"><div class="macro-value">${food.sugar}g</div><div class="macro-label">Sugar</div></div>
      <div class="macro-stat"><div class="macro-value">${food.fibre}g</div><div class="macro-label">Fibre</div></div>
    </div>

    <div class="secondary-stats-grid">
      <div class="secondary-stat">
        <div class="secondary-stat-label">MICRONUTRIENTS (ESTIMATED)</div>
        <div class="secondary-stat-body">
          ${
            food.micronutrients.length
              ? food.micronutrients
                  .map((m) => `<span class="nutrient-tag">${escapeHtml(m)}</span>`)
                  .join('')
              : '<span class="dashboard-widget-status">No standout micronutrients.</span>'
          }
        </div>
      </div>
      <div class="secondary-stat">
        <div class="secondary-stat-label">HYDRATION ESTIMATE</div>
        <div class="secondary-stat-body">
          <div class="hydration-bar"><div class="hydration-bar-fill" style="width: ${food.hydrationPercent}%;"></div></div>
          <span>${food.hydrationPercent}% water content (estimated)</span>
        </div>
      </div>
    </div>

    <div><strong>Benefits</strong></div>
    <ul class="good">${food.benefits.map((g) => `<li>✓ ${escapeHtml(g)}</li>`).join('')}</ul>
    <div><strong>Negatives</strong></div>
    <ul class="bad">${food.negatives.map((b) => `<li>⚠ ${escapeHtml(b)}</li>`).join('')}</ul>

    ${
      warnings.length
        ? `<div><strong>Warnings</strong></div><ul class="warnings">${warnings.map((w) => `<li>⚠ ${escapeHtml(w)}</li>`).join('')}</ul>`
        : ''
    }
    ${
      suggestions.length
        ? `<div><strong>Suggestions</strong></div><ul class="suggestions-list">${suggestions.map((s) => `<li>→ ${escapeHtml(s)}</li>`).join('')}</ul>`
        : ''
    }

    <div class="recommendation">"${escapeHtml(food.dailyRecommendation)}"</div>
  `;
  mealNameInput.value = food.name;
  saveRow.classList.remove('hidden');
}

function renderTrendChart() {
  const entries = foodHistoryStore.get().slice(0, 10).reverse(); // oldest to newest, last 10 saved
  if (!entries.length) {
    trendChart.innerHTML =
      '<p class="dashboard-widget-status">Save a few meals to see your trend here.</p>';
    return;
  }
  trendChart.innerHTML = entries
    .map((entry) => {
      const heightPct = Math.max(4, (entry.healthScore / 10) * 100);
      const quality = scoreQuality(entry.healthScore, 10);
      return `
        <div class="trend-bar-wrap" title="${escapeHtml(entry.mealName)}: ${entry.healthScore.toFixed(1)}/10">
          <div class="trend-bar trend-bar--${quality}" style="height: ${heightPct}%;"></div>
        </div>
      `;
    })
    .join('');
}

export function renderFoodHistory() {
  const allHistory = foodHistoryStore.get();
  const favourites = favouriteFoodsStore.get();
  const visibleHistory =
    historyFilter === 'favourites'
      ? allHistory.filter((entry) => favourites.includes(entry.foodName))
      : allHistory;

  historyCount.textContent = `${allHistory.length} meal${allHistory.length === 1 ? '' : 's'} saved`;
  historyList.innerHTML = '';
  renderTrendChart();

  if (!visibleHistory.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent =
      historyFilter === 'favourites'
        ? 'No favourite meals yet — star a food in its analysis to save it here.'
        : 'No meals saved yet — analyze a food above and tap "Save to history".';
    historyList.appendChild(empty);
    return;
  }

  visibleHistory.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = `favourite-btn small${favourites.includes(entry.foodName) ? ' active' : ''}`;
    favBtn.textContent = '★';
    favBtn.setAttribute(
      'aria-label',
      favourites.includes(entry.foodName) ? 'Remove from favourites' : 'Add to favourites',
    );
    favBtn.addEventListener('click', () => {
      toggleFavourite(entry.foodName);
      renderFoodHistory();
    });

    const main = document.createElement('div');
    main.className = 'history-main';
    const nameEl = document.createElement('div');
    nameEl.className = 'history-meal-name';
    nameEl.textContent = entry.mealName;
    const metaEl = document.createElement('div');
    metaEl.className = 'history-meta';
    const savedDate = new Date(entry.savedAt);
    metaEl.textContent = `${savedDate.toLocaleDateString()} · ${entry.calories} kcal · ${entry.protein}g protein`;
    main.appendChild(nameEl);
    main.appendChild(metaEl);

    const score = document.createElement('div');
    score.className = 'history-score';
    score.textContent = `${entry.healthScore.toFixed(1)}/10`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${entry.mealName} from history`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      foodHistoryStore.set(foodHistoryStore.get().filter((e) => e.id !== entry.id));
      renderFoodHistory();
    });

    li.appendChild(favBtn);
    li.appendChild(main);
    li.appendChild(score);
    li.appendChild(removeBtn);
    historyList.appendChild(li);
  });
}

// Used by the "analyze food X" / "what is the score for X" voice commands.
export function analyzeFoodByName(name) {
  const food = findFoodMatch(name);
  if (food) {
    searchInput.value = food.name;
    renderFoodResult(food);
  }
  return food;
}

export function initFoodScanner() {
  // Populate the <datalist> and the quick-pick buttons from the food DB.
  FOOD_DATABASE.forEach((food) => {
    const opt = document.createElement('option');
    opt.value = food.name;
    suggestionsList.appendChild(opt);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-food-btn';
    btn.textContent = food.name;
    btn.addEventListener('click', () => {
      searchInput.value = food.name;
      renderFoodResult(food);
    });
    quickFoodsWrap.appendChild(btn);
  });

  // Photo capture / upload — shows a local preview only (never uploaded anywhere).
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  clearScanBtn.addEventListener('click', () => {
    photoInput.value = '';
    previewImg.src = '';
    previewWrap.classList.add('hidden');
    searchInput.value = '';
    resultBox.classList.add('hidden');
    resultBox.innerHTML = '';
    saveRow.classList.add('hidden');
    mealNameInput.value = '';
    currentScannedFood = null;
  });

  analyzeBtn.addEventListener('click', () => {
    const food = findFoodMatch(searchInput.value);
    if (!food) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<p>I couldn't find "${escapeHtml(searchInput.value)}" in my local food table yet. Try one of the quick-pick buttons above, or a simpler name like "chicken" or "rice".</p>`;
      saveRow.classList.add('hidden');
      currentScannedFood = null;
      return;
    }
    renderFoodResult(food);
  });

  // Allow pressing Enter in the search box instead of always tapping ANALYZE.
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyzeBtn.click();
  });

  // Event delegation: the favourite button inside resultBox gets replaced
  // every time renderFoodResult() re-sets innerHTML, so listen on the
  // stable container instead of re-attaching a listener each render.
  resultBox.addEventListener('click', (e) => {
    const button = e.target.closest('[data-favourite-toggle]');
    if (!button) return;
    toggleFavourite(button.dataset.favouriteToggle);
    renderFoodResult(currentScannedFood);
  });

  saveMealBtn.addEventListener('click', () => {
    if (!currentScannedFood) return;
    const food = currentScannedFood;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mealName: mealNameInput.value.trim() || food.name,
      foodName: food.name,
      savedAt: new Date().toISOString(),
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      sugar: food.sugar,
      fibre: food.fibre,
      healthScore: food.healthScore,
      gymScore: food.gymScore,
      weightLossScore: food.weightLossScore,
      muscleBuildingScore: food.muscleBuildingScore,
      energyScore: food.energyScore,
      recoveryScore: food.recoveryScore,
      micronutrients: food.micronutrients,
      hydrationPercent: food.hydrationPercent,
      dailyRecommendation: food.dailyRecommendation,
    };
    foodHistoryStore.set([entry, ...foodHistoryStore.get()]); // newest first
    flashState('learning');
    renderFoodHistory();
    addLogLine(`Saved "${entry.mealName}" to your food history.`, 'system');
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (!foodHistoryStore.get().length) return;
    foodHistoryStore.set([]);
    renderFoodHistory();
  });

  showAllHistoryBtn.addEventListener('click', () => {
    historyFilter = 'all';
    showAllHistoryBtn.classList.add('active');
    showFavouritesBtn.classList.remove('active');
    renderFoodHistory();
  });
  showFavouritesBtn.addEventListener('click', () => {
    historyFilter = 'favourites';
    showFavouritesBtn.classList.add('active');
    showAllHistoryBtn.classList.remove('active');
    renderFoodHistory();
  });

  renderFoodHistory();
}
