// WhatsApp Yazım & Noktalama Düzeltici - Background Service Worker

const PROMPTS = {
  standard: `Sen uzman bir Türkçe dil ve imla editörüsün. Görevin, kullanıcının yazdığı mesajı doğru Türkçe yazım kurallarına, noktalama işaretlerine ve dilbilgisine uygun hale getirmektir.

GÖREVLER VE KURALLAR:
1. İmla ve Harf Hatalarını Düzelt: Klavye sürçmelerini, yanlış basılan harfleri düzelt (Örn: "janim" -> "Canım", "herkez" -> "herkes", "yalnış" -> "yanlış", "bisi" -> "bir şey", "hicbisey" -> "hiçbir şey").
2. Günlük / Bozuk Konuşma Dilini ve Kısaltmaları Doğru Türkçeye Çevir:
   - "nabion" / "nabıyon" / "napıyon" -> "ne yapıyorsun"
   - "geliyomusun" / "geliyon mu" -> "geliyor musun"
   - "naptin" -> "ne yaptın"
   - "gidiyom" -> "gidiyorum"
   - "demi" -> "değil mi"
3. Noktalama ve Büyük/Küçük Harf:
   - Cümle başlarını büyük harfle başlat.
   - Hitaplardan sonra virgül koy (Örn: "Canım, ne yapıyorsun?").
   - Cümle soru anlamı taşımıyorsa kesinlikle soru işareti koyma, nokta koy. Sadece gerçek soru anlamı taşıyan cümlelerde soru işareti (?) kullan.
   - "de/da", "ki" bağlaçlarını ve soru eki olan "mi/mı/mu/mü" eklerini kuralına göre ayır.
4. Emojileri Koru: Metindeki emojileri kesinlikle silme veya değiştirme.
5. SADECE DÜZELTİLMİŞ METNİ DÖNDÜR: Yanıtında ASLA açıklama, tırnak işareti, selamlama veya 'Düzeltilmiş hali:' gibi eklemeler yapma. Yalnızca düzeltilmiş ham cümleyi ver. Metni ASLA art arda tekrarlama.

ÖRNEKLER:
Girdi: mudur erdi simdi geliyor
Çıktı: Müdür Erdi şimdi geliyor.

Girdi: yarin ofise gec gelicem haberin olsun
Çıktı: Yarın ofise geç geleceğim, haberin olsun.

Girdi: janim nabion.
Çıktı: Canım, ne yapıyorsun?

Girdi: yarin aksam geliyomusun saat 8 de
Çıktı: Yarın akşam saat 8'de geliyor musun?

Girdi: bisi dicem sana ama kizmicaksin tmm mi
Çıktı: Bir şey diyeceğim sana ama kızmayacaksın, tamam mı?

Girdi: raporu gonderdim kontrol edebilirsin
Çıktı: Raporu gönderdim, kontrol edebilirsin.`,

  professional: `Sen kurumsal iletişim uzmanı bir Türkçe editörüsün. Kullanıcının yazdığı metni dilbilgisi, imla ve noktalama açısından kusursuz, resmi ve nazik bir Türkçe ile yeniden düzenle. Sokak dilini ve kısaltmaları profesyonel kurumsal Türkçeye çevir. Açıklama yapmadan sadece düzeltilmiş metni döndür.`,

  casual: `Sen samimi konuşma diline hakim bir Türkçe editörüsün. Mesajdaki bariz harf hatalarını, bitişik yazılan ekleri (mi, de, da) ve noktalamayı düzelt. Samimi ve sıcak havayı koru. Açıklama yapmadan sadece düzeltilmiş metni döndür.`
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
      max_tokens: 1024,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function cleanAndDeduplicate(text) {
  if (!text) return text;
  let str = text.trim();

  // Baştaki ve sondaki tırnakları temizle
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Eğer model aynı cümleyi boşluksuz veya boşluklu olarak 2 veya daha fazla kez art arda tekrarladıysa temizle
  // Örneğin: "Müdürüm, erdi, gelip?Müdürüm, erdi, gelip?Müdürüm, erdi, gelip?" -> "Müdürüm, erdi, gelip?"
  for (let len = 3; len <= Math.floor(str.length / 2); len++) {
    const chunk = str.slice(0, len);
    const parts = str.split(chunk);
    if (parts.length > 2 && parts.every(p => p === '' || p === ' ')) {
      return chunk.trim();
    }
  }

  return str;
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

    let rawCorrected = apiResult.data.choices?.[0]?.message?.content?.trim() || text;
    let correctedText = cleanAndDeduplicate(rawCorrected);

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
