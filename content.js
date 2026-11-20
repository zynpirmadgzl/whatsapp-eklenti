// WhatsApp Yazım & Noktalama Düzeltici - Content Script

(function () {
  'use strict';

  const BUTTON_ID = 'wa-grammar-fixer-btn';
  const TOAST_ID = 'wa-grammar-fixer-toast';
  let isFixing = false;

  // Modern SVG Sihirli Değnek İkonu
  const WAND_SVG = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M7.5 5.6L5 7 6.4 4.5 5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM19.5 2l1.2 2.3L23 5.5l-2.3 1.2L19.5 9l-1.2-2.3L16 5.5l2.3-1.2L19.5 2zM13.8 8.8l1.4 1.4-9.9 9.9-1.4-1.4 9.9-9.9m0-2.8a2 2 0 0 0-2.8 0L1.7 15.3a2 2 0 0 0 0 2.8l4.2 4.2a2 2 0 0 0 2.8 0l9.3-9.3a2 2 0 0 0 0-2.8l-4.2-4.2z"/>
    </svg>
  `;

  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  `;

  const SPINNER_SVG = `
    <svg viewBox="0 0 24 24" width="22" height="22" class="wa-fixer-spinner" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
    </svg>
  `;

  // Mesaj giriş kutusunu bulma fonksiyonu
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
           document.querySelector('#main [contenteditable="true"]') ||
           document.querySelector('footer [contenteditable="true"]') ||
           document.querySelector('div[data-lexical-editor="true"]') ||
           document.querySelector('[contenteditable="true"]');
  }

  // Bildirim mesajı göster
  function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    toast.className = `wa-fixer-toast wa-fixer-toast-${type}`;
    toast.textContent = message;
    toast.classList.add('wa-fixer-toast-visible');

    setTimeout(() => {
      toast.classList.remove('wa-fixer-toast-visible');
    }, duration);
  }

  // Metni WhatsApp giriş kutusundan oku
  function getInputText(inputEl) {
    return inputEl.innerText || inputEl.textContent || '';
  }

  // Metni WhatsApp giriş kutusuna güvenle yaz (React/Lexical uyumlu)
  function setInputText(inputEl, newText) {
    if (!inputEl) return;
    inputEl.focus();

    // 1. WhatsApp Lexical editöründeki tüm metni seç ve sil
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // 2. Düzeltilmiş metni yerleştir
    let success = false;
    try {
      success = document.execCommand('insertText', false, newText);
    } catch (e) {
      success = false;
    }

    // 3. Eğer execCommand insertText başarısız olduysa veya metin kutusu boş kaldıysa, ClipboardEvent (Paste) ile yerleştir
    const current = (inputEl.innerText || inputEl.textContent || '').trim();
    if (!success || !current) {
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

    // 4. WhatsApp React durumunu ve Gönder (uçak) butonunu tetikle
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // Düzeltme işlemini tetikle
  async function triggerCorrection() {
    if (isFixing) return;

    const inputEl = getChatInput();
    if (!inputEl) {
      showToast('Mesaj kutusu bulunamadı!', 'error');
      return;
    }

    let currentText = getInputText(inputEl).trim();
    
    // Mac'te Option+D basıldığında oluşan '∂' sembollerini ve boşlukları temizle
    currentText = currentText.replace(/[∂\s]+$/g, '').trim();

    if (!currentText) {
      showToast('Lütfen önce düzeltilecek bir metin yazın.', 'info');
      return;
    }

    const button = document.getElementById(BUTTON_ID);
    isFixing = true;
    if (button) {
      button.classList.add('wa-fixer-loading');
      button.innerHTML = SPINNER_SVG;
      button.setAttribute('title', 'Düzeltiliyor...');
    }

    showToast('Düzeltiliyor... ✨', 'info', 1500);

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      isFixing = false;
      showToast('Eklenti güncellendi. Lütfen WhatsApp sayfasını (Cmd + R) ile bir kez yenileyin.', 'error', 4500);
      return;
    }

    try {
      chrome.runtime.sendMessage({
        action: 'correctText',
        text: currentText
      }, (response) => {
        isFixing = false;

        if (chrome.runtime.lastError) {
          if (button) {
            button.classList.remove('wa-fixer-loading');
            button.innerHTML = WAND_SVG;
            button.setAttribute('title', 'Yazımı & Noktalamayı Düzelt (Option + D)');
          }
          const msg = chrome.runtime.lastError.message || '';
          if (msg.includes('context invalidated') || msg.includes('Extension')) {
            showToast('Lütfen WhatsApp sayfasını (Cmd + R) ile bir kez yenileyin.', 'error', 4500);
          } else {
            showToast('Eklenti iletişim hatası: ' + msg, 'error');
          }
          return;
        }

        if (response && response.success) {
          setInputText(inputEl, response.correctedText);

          if (button) {
            button.classList.remove('wa-fixer-loading');
            button.classList.add('wa-fixer-success');
            button.innerHTML = CHECK_SVG;
            button.setAttribute('title', 'Başarıyla Düzeltildi!');

            setTimeout(() => {
              button.classList.remove('wa-fixer-success');
              button.innerHTML = WAND_SVG;
              button.setAttribute('title', 'Yazımı & Noktalamayı Düzelt (Option + D)');
            }, 1800);
          }
          showToast('Metin düzeltildi! ✨', 'success', 2000);
        } else {
          if (button) {
            button.classList.remove('wa-fixer-loading');
            button.innerHTML = WAND_SVG;
            button.setAttribute('title', 'Yazımı & Noktalamayı Düzelt (Option + D)');
          }
          showToast(response?.error || 'Bir hata oluştu.', 'error', 4500);
        }
      });
    } catch (err) {
      isFixing = false;
      if (button) {
        button.classList.remove('wa-fixer-loading');
        button.innerHTML = WAND_SVG;
      }
      if (err.message && (err.message.includes('sendMessage') || err.message.includes('context invalidated'))) {
        showToast('Eklenti güncellendi. Lütfen WhatsApp sayfasını (Cmd + R) ile yenileyin.', 'error', 4500);
      } else {
        showToast('Beklenmeyen hata: ' + err.message, 'error');
      }
    }
  }

  // Butonun yerleştirileceği en uygun hedefi bul
  function findInsertionTarget() {
    const footer = document.querySelector('footer') || document.querySelector('#main footer');
    if (!footer) return null;

    // 1. Gönder (Send), Mikrofon (PTT) veya Süreli Mesaj (Saat) butonunu bul
    const sendIcon = footer.querySelector('span[data-icon="send"]');
    const micIcon = footer.querySelector('span[data-icon="ptt"]') || footer.querySelector('span[data-icon="microphone"]');
    const clockIcon = footer.querySelector('span[data-icon*="ephemeral"]');
    
    const rightActionEl = (sendIcon || micIcon || clockIcon)?.closest('button') || 
                         (sendIcon || micIcon || clockIcon)?.closest('div[role="button"]') ||
                         footer.querySelector('button[aria-label*="Send" i]') ||
                         footer.querySelector('button[aria-label*="Gönder" i]');

    if (rightActionEl && rightActionEl.parentElement) {
      return { parent: rightActionEl.parentElement, before: rightActionEl };
    }

    // 2. Emoji butonunun yanını dene
    const emojiBtn = footer.querySelector('span[data-icon="smiley"]')?.closest('button') ||
                     footer.querySelector('button[aria-label*="Emoji" i]');
    if (emojiBtn && emojiBtn.parentElement) {
      return { parent: emojiBtn.parentElement, before: emojiBtn.nextSibling };
    }

    // 3. Mesaj kutusu konteynerini dene
    const inputEl = getChatInput();
    if (inputEl) {
      const container = inputEl.closest('div[tabindex="-1"]') || inputEl.parentElement;
      if (container && container.parentElement) {
        return { parent: container.parentElement, before: container.nextSibling };
      }
    }

    return { parent: footer, before: null };
  }

  // Butonu sayfaya yerleştir
  function injectFixerButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const target = findInsertionTarget();
    if (!target || !target.parent) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'wa-fixer-btn';
    button.setAttribute('aria-label', 'Yazımı ve Noktalamayı Düzelt (Option + D)');
    button.setAttribute('title', 'Yazımı & Noktalamayı Düzelt (Option + D veya Cmd+Shift+D)');
    button.innerHTML = WAND_SVG;

    button.addEventListener('mousedown', (e) => {
      // Butona tıklandığında mesaj kutusunun odağı (focus) ve seçimi kaybetmesini engeller
      e.preventDefault();
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCorrection();
    });

    if (target.before) {
      target.parent.insertBefore(button, target.before);
    } else {
      target.parent.appendChild(button);
    }
  }

  // Kısayol Tuşu Dinleyicisi (HER ZAMAN AKTİF)
  function attachShortcutListener() {
    window.addEventListener('keydown', (e) => {
      // Mac Turkish/US Q Klavye için:
      // Option + D basıldığında Mac'te e.key === '∂' üretilir!
      const isOptionD = e.altKey && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.key === '∂');
      
      // Alternatif güvenli kısayol: Cmd + Shift + D veya Ctrl + Shift + D
      const isCmdShiftD = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D');

      if (isOptionD || isCmdShiftD) {
        const inputEl = getChatInput();
        if (inputEl) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          triggerCorrection();
        }
      }
    }, true); // capture: true (WhatsApp'tan önce yakalar)
  }

  // Kısayol dinleyicisini doğrudan başlat
  attachShortcutListener();

  // Sayfa değişikliklerini sürekli gözlemle
  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUTTON_ID)) {
      injectFixerButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // İlk çalıştırma kontrolleri
  setTimeout(injectFixerButton, 500);
  setTimeout(injectFixerButton, 1500);
  setTimeout(injectFixerButton, 3000);
})();
