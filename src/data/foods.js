/* =========================================================
   CHARLIE ASSISTANT — LOCAL FOOD DATABASE
   This is a small, hand-written lookup table used by the Food Analyzer.
   It is NOT computer vision — there is no AI model looking at the photo.
   Charlie takes a picture for your own reference, then you tell it (by
   typing or picking a quick button) what the food is, and Charlie looks
   up an estimate from this local table. Everything runs on-device,
   nothing is uploaded anywhere.

   Each entry:
     name          display name
     aliases       extra words that should also match a search
     calories      approx kcal per typical serving
     protein       approx grams of protein per typical serving
     carbs         approx grams of carbohydrate per typical serving
     fat           approx grams of fat per typical serving
     sugar         approx grams of sugar per typical serving
     fibre         approx grams of fibre per typical serving
     healthScore          1-10, overall healthiness estimate
     gymScore             1-10, how well it fits a training day
     weightLossScore      1-10, how well it fits a weight-loss goal
     muscleBuildingScore  1-10, how well it supports muscle building
     energyScore          1-10, how much sustained energy it provides
     recoveryScore        1-10, how well it supports post-exercise recovery
     micronutrients       notable vitamins/minerals — an estimate, not a
                          lab-grade breakdown; see the on-page disclaimer
     hydrationPercent      rough % water content of the food itself
     benefits      array of short positive points
     negatives     array of short caution points
     dailyRecommendation  one-line spoken/written summary
   ========================================================= */

export const FOOD_DATABASE = [
  {
    name: 'Apple',
    aliases: ['apples'],
    calories: 95,
    protein: 0.5,
    carbs: 25,
    fat: 0.3,
    sugar: 19,
    fibre: 4.4,
    healthScore: 9.2,
    gymScore: 5.5,
    weightLossScore: 9.0,
    muscleBuildingScore: 3.0,
    energyScore: 7.0,
    recoveryScore: 6.5,
    micronutrients: ['Vitamin C', 'Potassium'],
    hydrationPercent: 84,
    benefits: ['High in fibre', 'Naturally sweet with no added sugar', 'Good source of vitamin C'],
    negatives: ['Mostly natural sugar, watch portions if eating several'],
    dailyRecommendation: 'A great everyday snack, any time of day.',
  },
  {
    name: 'Banana',
    aliases: ['bananas'],
    calories: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
    sugar: 14,
    fibre: 3.1,
    healthScore: 8.0,
    gymScore: 7.0,
    weightLossScore: 6.5,
    muscleBuildingScore: 4.5,
    energyScore: 8.5,
    recoveryScore: 7.0,
    micronutrients: ['Potassium', 'Vitamin B6'],
    hydrationPercent: 75,
    benefits: [
      'Good source of potassium',
      'Quick, natural energy',
      'Easy on the stomach before exercise',
    ],
    negatives: ['Higher in sugar than some other fruits'],
    dailyRecommendation: 'Solid pre-workout or breakfast snack.',
  },
  {
    name: 'Chicken breast',
    aliases: ['chicken', 'grilled chicken', 'chicken breast fillet'],
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    sugar: 0,
    fibre: 0,
    healthScore: 9.3,
    gymScore: 9.5,
    weightLossScore: 8.5,
    muscleBuildingScore: 9.7,
    energyScore: 6.5,
    recoveryScore: 9.0,
    micronutrients: ['Vitamin B6', 'Phosphorus', 'Selenium'],
    hydrationPercent: 65,
    benefits: [
      'Very high in lean protein',
      'Low in fat if grilled or baked',
      'Supports muscle recovery',
    ],
    negatives: [
      'Can dry out and get bland without seasoning',
      'Frying adds significant extra calories',
    ],
    dailyRecommendation: 'Excellent choice, especially grilled, baked, or steamed.',
  },
  {
    name: 'Rice',
    aliases: ['white rice', 'steamed rice', 'boiled rice'],
    calories: 205,
    protein: 4.3,
    carbs: 45,
    fat: 0.4,
    sugar: 0.1,
    fibre: 0.6,
    healthScore: 6.0,
    gymScore: 7.0,
    weightLossScore: 4.5,
    muscleBuildingScore: 6.0,
    energyScore: 8.0,
    recoveryScore: 5.5,
    micronutrients: ['Manganese'],
    hydrationPercent: 68,
    benefits: ['Good energy source', 'Easy to digest', 'Pairs well with protein and vegetables'],
    negatives: ['Low in fibre compared to whole grains', 'Easy to overeat in large portions'],
    dailyRecommendation: 'Fine in moderate portions, ideally with vegetables and protein.',
  },
  {
    name: 'Pizza',
    aliases: ['slice of pizza', 'pepperoni pizza', 'cheese pizza'],
    calories: 285,
    protein: 12,
    carbs: 36,
    fat: 10,
    sugar: 3.8,
    fibre: 2.3,
    healthScore: 4.0,
    gymScore: 3.5,
    weightLossScore: 2.5,
    muscleBuildingScore: 4.0,
    energyScore: 7.0,
    recoveryScore: 3.5,
    micronutrients: ['Calcium'],
    hydrationPercent: 40,
    benefits: ['Contains some protein and calcium from cheese', 'Can include vegetable toppings'],
    negatives: [
      'High in refined carbs and saturated fat',
      'Easy to eat more than one serving',
      'Often high in sodium',
    ],
    dailyRecommendation: 'Fine as an occasional treat, not an everyday meal.',
  },
  {
    name: 'Burger',
    aliases: ['hamburger', 'cheeseburger', 'beef burger'],
    calories: 350,
    protein: 17,
    carbs: 30,
    fat: 17,
    sugar: 6,
    fibre: 2,
    healthScore: 4.2,
    gymScore: 4.5,
    weightLossScore: 2.8,
    muscleBuildingScore: 5.5,
    energyScore: 7.2,
    recoveryScore: 4.5,
    micronutrients: ['Iron', 'Zinc'],
    hydrationPercent: 45,
    benefits: ['Decent protein from the patty', 'Can be improved with extra vegetables'],
    negatives: [
      'Often high in saturated fat',
      'Bun adds refined carbs',
      'Sauces can add hidden sugar and calories',
    ],
    dailyRecommendation: 'Occasional treat — try adding lettuce, tomato, and going easy on sauce.',
  },
  {
    name: 'Fries',
    aliases: ['french fries', 'chips', 'potato fries'],
    calories: 365,
    protein: 4,
    carbs: 48,
    fat: 17,
    sugar: 0.3,
    fibre: 3.8,
    healthScore: 3.0,
    gymScore: 2.5,
    weightLossScore: 1.8,
    muscleBuildingScore: 1.5,
    energyScore: 6.5,
    recoveryScore: 2.0,
    micronutrients: ['Potassium'],
    hydrationPercent: 40,
    benefits: ['Contains some potassium from the potato'],
    negatives: [
      'Deep-fried, high in fat and calories',
      'Very low in fibre and protein for the calories',
      'Usually high in sodium',
    ],
    dailyRecommendation: 'Treat food — enjoy occasionally, not a daily side.',
  },
  {
    name: 'Salad',
    aliases: ['green salad', 'garden salad', 'side salad'],
    calories: 120,
    protein: 3,
    carbs: 10,
    fat: 5,
    sugar: 4,
    fibre: 4,
    healthScore: 9.4,
    gymScore: 6.0,
    weightLossScore: 9.5,
    muscleBuildingScore: 3.5,
    energyScore: 5.0,
    recoveryScore: 8.0,
    micronutrients: ['Vitamin K', 'Vitamin A', 'Folate'],
    hydrationPercent: 90,
    benefits: [
      'High in fibre and micronutrients',
      'Low calorie unless heavy dressing is added',
      'Great way to add vegetables to a meal',
    ],
    negatives: ['Creamy or sugary dressings can quietly add a lot of calories'],
    dailyRecommendation: 'Great choice — go light on creamy dressing to keep it healthy.',
  },
  {
    name: 'Eggs',
    aliases: ['egg', 'boiled eggs', 'scrambled eggs', 'fried eggs'],
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    sugar: 1.1,
    fibre: 0,
    healthScore: 8.6,
    gymScore: 8.8,
    weightLossScore: 7.5,
    muscleBuildingScore: 8.5,
    energyScore: 6.5,
    recoveryScore: 8.5,
    micronutrients: ['Vitamin B12', 'Vitamin D', 'Choline'],
    hydrationPercent: 74,
    benefits: ['High-quality complete protein', 'Rich in vitamins B12 and D', 'Very versatile'],
    negatives: ['Frying in a lot of oil or butter adds extra calories'],
    dailyRecommendation: 'Excellent choice, especially boiled or poached.',
  },
  {
    name: 'Pasta',
    aliases: ['spaghetti', 'noodles', 'pasta dish'],
    calories: 220,
    protein: 8,
    carbs: 43,
    fat: 1.3,
    sugar: 1.5,
    fibre: 2.5,
    healthScore: 5.8,
    gymScore: 6.8,
    weightLossScore: 4.0,
    muscleBuildingScore: 5.8,
    energyScore: 7.8,
    recoveryScore: 5.0,
    micronutrients: ['Iron', 'B Vitamins'],
    hydrationPercent: 62,
    benefits: ['Good source of energy', 'Pairs well with vegetables and lean protein'],
    negatives: ['Refined pasta is low in fibre', 'Rich, creamy sauces add a lot of extra calories'],
    dailyRecommendation:
      'Fine in moderate portions — go for a tomato or vegetable-based sauce over a creamy one.',
  },
  {
    name: 'Fish',
    aliases: ['salmon', 'grilled fish', 'baked fish', 'tuna'],
    calories: 175,
    protein: 25,
    carbs: 0,
    fat: 8,
    sugar: 0,
    fibre: 0,
    healthScore: 9.1,
    gymScore: 9.0,
    weightLossScore: 8.2,
    muscleBuildingScore: 8.8,
    energyScore: 6.2,
    recoveryScore: 9.2,
    micronutrients: ['Omega-3', 'Vitamin D', 'Selenium'],
    hydrationPercent: 70,
    benefits: [
      'High in lean protein',
      'Many types are rich in omega-3 fats',
      'Generally low in saturated fat',
    ],
    negatives: ['Battered or deep-fried preparations lose most of these benefits'],
    dailyRecommendation: 'Great choice, especially grilled or baked.',
  },
  {
    name: 'Chocolate',
    aliases: ['chocolate bar', 'candy bar'],
    calories: 210,
    protein: 2.5,
    carbs: 24,
    fat: 13,
    sugar: 20,
    fibre: 2,
    healthScore: 3.2,
    gymScore: 3.0,
    weightLossScore: 1.5,
    muscleBuildingScore: 2.5,
    energyScore: 7.5,
    recoveryScore: 3.0,
    micronutrients: ['Magnesium', 'Iron'],
    hydrationPercent: 5,
    benefits: [
      'Dark chocolate contains some antioxidants',
      'Small amounts can satisfy sweet cravings',
    ],
    negatives: [
      'High in added sugar and fat',
      'Very easy to overeat',
      'Low nutritional value overall',
    ],
    dailyRecommendation: 'Fine as an occasional small treat — dark chocolate is the better pick.',
  },
  {
    name: 'Soft drinks',
    aliases: ['soda', 'cola', 'soft drink', 'fizzy drink', 'coke'],
    calories: 150,
    protein: 0,
    carbs: 39,
    fat: 0,
    sugar: 39,
    fibre: 0,
    healthScore: 1.5,
    gymScore: 1.0,
    weightLossScore: 0.8,
    muscleBuildingScore: 0.5,
    energyScore: 8.0,
    recoveryScore: 1.5,
    micronutrients: [],
    hydrationPercent: 90,
    benefits: ['Can provide a quick jolt of energy from sugar'],
    negatives: [
      'High in added sugar with no nutrients',
      'Linked to weight gain and dental issues with regular use',
      'No fibre or protein at all',
    ],
    dailyRecommendation:
      'Best kept as a rare treat — water, tea, or sparkling water are better everyday choices.',
  },
  {
    name: 'Chicken rice bowl',
    aliases: ['chicken and rice', 'chicken rice bowl', 'chicken bowl'],
    calories: 520,
    protein: 34,
    carbs: 55,
    fat: 12,
    sugar: 3,
    fibre: 3,
    healthScore: 8.0,
    gymScore: 8.5,
    weightLossScore: 6.5,
    muscleBuildingScore: 8.0,
    energyScore: 8.5,
    recoveryScore: 7.5,
    micronutrients: ['Vitamin B6', 'Iron'],
    hydrationPercent: 60,
    benefits: [
      'High protein',
      'Good energy source',
      'Contains useful nutrients if vegetables are included',
    ],
    negatives: ['Portion size matters', 'Sauce may increase calories'],
    dailyRecommendation: 'Good choice for an active day.',
  },
];

// Small helper so the Food Analyzer can look a food up by free text (typed,
// tapped as a quick-pick, or spoken via "analyze food X"). Matches on the
// exact name first, then aliases, then a loose "contains" check so partial
// phrases like "grilled chicken breast" still find "Chicken breast".
export function findFoodMatch(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // 1. exact name match
  let hit = FOOD_DATABASE.find((f) => f.name.toLowerCase() === q);
  if (hit) return hit;

  // 2. exact alias match
  hit = FOOD_DATABASE.find((f) => f.aliases.some((a) => a.toLowerCase() === q));
  if (hit) return hit;

  // 3. loose contains match (either direction)
  hit = FOOD_DATABASE.find((f) => {
    const name = f.name.toLowerCase();
    if (q.includes(name) || name.includes(q)) return true;
    return f.aliases.some((a) => q.includes(a.toLowerCase()) || a.toLowerCase().includes(q));
  });
  return hit || null;
}
