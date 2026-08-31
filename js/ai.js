const BiteBookAI = (() => {
  const GEMINI_MODEL = 'gemini-3.6-flash';

  const ENTRY_EXTRACTION_SCHEMA = {
    type: 'OBJECT',
    properties: {
      food: { type: 'STRING', nullable: true },
      mealType: { type: 'STRING', nullable: true, enum: ['breakfast', 'lunch', 'high-tea', 'dinner', 'supper', 'snack', 'light-munching'] },
      cuisine: { type: 'STRING', nullable: true, enum: ['indian-home', 'indian-restaurant', 'italian', 'chinese', 'thai', 'mexican', 'japanese', 'mediterranean', 'american', 'continental', 'other'] },
      cuisineOther: { type: 'STRING', nullable: true },
      ateOn: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD' },
      timeOfDay: { type: 'STRING', nullable: true, enum: ['early-morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'late-night'] },
      placeName: { type: 'STRING', nullable: true },
      placeType: { type: 'STRING', nullable: true, enum: ['home', 'restaurant', 'someone-else', 'work-school', 'on-the-go', 'travel', 'other'] },
      placeTypeOther: { type: 'STRING', nullable: true },
      companionTypes: { type: 'ARRAY', nullable: true, items: { type: 'STRING', enum: ['solo', 'family', 'friends', 'someone-special', 'classmates-coworkers', 'big-group', 'other'] } },
      companionNames: { type: 'STRING', nullable: true },
      mentionedFamily: { type: 'ARRAY', nullable: true, items: { type: 'STRING' }, description: 'Names/relationships from the known family list who were present' },
      madeBy: { type: 'STRING', nullable: true, enum: ['me', 'mom', 'dad', 'grandparent', 'other-family', 'chef-restaurant', 'store-bought', 'other'] },
      madeByOther: { type: 'STRING', nullable: true },
      madeByName: { type: 'STRING', nullable: true },
      reason: { type: 'STRING', nullable: true, enum: ['birthday', 'anniversary', 'celebration', 'comfort', 'craving', 'requested', 'everyday', 'other'] },
      reasonOther: { type: 'STRING', nullable: true },
      ingredientsText: { type: 'STRING', nullable: true },
      likedQualities: { type: 'ARRAY', nullable: true, items: { type: 'STRING', enum: ['delicious', 'spice-level', 'healthy', 'indulgent', 'comforting', 'refreshing', 'texture', 'sweet', 'nostalgic', 'new', 'love', 'other'] } },
      likedOther: { type: 'STRING', nullable: true },
      rating: { type: 'INTEGER', nullable: true },
      wouldEatAgain: { type: 'STRING', nullable: true, enum: ['yes', 'maybe', 'no'] },
      personalRank: { type: 'STRING', nullable: true, enum: ['top', 'favorite', 'good', 'fine', 'not-for-me'] },
      reflection: { type: 'STRING', nullable: true },
    },
  };

  function buildPrompt(text, context) {
    const familyLines = (context.familyMembers || [])
      .map((m) => `- ${familyMemberDisplayName(m)} (${m.relationship})`)
      .join('\n') || '(none saved)';

    return [
      'You extract structured data from a short, casual description of a meal, for a personal food journal app.',
      `Today's date is ${context.today} (${context.weekday}). The current time is ${context.time}.`,
      '',
      'Known family members who might be mentioned:',
      familyLines,
      '',
      'Rules:',
      '- Only fill in fields that are clearly stated or strongly implied. Leave anything uncertain as null — never invent details.',
      '- Resolve relative dates ("yesterday", "last night", "this morning") into an exact YYYY-MM-DD date using today\'s date above.',
      '- If a field has an "Other" variant (e.g. cuisineOther), only use it when the value doesn\'t fit the fixed options, describing it in a couple of words.',
      '- For mentionedFamily, list any of the known family members above who were said to be present, using their exact name/relationship as listed.',
      '- For rating, only infer 1-5 when sentiment is clearly expressed (e.g. "loved it" -> 5, "it was okay" -> 3, "hated it" -> 1); otherwise leave null.',
      '',
      `Description: "${text.trim()}"`,
    ].join('\n');
  }

  async function extractEntryFromText(text, context) {
    const settings = (typeof BiteBookSettings !== 'undefined') ? BiteBookSettings.get() : {};
    const apiKey = settings && settings.geminiApiKey;
    if (!apiKey) {
      const err = new Error('No Gemini API key saved.');
      err.code = 'NO_KEY';
      throw err;
    }

    const prompt = buildPrompt(text, context);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: ENTRY_EXTRACTION_SCHEMA,
          },
        }),
      });
    } catch (e) {
      const err = new Error('Network error reaching Gemini.');
      err.code = 'NETWORK';
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`Gemini API error ${res.status}`);
      if (res.status === 400 || res.status === 403) err.code = 'BAD_KEY';
      else if (res.status === 404) err.code = 'MODEL_ERROR';
      else if (res.status === 429) err.code = 'RATE_LIMIT';
      else err.code = 'API_ERROR';
      throw err;
    }

    const data = await res.json();
    const textPart = data
      && data.candidates
      && data.candidates[0]
      && data.candidates[0].content
      && data.candidates[0].content.parts
      && data.candidates[0].content.parts[0]
      && data.candidates[0].content.parts[0].text;

    if (!textPart) {
      const err = new Error('Empty response from Gemini.');
      err.code = 'EMPTY_RESPONSE';
      throw err;
    }

    try {
      return JSON.parse(textPart);
    } catch (e) {
      const err = new Error('Could not parse Gemini response as JSON.');
      err.code = 'PARSE_ERROR';
      throw err;
    }
  }

  return { extractEntryFromText };
})();
