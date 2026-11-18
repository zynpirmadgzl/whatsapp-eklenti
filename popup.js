// WhatsApp Yazım & Noktalama Düzeltici - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const apiStatus = document.getElementById('apiStatus');
  const modeSelect = document.getElementById('modeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const testInput = document.getElementById('testInput');
  const testBtn = document.getElementById('testBtn');
  const testResultWrapper = document.getElementById('testResultWrapper');
  const testResult = document.getElementById('testResult');
  const copyResultBtn = document.getElementById('copyResultBtn');

  // Mevcut ayarları yükle
  chrome.storage.sync.get({
    groqApiKey: '',
    model: 'llama-3.1-8b-instant',
    mode: 'standard'
  }, (items) => {
    if (items.groqApiKey) {
      apiKeyInput.value = items.groqApiKey;
      setApiStatus(true, 'Hazır ✓');
    } else {
      setApiStatus(false, 'Anahtar Gerekli');
    }

    modeSelect.value = items.mode;
    modelSelect.value = items.model;
  });

  // Şifre Göster / Gizle
  toggleKeyVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyVisibilityBtn.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyVisibilityBtn.textContent = '👁️';
    }
  });

  // API Anahtarını Kaydet ve Doğrula
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      setApiStatus(false, 'Lütfen anahtar girin');
      return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = 'Doğrulanıyor...';

    chrome.runtime.sendMessage({ action: 'testApiKey', apiKey: key }, (response) => {
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = 'Kaydet & Doğrula';

      if (response && response.success) {
        chrome.storage.sync.set({ groqApiKey: key }, () => {
          setApiStatus(true, 'Kaydedildi ✓');
          saveKeyBtn.textContent = '✓ Kaydedildi';
          setTimeout(() => {
            saveKeyBtn.textContent = 'Kaydet & Doğrula';
          }, 2000);
        });
      } else {
        setApiStatus(false, 'Geçersiz Anahtar');
        alert('Groq API Hatası: ' + (response?.error || 'Anahtar doğrulanamadı.'));
      }
    });
  });

  // Mod Seçimini Kaydet
  modeSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ mode: modeSelect.value });
  });

  // Model Seçimini Kaydet
  modelSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ model: modelSelect.value });
  });

  // Hızlı Test
  testBtn.addEventListener('click', () => {
    const text = testInput.value.trim();
    if (!text) {
      alert('Lütfen test etmek için bir metin yazın.');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Düzeltiliyor...';
    testResultWrapper.classList.add('hidden');

    chrome.runtime.sendMessage({
      action: 'correctText',
      text: text,
      apiKey: apiKeyInput.value.trim(),
      mode: modeSelect.value,
      model: modelSelect.value
    }, (response) => {
      testBtn.disabled = false;
      testBtn.textContent = 'Metni Düzelt';

      if (response && response.success) {
        testResult.textContent = response.correctedText;
        testResultWrapper.classList.remove('hidden');
      } else {
        alert(response?.error || 'Düzeltme sırasında bir hata oluştu.');
      }
    });
  });

  // Düzeltilmiş Metni Kopyala
  if (copyResultBtn) {
    copyResultBtn.addEventListener('click', async () => {
      const text = testResult.textContent;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        copyResultBtn.textContent = '✓ Kopyalandı';
        copyResultBtn.classList.add('copied');

        setTimeout(() => {
          copyResultBtn.textContent = '📋 Kopyala';
          copyResultBtn.classList.remove('copied');
        }, 1800);
      } catch (err) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        copyResultBtn.textContent = '✓ Kopyalandı';
        copyResultBtn.classList.add('copied');
        setTimeout(() => {
          copyResultBtn.textContent = '📋 Kopyala';
          copyResultBtn.classList.remove('copied');
        }, 1800);
      }
    });
  }

  function setApiStatus(isValid, text) {
    apiStatus.textContent = text;
    apiStatus.className = 'status-indicator ' + (isValid ? 'status-valid' : 'status-missing');
  }
});
