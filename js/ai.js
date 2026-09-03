const BiteBookAI = (() => {
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

    const trimmedText = (text || '').trim();
    const descriptionLine = trimmedText
      ? `Description: "${trimmedText}"`
      : 'No text description was given — identify the dish and infer whatever else you clearly can from the attached photo alone.';

    return [
      'You extract structured data from a short, casual description and/or photo of a meal, for a personal food journal app.',
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
      '- If a photo is attached, use it to identify the food, and its cuisine/plating if visually clear — but don\'t guess fields a photo can\'t show (who was there, why, etc.) unless the text also supports them.',
      '',
      descriptionLine,
    ].join('\n');
  }

  // Routed through a Supabase Edge Function (supabase/functions/gemini-proxy)
  // so the real Gemini key stays server-side — the whole invited group
  // shares it instead of everyone needing their own. The function always
  // responds 200 with an {ok, ...} envelope, so `error` here only ever
  // means "couldn't reach the proxy at all" — a Gemini-side failure (bad
  // key, rate limit, model error) shows up as `data.ok === false` instead.
  async function callGemini(body) {
    const { data, error } = await supabaseClient.functions.invoke('gemini-proxy', { body });

    if (error) {
      let detail = error.message || 'unknown error';
      if (error.context && typeof error.context.text === 'function') {
        try {
          const bodyText = await error.context.text();
          if (bodyText) detail = bodyText;
        } catch (e) {
          // ignore — fall back to error.message
        }
      }
      console.error('gemini-proxy invoke failed:', error, detail);
      const err = new Error(`Could not reach the AI proxy — ${detail}`);
      err.code = 'NETWORK';
      throw err;
    }

    if (!data || !data.ok) {
      const status = data && data.status;
      const err = new Error((data && data.error) || `Proxy error ${status}`);
      if (status === 429) err.code = 'RATE_LIMIT';
      else if (status === 404) err.code = 'MODEL_ERROR';
      else if (status >= 500) err.code = 'NETWORK';
      else err.code = 'API_ERROR';
      throw err;
    }

    const geminiData = data.body;
    const textPart = geminiData
      && geminiData.candidates
      && geminiData.candidates[0]
      && geminiData.candidates[0].content
      && geminiData.candidates[0].content.parts
      && geminiData.candidates[0].content.parts[0]
      && geminiData.candidates[0].content.parts[0].text;

    if (!textPart) {
      const err = new Error('Empty response from Gemini.');
      err.code = 'EMPTY_RESPONSE';
      throw err;
    }
    return textPart;
  }

  async function extractEntryFromText(text, context) {
    const prompt = buildPrompt(text, context);
    const parts = [{ text: prompt }];

    const photoDataUrl = context.photo && context.photo.dataUrl;
    if (photoDataUrl) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(photoDataUrl);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    const textPart = await callGemini({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: ENTRY_EXTRACTION_SCHEMA,
      },
    });

    try {
      return JSON.parse(textPart);
    } catch (e) {
      const err = new Error('Could not parse Gemini response as JSON.');
      err.code = 'PARSE_ERROR';
      throw err;
    }
  }

  function buildJournalSystemPrompt(context) {
    return [
      "You are a friendly assistant answering questions about someone's personal food journal app called Bite Book. You're talking to the signed-in user — refer to them as \"you.\"",
      `Today's date is ${context.today}.`,
      'Below is the journal data visible to this user, as JSON — one object per meal.',
      '"status" is "draft" or "complete" (drafts may be missing fields). "rating" is 1-5 stars — that entry\'s owner\'s own opinion, not necessarily the current user\'s.',
      '"owner" is "me" for an entry the current user logged themselves, or another person\'s name if it\'s an entry someone shared with the current user. For a shared entry, the current user may or may not have actually been there — don\'t assume "I" in a question refers to the shared entry\'s owner. Attribute shared entries to the right person (e.g. "That one was [Name]\'s — they had...") rather than presenting it as the current user\'s own meal, unless the entry\'s own details (like who they ate with) show the current user was actually part of it.',
      '',
      JSON.stringify(context.entries),
      '',
      'Rules:',
      '- Answer naturally and specifically — mention dish names, dates, ratings, or people where relevant.',
      "- If the data doesn't answer the question, say so honestly rather than guessing or inventing details.",
      '- Keep answers conversational and reasonably concise, unless the user is asking for a list.',
      "- Write in plain text only — no markdown, no asterisks for bold/italic.",
    ].join('\n');
  }

  async function askAboutJournal(question, history, context) {
    const contents = (history || []).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: question }] });

    return callGemini({
      contents,
      systemInstruction: { parts: [{ text: buildJournalSystemPrompt(context) }] },
    });
  }

  const INSIGHTS_SCHEMA = {
    type: 'OBJECT',
    properties: {
      insights: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'Each a single specific, interesting, non-generic observation, 1-2 sentences, grounded in the actual data.',
      },
    },
    required: ['insights'],
  };

  function buildInsightsPrompt(context) {
    return [
      "You analyze someone's personal food journal and surface a few genuinely interesting, specific observations about their eating patterns.",
      `Today's date is ${context.today}.`,
      'Journal data (JSON, one object per meal):',
      JSON.stringify(context.entries),
      '',
      'Rules:',
      '- Give 3 to 5 observations. Each must be specific and grounded in the actual data — cite numbers, dish names, or dates. Never generic advice like "try eating healthier".',
      '- Look for real patterns: trends over time, standout favorites or dislikes, who cooks what, how ratings vary by cuisine/company/time, notable streaks or gaps.',
      "- If there isn't enough data for a pattern, don't force one — fewer, better observations beat padding.",
      '- Write in plain text only, second person ("You..."), no markdown.',
    ].join('\n');
  }

  async function generateInsights(context) {
    const textPart = await callGemini({
      contents: [{ parts: [{ text: buildInsightsPrompt(context) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: INSIGHTS_SCHEMA,
      },
    });
    try {
      return JSON.parse(textPart).insights || [];
    } catch (e) {
      const err = new Error('Could not parse insights response.');
      err.code = 'PARSE_ERROR';
      throw err;
    }
  }

  const SEMANTIC_SEARCH_SCHEMA = {
    type: 'OBJECT',
    properties: {
      matchingIds: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'ids of entries that match the query in meaning, best matches first. Empty array if nothing fits.',
      },
    },
    required: ['matchingIds'],
  };

  function buildSemanticSearchPrompt(query, entries) {
    return [
      "You search someone's personal food journal by meaning, not just exact words.",
      `Query: "${query}"`,
      '',
      'Journal entries (JSON array, each with an id):',
      JSON.stringify(entries),
      '',
      'Rules:',
      '- Return the ids of entries that plausibly match the query in meaning — consider cuisine, ingredients, mood/qualities, company, occasion, and place, not just literal words.',
      '- Only include entries you are reasonably confident about. An empty list is fine if nothing fits.',
    ].join('\n');
  }

  async function semanticSearchEntries(query, entries) {
    const textPart = await callGemini({
      contents: [{ parts: [{ text: buildSemanticSearchPrompt(query, entries) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SEMANTIC_SEARCH_SCHEMA,
      },
    });
    try {
      return JSON.parse(textPart).matchingIds || [];
    } catch (e) {
      const err = new Error('Could not parse smart search response.');
      err.code = 'PARSE_ERROR';
      throw err;
    }
  }

  const DEDUPE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      groups: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            names: { type: 'ARRAY', items: { type: 'STRING' } },
            suggestedName: { type: 'STRING' },
          },
          required: ['names', 'suggestedName'],
        },
      },
    },
    required: ['groups'],
  };

  function buildDedupePrompt(placeNames) {
    return [
      "Here is a list of place names from someone's personal food journal, typed in by hand over time.",
      'Some might refer to the exact same real-world place, just written differently (typos, abbreviations, with/without a city or suffix, a nickname).',
      '',
      JSON.stringify(placeNames),
      '',
      'Rules:',
      '- Group together only names you are fairly confident refer to the same real place. When in doubt, leave them separate.',
      '- Only include groups of 2 or more names — skip any place with no likely duplicate.',
      '- For each group, suggest the clearest, most complete name as the canonical one.',
    ].join('\n');
  }

  async function findDuplicatePlaces(placeNames) {
    const textPart = await callGemini({
      contents: [{ parts: [{ text: buildDedupePrompt(placeNames) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: DEDUPE_SCHEMA,
      },
    });
    try {
      return JSON.parse(textPart).groups || [];
    } catch (e) {
      const err = new Error('Could not parse cleanup response.');
      err.code = 'PARSE_ERROR';
      throw err;
    }
  }

  function friendlyErrorMessage(err) {
    if (err && err.code === 'MODEL_ERROR') {
      return "The AI model isn't available right now — this app may need a small update.";
    }
    if (err && err.code === 'RATE_LIMIT') {
      return 'Hit the free rate limit — wait a minute and try again.';
    }
    if (err && err.code === 'NETWORK') {
      return `Couldn't reach the AI. ${(err.message || '').replace('Could not reach the AI proxy — ', '') || 'Check your connection and try again.'}`;
    }
    if (err && err.code === 'API_ERROR') {
      return `The AI proxy hit an error: ${err.message || 'unknown'}.`;
    }
    return "Something went wrong — try rephrasing, or try again in a moment.";
  }

  return {
    extractEntryFromText,
    askAboutJournal,
    generateInsights,
    semanticSearchEntries,
    findDuplicatePlaces,
    friendlyErrorMessage,
  };
})();
