document.addEventListener('bitebook:ready', () => {
  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const examplesEl = document.getElementById('chat-examples');

  const history = [];

  function updateSendState() {
    sendBtn.disabled = !chatInput.value.trim();
  }
  chatInput.addEventListener('input', updateSendState);

  function stripMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1');
  }

  function renderMessage(role, text, extraClass) {
    const bubble = document.createElement('div');
    bubble.className = `chat-message ${role}${extraClass ? ' ' + extraClass : ''}`;
    bubble.textContent = role === 'ai' ? stripMarkdown(text) : text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  }

  // A narrow, deliberately literal trigger — "log a meal" is a command, not
  // a guess at intent, so this only fires on an explicit "log ..." / "add an
  // entry ..." opener. Anything else, including "what did I log yesterday",
  // stays a normal question. Same conservative instinct as menu lookup and
  // Ideas for you: a feature that occasionally acts on a misread is worse
  // than one that sometimes asks you to be more explicit.
  function extractLogCommandText(text) {
    const match = /^(?:log|add)\s+(?:that\s+|an?\s+entry\s*(?:that\s+|:\s*)?)?(.+)/i.exec(text.trim());
    return match ? match[1].trim() : null;
  }

  async function logMealFromChat(description) {
    renderMessage('user', description.length < 80 ? `Log: ${description}` : description);
    chatInput.value = '';
    updateSendState();
    sendBtn.disabled = true;
    chatInput.disabled = true;

    const thinkingBubble = renderMessage('ai', '📝 Drafting that...', 'thinking');

    try {
      const now = new Date();
      const profile = BiteBookProfile.get();
      const result = await BiteBookAI.extractEntryFromText(description, {
        today: toDateInputValue(now),
        weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        familyMembers: (profile && profile.familyMembers) || [],
      });

      const mentionedFamilyIds = matchFamilyIds(result.mentionedFamily, (profile && profile.familyMembers) || []);
      const companionTypes = Array.isArray(result.companionTypes) ? [...result.companionTypes] : [];
      if (mentionedFamilyIds.length && !companionTypes.includes('family')) companionTypes.push('family');

      const now2 = new Date().toISOString();
      const entry = {
        id: BiteBookStorage.newId(),
        food: (result.food && result.food.trim()) || description,
        mealType: result.mealType || guessMealTypeFromTime(),
        mealTypeAutoPicked: !result.mealType,
        cuisine: resolveOrOther(result.cuisine, result.cuisineOther),
        ateOn: isValidDateStr(result.ateOn) ? result.ateOn : toDateInputValue(now),
        timeMode: 'fuzzy',
        timeOfDay: result.timeOfDay || guessTimeOfDayFromTime(),
        timeAutoPicked: !result.timeOfDay,
        placeName: result.placeName || null,
        placeType: resolveOrOther(result.placeType, result.placeTypeOther),
        placeSource: result.placeName ? 'ai' : null,
        drinks: result.drinks || null,
        companionTypes,
        companionFamilyIds: mentionedFamilyIds,
        companionNames: result.companionNames || null,
        madeBy: resolveOrOther(result.madeBy, result.madeByOther),
        madeByName: result.madeByName || null,
        reason: resolveOrOther(result.reason, result.reasonOther),
        ingredientsText: result.ingredientsText || null,
        likedQualities: Array.isArray(result.likedQualities) ? result.likedQualities : [],
        likedOther: result.likedOther || null,
        rating: clampRating(result.rating),
        wouldEatAgain: result.wouldEatAgain || null,
        personalRank: result.personalRank || null,
        reflection: result.reflection || null,
        photos: [],
        status: 'draft',
        aiParsed: true,
        createdAt: now2,
        updatedAt: now2,
      };

      const ok = await BiteBookStorage.saveEntry(entry);
      thinkingBubble.remove();
      if (!ok) {
        renderMessage('ai', "⚠️ Something went wrong saving that — try again in a moment.", 'error');
        return;
      }
      const bits = [entry.food];
      if (entry.placeName) bits.push(`at ${entry.placeName}`);
      const bubble = renderMessage('ai', `📝 Got it — I started a draft: ${bits.join(' ')}, ${formatDateLabel(entry.ateOn)}.`);
      const link = document.createElement('a');
      link.href = `entry.html?id=${encodeURIComponent(entry.id)}`;
      link.className = 'link-pill';
      link.textContent = 'Review & finish it →';
      link.style.marginTop = '8px';
      link.style.display = 'inline-block';
      bubble.appendChild(document.createElement('br'));
      bubble.appendChild(link);
    } catch (err) {
      thinkingBubble.remove();
      renderMessage('ai', BiteBookAI.friendlyErrorMessage(err), 'error');
    } finally {
      chatInput.disabled = false;
      updateSendState();
      chatInput.focus();
    }
  }

  async function buildJournalContext() {
    const [allEntries, myId, directory] = await Promise.all([
      BiteBookStorage.listEntries(),
      BiteBookStorage.getCurrentUserId(),
      BiteBookStorage.listDirectory(),
    ]);
    const namesById = new Map(directory.map((p) => [p.id, p.name || 'someone they know']));

    const entries = allEntries.map((e) => ({
      owner: e.ownerId === myId ? 'me' : (namesById.get(e.ownerId) || 'someone else'),
      food: e.food,
      status: e.status,
      mealType: e.mealType,
      cuisine: e.cuisine,
      ateOn: e.ateOn,
      timeOfDay: e.timeOfDay,
      placeName: e.placeName,
      placeType: e.placeType,
      companions: companionSummaryLabel(e) || null,
      madeBy: e.madeBy,
      madeByName: e.madeByName,
      reason: e.reason,
      occasionDate: e.occasionDate,
      ingredients: e.ingredientsText,
      likedQualities: e.likedQualities,
      rating: e.rating,
      wouldEatAgain: e.wouldEatAgain,
      personalRank: e.personalRank,
      reflection: e.reflection,
    }));
    return { entries, today: toDateInputValue(new Date()) };
  }

  async function sendQuestion(question) {
    if (!question.trim()) return;

    const logText = extractLogCommandText(question);
    if (logText) {
      await logMealFromChat(logText);
      return;
    }

    const entryCount = (await BiteBookStorage.listEntries()).length;
    if (entryCount === 0) {
      renderMessage('user', question);
      renderMessage('ai', "You haven't logged any meals yet — log a few, then come back and ask me about them!", 'error');
      chatInput.value = '';
      updateSendState();
      return;
    }

    examplesEl.style.display = 'none';
    renderMessage('user', question);
    chatInput.value = '';
    updateSendState();
    sendBtn.disabled = true;
    chatInput.disabled = true;

    const thinkingBubble = renderMessage('ai', '✨ Thinking...', 'thinking');

    try {
      const context = await buildJournalContext();
      const answer = await BiteBookAI.askAboutJournal(question, history, context);
      thinkingBubble.remove();
      renderMessage('ai', answer);
      history.push({ role: 'user', text: question });
      history.push({ role: 'model', text: answer });
    } catch (err) {
      thinkingBubble.remove();
      renderMessage('ai', BiteBookAI.friendlyErrorMessage(err), 'error');
    } finally {
      chatInput.disabled = false;
      updateSendState();
      chatInput.focus();
    }
  }

  sendBtn.addEventListener('click', () => sendQuestion(chatInput.value.trim()));

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
      sendQuestion(chatInput.value.trim());
    }
  });

  examplesEl.querySelectorAll('.chat-example-chip').forEach((chip) => {
    chip.addEventListener('click', () => sendQuestion(chip.dataset.q));
  });

  renderMessage('ai', "Try asking about your favorite dishes, how often someone cooks for you, or what cuisine you eat most. Or say \"Log that...\" and I'll start a draft entry for you.");
});
