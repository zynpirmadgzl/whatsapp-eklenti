// WhatsApp Yazım & Noktalama Düzeltici - Background Service Worker

const PROMPTS = {
  standard: `Sen profesyonel bir Türkçe dil editörüsün. Kullanıcının yazdığı metni sadece dilbilgisi, imla (yazım kuralları), büyük/küçük harf ve noktalama işaretleri açısından düzelt.
KURALLAR:
1. Metnin orijinal anlamını, kelimelerini, üslubunu ve samimiyetini kesinlikle değiştirme.
2. Fazladan kelime ekleme veya çıkarma; sadece yazım ve noktalama hatalarını düzelt.
3. Emojileri, satır başlarını ve özel isimleri koru.
4. Yanıtında ASLA açıklama, tırnak işareti veya 'Düzeltilmiş metin:' gibi ifadeler kullanma. SADECE düzeltilmiş metni döndür.`,

  professional: `Sen kurumsal iletişim uzmanı bir Türkçe editörüsün. Kullanıcının yazdığı metni imla, noktalama ve dilbilgisi açısından kusursuz hale getir. Üslubu saygılı, kurumsal ve profesyonel bir tona uyarla. Emojileri ve ana mesajı koru. Yalnızca düzeltilmiş metni döndür, açıklama yapma.`,

  casual: `Sen bir Türkçe editörsün. Kullanıcının samimi ve günlük mesajındaki yazım ve noktalama hatalarını düzelt. Doğal konuşma samimiyetini, argo olmayan günlük ifadeleri ve emojileri bozma. Yalnızca düzeltilmiş metni döndür, açıklama yapma.`
};

const FALLBACK_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "correctText") {
    handleTextCorrection(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Asenkron yanıt için
  }

  if (request.action === "testApiKey") {
    testApiKey(request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      groqApiKey: "",
      model: "llama-3.1-8b-instant",
      mode: "standard"
    }, (items) => {
      resolve(items);
    });
  });
}

async function callGroqApi(apiKey, model, systemPrompt, text) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      temperature: 0.2,
      max_tokens: 2048
    })
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function handleTextCorrection(request) {
  const text = request.text ? request.text.trim() : "";
  if (!text) {
    return { success: false, error: "Düzeltilecek metin bulunamadı." };
  }

  const settings = await getSettings();
  const apiKey = request.apiKey || settings.groqApiKey;

  if (!apiKey) {
    return {
      success: false,
      error: "Groq API anahtarı bulunamadı. Lütfen eklenti simgesine tıklayıp ücretsiz API anahtarınızı kaydedin."
    };
  }

  const mode = request.mode || settings.mode || "standard";
  const systemPrompt = PROMPTS[mode] || PROMPTS.standard;
  let model = request.model || settings.model || "llama-3.1-8b-instant";

  try {
    let apiResult = await callGroqApi(apiKey, model, systemPrompt, text);

    // Eğer model hesaba tanımlı değilse otomatik olarak Llama 3.1 8B veya diğer modele geçiş yap
    if (!apiResult.ok && (apiResult.status === 404 || apiResult.data?.error?.code === "model_not_found" || apiResult.data?.error?.message?.includes("does not exist"))) {
      for (const fallback of FALLBACK_MODELS) {
        if (fallback !== model) {
          apiResult = await callGroqApi(apiKey, fallback, systemPrompt, text);
          if (apiResult.ok) {
            // Başarılı olan modeli kalıcı olarak kaydet
            chrome.storage.sync.set({ model: fallback });
            break;
          }
        }
      }
    }

    if (!apiResult.ok) {
      if (apiResult.status === 401) {
        throw new Error("Geçersiz API Anahtarı! Lütfen Groq API anahtarınızı kontrol edin.");
      } else if (apiResult.status === 429) {
        throw new Error("Hız sınırı aşıldı. Lütfen birkaç saniye bekleyip tekrar deneyin.");
      } else {
        throw new Error(apiResult.data?.error?.message || `Groq API Hatası: ${apiResult.status}`);
      }
    }

    let correctedText = apiResult.data.choices?.[0]?.message?.content?.trim() || text;

    // Model baştan/sondan tırnak koyduysa ve orijinal metin tırnakla başlamadıysa temizle
    if (correctedText.startsWith('"') && correctedText.endsWith('"') && !text.startsWith('"')) {
      correctedText = correctedText.slice(1, -1).trim();
    }

    return {
      success: true,
      correctedText: correctedText,
      originalText: text
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Bağlantı hatası oluştu."
    };
  }
}

async function testApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: "API anahtarı boş olamaz." };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map(m => m.id) || [];
      return { success: true, models: models };
    } else {
      const data = await response.json();
      return { success: false, error: data.error?.message || "Geçersiz API Anahtarı" };
    }
  } catch (err) {
    return { success: false, error: "Sunucuya ulaşılamadı: " + err.message };
  }
}
