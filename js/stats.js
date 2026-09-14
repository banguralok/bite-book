function escapeHtmlStats(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function tallyBy(entries, getValueFn) {
  const counts = {};
  entries.forEach((e) => {
    const value = getValueFn(e);
    if (!value) return;
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function foodKey(food) {
  return (food || '').trim().toLowerCase();
}

function groupByFood(entries) {
  const byFood = {};
  entries.forEach((e) => {
    const key = foodKey(e.food);
    if (!key) return;
    if (!byFood[key]) byFood[key] = { name: e.food, entries: [] };
    byFood[key].entries.push(e);
  });
  return byFood;
}

function buildFoodStoryNarrative(entries) {
  const sentences = [];
  const total = entries.length;

  const cuisineCounts = tallyBy(entries, (e) => e.cuisine);
  if (cuisineCounts.length) {
    const [topCuisine, count] = cuisineCounts[0];
    const share = count / total;
    if (share >= 0.25) {
      sentences.push(`You really love ${cuisineLabel(topCuisine)} food — ${Math.round(share * 100)}% of your logged meals.`);
    }
  }

  const familyRated = entries.filter((e) => (e.companionTypes || []).includes('family') && e.rating);
  if (familyRated.length >= 2) {
    const avg = (familyRated.reduce((s, e) => s + e.rating, 0) / familyRated.length).toFixed(1);
    sentences.push(`Family meals are your happiest meals — you rate them ${avg} ★ on average.`);
  }

  const byFood = groupByFood(entries);
  let problemChild = null;
  Object.values(byFood).forEach((group) => {
    if (group.entries.length < 3) return;
    const rated = group.entries.filter((e) => e.rating);
    if (!rated.length) return;
    const highCount = rated.filter((e) => e.rating >= 4).length;
    const highShare = highCount / rated.length;
    if (highShare < 0.5 && (!problemChild || group.entries.length > problemChild.count)) {
      problemChild = { name: group.name, count: group.entries.length, highCount };
    }
  });
  if (problemChild) {
    sentences.push(`${escapeHtmlStats(problemChild.name)} has a problem — you've ordered it ${problemChild.count} times but only rated it well ${problemChild.highCount} time${problemChild.highCount === 1 ? '' : 's'}.`);
  }

  const placeCounts = tallyBy(entries, (e) => e.placeName);
  const foodCounts = Object.values(byFood).map((g) => [g.name, g.entries.length]).sort((a, b) => b[1] - a[1]);
  const topPlace = placeCounts[0];
  const topFood = foodCounts[0];
  if (topPlace && topPlace[1] >= 3) {
    sentences.push(`You've been to ${escapeHtmlStats(topPlace[0])} ${topPlace[1]} times.`);
  } else if (topFood && topFood[1] >= 3) {
    sentences.push(`You've ordered ${escapeHtmlStats(topFood[0])} ${topFood[1]} times.`);
  }

  return sentences;
}

function barBlock(title, pairs, labelFn) {
  if (pairs.length === 0) {
    return `<div class="stat-block"><h3>${title}</h3><p class="stat-empty-note">Not enough data yet.</p></div>`;
  }
  const top = pairs.slice(0, 5);
  const max = top[0][1];
  const rows = top.map(([key, count]) => `
    <div class="bar-row">
      <div class="bar-row-label"><span>${escapeHtmlStats(labelFn(key))}</span><span>${count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width: ${(count / max) * 100}%;"></div></div>
    </div>
  `).join('');
  return `<div class="stat-block"><h3>${title}</h3>${rows}</div>`;
}

document.addEventListener('bitebook:ready', async () => {
  const container = document.getElementById('stats-content');
  const entries = await BiteBookStorage.listEntries();

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No stats yet</h3>
        <p>Log a few entries and your story will start to take shape here.</p>
        <a href="entry.html" class="btn btn-primary">Start My First Entry</a>
      </div>
    `;
    return;
  }

  const complete = entries.filter((e) => e.status === 'complete');
  const now = new Date();
  const thisMonth = entries.filter((e) => {
    const d = new Date(e.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const rated = complete.filter((e) => e.rating);
  const avgRating = rated.length
    ? (rated.reduce((sum, e) => sum + e.rating, 0) / rated.length).toFixed(1)
    : '—';

  const topRated = complete
    .filter((e) => e.rating)
    .sort((a, b) => b.rating - a.rating)[0];

  const narrativeSentences = buildFoodStoryNarrative(entries);
  const narrativeHtml = `
    <div class="story-narrative">
      ${narrativeSentences.length
        ? narrativeSentences.map((s) => `<p>${s}</p>`).join('')
        : `<p>Log a few more meals and your food story will start to take shape here.</p>`}
    </div>
  `;

  const tiles = `
    <div class="stat-tiles">
      <div class="stat-tile"><div class="stat-tile-value">${entries.length}</div><div class="stat-tile-label">Total Entries</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${complete.length}</div><div class="stat-tile-label">Complete</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${avgRating}${avgRating !== '—' ? ' ★' : ''}</div><div class="stat-tile-label">Avg Rating</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${thisMonth}</div><div class="stat-tile-label">This Month</div></div>
    </div>
  `;

  const topRatedBlock = topRated ? `
    <div class="stat-block">
      <h3>🏆 Top-Rated Dish</h3>
      <p><a href="entry-view.html?id=${encodeURIComponent(topRated.id)}"><strong>${escapeHtmlStats(topRated.food)}</strong></a> — ${ratingStarsLabel(topRated.rating)}</p>
    </div>
  ` : '';

  const cuisineBars = barBlock('🍽️ Top Cuisines', tallyBy(entries, (e) => e.cuisine), (v) => cuisineLabel(v));
  const mealBars = barBlock('⏰ When You Eat Most', tallyBy(entries, (e) => e.mealType), (v) => mealTypeLabel(v));
  const companionBars = barBlock(
    '👥 Who You Eat With Most',
    tallyBy(entries, (e) => (e.companionTypes && e.companionTypes[0]) || e.companionType),
    (v) => companionTypeLabel(v)
  );
  const makerBars = barBlock('👩‍🍳 Who Makes Your Food', tallyBy(entries, (e) => e.madeBy), (v) => makerTypeLabel(v));

  const insightsBlock = `
    <div class="stat-block">
      <h3>✨ AI Insights</h3>
      <p class="stat-empty-note" id="ai-insights-hint">Spot a few patterns in your data — powered by AI.</p>
      <button type="button" class="btn btn-back" id="ai-insights-btn">✨ Generate Insights</button>
      <ul class="insights-list" id="insights-list" style="display: none;"></ul>
      <p class="upload-status" id="ai-insights-status"></p>
    </div>
  `;

  container.innerHTML = narrativeHtml + tiles + topRatedBlock + cuisineBars + mealBars + companionBars + makerBars + insightsBlock;

  const insightsBtn = document.getElementById('ai-insights-btn');
  const insightsHint = document.getElementById('ai-insights-hint');
  const insightsList = document.getElementById('insights-list');
  const insightsStatus = document.getElementById('ai-insights-status');

  insightsBtn.addEventListener('click', async () => {
    insightsBtn.disabled = true;
    insightsBtn.textContent = '✨ Thinking...';
    insightsStatus.textContent = '';
    insightsStatus.classList.remove('error');

    try {
      const context = {
        today: toDateInputValue(new Date()),
        entries: entries.map((e) => ({
          food: e.food,
          status: e.status,
          mealType: e.mealType,
          cuisine: e.cuisine,
          ateOn: e.ateOn,
          placeType: e.placeType,
          companions: companionSummaryLabel(e) || null,
          madeBy: e.madeBy,
          reason: e.reason,
          likedQualities: e.likedQualities,
          rating: e.rating,
          wouldEatAgain: e.wouldEatAgain,
          personalRank: e.personalRank,
          createdAt: e.createdAt,
        })),
      };
      const insights = await BiteBookAI.generateInsights(context);
      if (insights.length === 0) {
        insightsStatus.textContent = 'Not enough data yet for a pattern — log a few more meals and try again.';
      } else {
        insightsHint.style.display = 'none';
        insightsList.innerHTML = insights.map((i) => `<li>${escapeHtmlStats(i)}</li>`).join('');
        insightsList.style.display = 'flex';
      }
    } catch (err) {
      insightsStatus.textContent = BiteBookAI.friendlyErrorMessage(err);
      insightsStatus.classList.add('error');
    } finally {
      insightsBtn.disabled = false;
      insightsBtn.textContent = '✨ Generate Insights';
    }
  });
});
