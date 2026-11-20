// ==UserScript==
// @name         WhatsApp Web Yazım & Noktalama Düzeltici (Safari & Chrome)
// @namespace    https://web.whatsapp.com/
// @version      1.0
// @description  WhatsApp Web mesajlarınızı Groq AI ile tek tıkla veya Alt+D ile noktalama ve imla açısından düzeltir.
// @author       Antigravity
// @match        https://web.whatsapp.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.groq.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'wa-grammar-fixer-btn-user';
  const TOAST_ID = 'wa-grammar-fixer-toast-user';
  let isFixing = false;

  // Groq API Anahtarı (İlk kullanımda sorulur veya ayarlanabilir)
  function getApiKey() {
    let key = (typeof GM_getValue !== 'undefined') ? GM_getValue('groq_api_key', '') : localStorage.getItem('groq_api_key');
    if (!key) {
      key = prompt("Lütfen ücretsiz Groq API Anahtarınızı (gsk_...) girin:\n(console.groq.com/keys adresinden ücretsiz alabilirsiniz)");
      if (key && key.trim()) {
        key = key.trim();
        if (typeof GM_setValue !== 'undefined') {
          GM_setValue('groq_api_key', key);
        } else {
          localStorage.setItem('groq_api_key', key);
        }
      }
    }
    return key;
  }

  const WAND_SVG = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M7.5 5.6L5 7 6.4 4.5 5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM19.5 2l1.2 2.3L23 5.5l-2.3 1.2L19.5 9l-1.2-2.3L16 5.5l2.3-1.2L19.5 2zM13.8 8.8l1.4 1.4-9.9 9.9-1.4-1.4 9.9-9.9m0-2.8a2 2 0 0 0-2.8 0L1.7 15.3a2 2 0 0 0 0 2.8l4.2 4.2a2 2 0 0 0 2.8 0l9.3-9.3a2 2 0 0 0 0-2.8l-4.2-4.2z"/>
    </svg>
  `;

  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  `;

  function getChatInput() {
    if (document.activeElement && document.activeElement.isContentEditable) {
      const closest = document.activeElement.closest('[contenteditable="true"]');
      if (closest && closest.closest('#main, footer')) {
        return closest;
      }
      if (document.activeElement.closest('#main, footer')) {
        return document.activeElement;
      }
    }
    return document.querySelector('div[data-testid="conversation-compose-box-input"]') ||
           document.querySelector('#main footer [contenteditable="true"]') ||
           document.querySelector('#main div[contenteditable="true"][data-lexical-editor="true"]') ||
           document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
           document.querySelector('#main [contenteditable="true"][role="textbox"]') ||
           document.querySelector('footer [contenteditable="true"]') ||
           document.querySelector('div[role="textbox"][contenteditable="true"]') ||
           document.querySelector('div[data-tab="10"][contenteditable="true"]') ||
           document.querySelector('div[data-lexical-editor="true"]');
  }

  function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.style.cssText = `
        position: fixed;
        bottom: 84px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #111b21;
        color: #e9edef;
        font-family: -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 10px 18px;
        border-radius: 20px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        z-index: 999999;
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.25s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  function setInputText(inputEl, newText) {
    if (!inputEl) return;
    inputEl.focus();

    // 1. Kutudaki mevcut metin düğümlerini bulup baştan sona tam seçim oluştur
    const sel = window.getSelection();
    const range = document.createRange();

    const walker = document.createTreeWalker(inputEl, NodeFilter.SHOW_TEXT, null, false);
    let firstNode = null;
    let lastNode = null;
    while (walker.nextNode()) {
      if (!firstNode) firstNode = walker.currentNode;
      lastNode = walker.currentNode;
    }

    if (firstNode && lastNode) {
      range.setStart(firstNode, 0);
      range.setEnd(lastNode, lastNode.textContent.length);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      range.selectNodeContents(inputEl);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // 2. Seçili eski hatalı metni tamamen sil
    document.execCommand('delete', false, null);

    // Kontrol: Eğer eski metin silinmediyse DOM düğümünü doğrudan boşalt
    if ((inputEl.innerText || inputEl.textContent || '').trim() !== '') {
      range.selectNodeContents(inputEl);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete', false, null);

      if ((inputEl.innerText || inputEl.textContent || '').trim() !== '') {
        const remainingWalker = document.createTreeWalker(inputEl, NodeFilter.SHOW_TEXT, null, false);
        while (remainingWalker.nextNode()) {
          remainingWalker.currentNode.textContent = '';
        }
      }
    }

    // 3. Yeni düzeltilmiş metni tek seferde ekle
    let success = false;
    try {
      success = document.execCommand('insertText', false, newText);
    } catch (e) {
      success = false;
    }

    // 4. Eğer execCommand yazmadıysa, ClipboardEvent Paste ile yerleştir
    const currentBoxText = (inputEl.innerText || inputEl.textContent || '').trim();
    if (!success || !currentBoxText) {
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', newText);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clipboardData: dt
        });
        inputEl.dispatchEvent(pasteEvent);
      } catch (err) {}
    }

    // 5. WhatsApp React durumunu ve Gönder (uçak) butonunu tetikle
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  async function triggerCorrection() {
    if (isFixing) return;

    const inputEl = getChatInput();
    if (!inputEl) {
      showToast('Mesaj kutusu bulunamadı.', 'error');
      return;
    }

    const currentText = (inputEl.innerText || inputEl.textContent || '').trim();
    if (!currentText) {
      showToast('Lütfen önce düzeltilecek bir metin yazın.', 'info');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      showToast('API Anahtarı girilmedi.', 'error');
      return;
    }

    const button = document.getElementById(BUTTON_ID);
    isFixing = true;
    if (button) {
      button.style.opacity = '0.5';
      button.style.cursor = 'wait';
    }

    const systemPrompt = `Sen uzman bir Türkçe dil ve imla editörüsün. Görevin, kullanıcının yazdığı mesajı doğru Türkçe yazım kurallarına, noktalama işaretlerine ve dilbilgisine uygun hale getirmektir.
KURALLAR:
1. Klavye sürçmelerini, yanlış harfleri ve bozuk konuşma dili kısaltmalarını düzelt (Örn: "janim" -> "Canım", "nabion/napıyon" -> "ne yapıyorsun", "bisi" -> "bir şey", "geliyomusun" -> "geliyor musun").
2. Cümle başını büyük harfle başlat. Hitaplardan sonra virgül koy. Soru anlamı varsa mutlaka soru işareti (?) koy.
3. SADECE düzeltilmiş metni döndür, açıklama veya tırnak ekleme.`;

    const requestBody = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: currentText }
      ],
      temperature: 0.2,
      max_tokens: 2048
    });

    const handleSuccess = (responseText) => {
      isFixing = false;
      if (button) {
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.innerHTML = CHECK_SVG;
        setTimeout(() => { button.innerHTML = WAND_SVG; }, 1800);
      }
      try {
        const data = JSON.parse(responseText);
        let corrected = data.choices?.[0]?.message?.content?.trim() || currentText;
        if (corrected.startsWith('"') && corrected.endsWith('"') && !currentText.startsWith('"')) {
          corrected = corrected.slice(1, -1).trim();
        }
        setInputText(inputEl, corrected);
        showToast('Metin düzeltildi! ✨', 'success', 2000);
      } catch (err) {
        showToast('Yanıtlama hatası: ' + err.message, 'error');
      }
    };

    const handleError = (errMsg) => {
      isFixing = false;
      if (button) {
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
      showToast('Hata: ' + errMsg, 'error', 4000);
    };

    if (typeof GM_xmlhttpRequest !== 'undefined') {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        data: requestBody,
        onload: function(res) {
          if (res.status >= 200 && res.status < 300) {
            handleSuccess(res.responseText);
          } else {
            handleError(`HTTP ${res.status}`);
          }
        },
        onerror: function(err) {
          handleError("Bağlantı kurulamadı.");
        }
      });
    } else {
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: requestBody
      })
      .then(r => r.text())
      .then(handleSuccess)
      .catch(e => handleError(e.message));
    }
  }

  function injectFixerButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const inputEl = getChatInput();
    if (!inputEl) return;
    const footer = document.querySelector('footer');
    if (!footer) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.title = 'Yazımı & Noktalamayı Düzelt (Alt + D)';
    button.innerHTML = WAND_SVG;
    button.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      color: #8696a0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => { button.style.color = '#00a884'; });
    button.addEventListener('mouseleave', () => { button.style.color = '#8696a0'; });
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCorrection();
    });

    const inputContainer = inputEl.closest('div[tabindex="-1"]') || inputEl.parentElement;
    if (inputContainer && inputContainer.parentElement) {
      inputContainer.parentElement.insertBefore(button, inputContainer.nextSibling);
    } else {
      footer.appendChild(button);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
      const inputEl = getChatInput();
      if (inputEl && (document.activeElement === inputEl || inputEl.contains(document.activeElement))) {
        e.preventDefault();
        e.stopPropagation();
        triggerCorrection();
      }
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUTTON_ID)) {
      injectFixerButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectFixerButton, 1000);
})();
