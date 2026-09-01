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

  function buildJournalContext() {
    const entries = BiteBookStorage.listEntries().map((e) => ({
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

    if (BiteBookStorage.listEntries().length === 0) {
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
      const context = buildJournalContext();
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

  renderMessage('ai', "Try asking about your favorite dishes, how often someone cooks for you, or what cuisine you eat most.");
});
