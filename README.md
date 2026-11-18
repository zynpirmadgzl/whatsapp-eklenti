# ✨ WhatsApp Web Yazım & Noktalama Düzeltici

WhatsApp Web üzerinde yazdığınız mesajları tek bir tıkla veya klavye kısayoluyla, anlamını ve samimiyetini bozmadan Türkçenin imla kurallarına ve noktalama işaretlerine uygun şekilde düzelten **%100 ücretsiz** ve açık kaynaklı bir Chrome tarayıcı eklentisidir.

Arka planda dünyanın en hızlı yapay zeka işlemcisi olan **Groq AI (Llama 3.1 8B)** ücretsiz API'sini kullanır.

---

## 🌟 Neler Yapar?

* **Canlı & Otomatik Değiştirme:** Mesaj kutusundaki hatalı metni otomatik olarak siler ve yerine saniyesinde düzeltilmiş halini yazar. Kopyala-yapıştır yapmanıza gerek kalmaz.
* **Akıllı Konuşma Dili Düzeltme:** Günlük internet yazışmalarını ve klavye sürçmelerini anlar ve düzeltir.
* **Doğru Noktalama & Hitap:** Hitaplardan sonra virgül koyar, soru anlamı taşıyan cümlelerin sonuna otomatik soru işareti (?) ekler, bağlaçları (de/da/ki) ve soru eklerini (mi/mı) doğru ayırır.
* **Tek Tıkla Kopyalama:** Eklenti menüsündeki test alanında düzeltilmiş metni tek tıkla kopyalamak için kopyalama butonu bulunur.

### 📝 Örnek Düzeltmeler

| Yazılan Hatalı Metin | Düzeltilmiş Hali |
| :--- | :--- |
| `janim nabion.` | **Canım, ne yapıyorsun?** |
| `yarin saat 3 te bulusalımmı gelicek misin` | **Yarın saat 3'te buluşalım mı? Gelecek misin?** |
| `bisi dicem sana ama kizmicaksin tmm mi` | **Bir şey diyeceğim sana ama kızmayacaksın, tamam mı?** |
| `herkez ordaydi ama hicbisey konusulmadi` | **Herkes oradaydı ama hiçbir şey konuşulmadı.** |

---

## 🚀 3 Adımda Kolay Kurulum

### 1. Adım: Ücretsiz Groq API Anahtarı Alın (30 Saniye)
1. [console.groq.com/keys](https://console.groq.com/keys) adresine gidin.
2. Google hesabınızla ücretsiz giriş yapın (Kredi kartı **asla istenmez**).
3. **"Create API Key"** butonuna tıklayın, bir isim verip anahtarı kopyalayın (`gsk_...` ile başlar).

---

### 2. Adım: Eklentiyi Tarayıcınıza Yükleyin
Chrome, Brave, Edge veya Opera tarayıcınızda:
1. Projeyi bilgisayarınıza indirin veya klonlayın:
   ```bash
   git clone https://github.com/zynpirmadgzl/whatsapp-eklenti.git
   ```
2. Tarayıcınızın adres çubuğuna `chrome://extensions` yazıp Enter'a basın (Edge için `edge://extensions`).
3. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
4. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın ve `whatsapp-eklenti` klasörünü seçin.
5. Eklenti anında tarayıcınıza yüklenecektir! 🎉

---

### 3. Adım: API Anahtarınızı Kaydedin
1. Tarayıcınızın sağ üstündeki yapboz simgesine 🧩 tıklayıp **WhatsApp Yazım Düzeltici** eklentisini açın (kolay erişim için sabitleyebilirsiniz).
2. 1. Adımda kopyaladığınız `gsk_...` anahtarını kutucuğa yapıştırıp **"Kaydet & Doğrula"** butonuna basın.
3. "Hazır ✓" yazısını gördüğünüzde her şey tamamdır!

---

## 💬 WhatsApp Web'de Nasıl Kullanılır?

1. [web.whatsapp.com](https://web.whatsapp.com) adresini açın *(sayfa önceden açıksa `Cmd + R` ile yenileyin)*.
2. Bir sohbete girip mesaj kutusuna cümlenizi yazın.
3. Düzeltmek için:
   - **Klavye Kısayolu:** **`Cmd + Shift + D`** veya **`Option + D`** (Windows için `Alt + D`) tuşlarına basın.
   - **Tıklayarak:** Mesaj kutusunun sağ köşesinde beliren **Sihirli Değnek ✨** butonuna tıklayın.
4. Cümleniz anında imla ve noktalama açısından kusursuz hale getirilir ve kutudaki yazının yerine otomatik yazılır.

---

## 🔒 Gizlilik, KVKK ve Güvenlik

* **BYOK (Kendi Anahtarını Getir):** Merkezi bir sunucu veya veritabanı yoktur. Her kullanıcı kendi ücretsiz Groq hesabını kullanır.
* **Sıfır İzleme & Kayıt:** Mesaj geçmişi, kişiler, gelen mesajlar veya sohbetler asla okunmaz, kaydedilmez veya izlenmez. Yalnızca butona veya kısayola bastığınız an kutudaki metin işlenmek üzere Groq API'ye iletilir.
* **Güvenli Depolama:** API anahtarınız kodların içinde yer almaz; yalnızca kendi tarayıcınızın izole şifreli hafızasında saklanır.

---

## 👩‍💻 Geliştirici
Geliştirici: **Zeynep İrem Adıgüzel**  
GitHub: [@zynpirmadgzl](https://github.com/zynpirmadgzl)
