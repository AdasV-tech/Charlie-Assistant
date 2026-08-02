// Warnings and suggestions computed from a food's actual macro numbers,
// on top of the hand-written benefits/negatives/recommendation already in
// data/foods.js — real thresholds against real data, not decoration.
export function computeWarnings(food) {
  const warnings = [];
  if (food.sugar >= 20) warnings.push('High in sugar for one serving.');
  if (food.fat >= 15) warnings.push('High in fat for one serving.');
  if (food.calories >= 500)
    warnings.push('High-calorie serving — good for an active day, heavy otherwise.');
  if (food.fibre < 1 && food.carbs > 20) warnings.push('Low in fibre relative to its carbs.');
  return warnings;
}

export function computeSuggestions(food) {
  const suggestions = [];
  if (food.fibre < 3) suggestions.push('Pair with a vegetable or piece of fruit for more fibre.');
  if (food.protein < 10) suggestions.push('Add a protein source to make this more filling.');
  if (food.hydrationPercent < 50) suggestions.push('Drink a glass of water alongside this.');
  return suggestions;
}
