# รันซอร์สโค้ดและพัฒนา StockLens

[คู่มือทั้งหมด](README.md) · [ติดตั้งสำหรับผู้ใช้งานทั่วไป](INSTALLATION.md)

เอกสารนี้สำหรับผู้ที่ต้องการรันเซิร์ฟเวอร์เองหรือแก้ซอร์สโค้ด หากต้องการใช้แอป ให้เปิด [StockLens ออนไลน์](https://stocklen-znwy.onrender.com/) ได้ทันที

## เตรียมเครื่องและรัน

ใช้ Git, Node.js **24 ขึ้นไป** และอินเทอร์เน็ต ตัวอย่างนี้ดึง branch ที่ใช้กับบริการออนไลน์ เพื่อรับการแก้ไขล่าสุด รวมแพตช์ความปลอดภัย

### Windows

```powershell
git clone --branch feat/stocklens-ui-and-online https://github.com/lew280352-sudo/StockLens.git
cd StockLens
npm.cmd ci
npm.cmd start
```

เปิด **http://127.0.0.1:4173** หลังติดตั้งแพ็กเกจแล้วใช้ `start-stocklens.cmd` เพื่อเปิดเซิร์ฟเวอร์ได้

### macOS และ Linux

```sh
git clone --branch feat/stocklens-ui-and-online https://github.com/lew280352-sudo/StockLens.git
cd StockLens
npm ci
npm start
```

เซิร์ฟเวอร์ต้องทำงานค้างไว้ ฐานข้อมูล local อยู่ใน `.data/stocklens.sqlite` บัญชี local แยกจากบัญชีบนเว็บออนไลน์ สำรองข้อมูลก่อนอัปเดตหรือเปลี่ยนเครื่อง ไม่เปิด `dist/index.html` โดยตรงเพราะระบบบัญชีและ API ต้องใช้เซิร์ฟเวอร์

## ตั้งค่าบริการ

ดูชื่อตัวแปรใน `.env.example` เก็บค่าจริงใน `.env` หรือ Environment ของโฮสต์ ไม่ใส่คีย์ลง Git

- [AI ออนไลน์ Gemini/Groq](AI_ONLINE.md) และ [Ollama บนเครื่อง](LOCAL_AI.md)
- [ข่าว ราคาและกราฟ](PRICE_WIDGETS.md) และ [ตัวอ่านบทความ](ARTICLE_SUMMARIES.md)
- [SMTP และรหัสอีเมลหลังกรอกรหัสผ่าน](USER_GUIDE.md#รหัสอีเมลหลังกรอกรหัสผ่าน)
- [Render + Turso](FREE_CLOUD.md), [Docker/backup/restore](OPERATIONS.md) และ [HTTPS ส่วนตัว](PRIVATE_ACCESS.md)

GitHub Pages ไม่รัน Node.js backend ของแอปนี้ การโฮสต์ของตัวเองต้องมี Node.js หรือ Docker, ฐานข้อมูลที่เก็บข้อมูลได้ถาวร และ HTTPS ตามคู่มือผู้ดูแล

## ตรวจการเปลี่ยนแปลง

```sh
npm test
npx playwright install chromium
npm run test:ui
npm run test:account-ui
npm run test:article-ui
npm run test:pwa
npm run test:users
```

บน Windows ใช้ `npm.cmd`/`npx.cmd` ได้ ชุดทดสอบใช้ฐานข้อมูลแยกจากข้อมูลจริง สคริปต์อื่นสำหรับ responsive, ความปลอดภัย ราคา และแนวโน้มดูใน `package.json` เลือกตรวจตามส่วนที่แก้ไข

## Android และการเผยแพร่

[คู่มือ Android ของรุ่น APK](https://github.com/lew280352-sudo/StockLens/blob/android-v0.9.2-beta.1/android/README.md) อธิบาย JDK/SDK, lint/build, Digital Asset Links และการลงนาม รุ่นใหม่ต้องใช้ private release key เดิมและเพิ่ม `versionCode` เก็บสำรองคีย์และรหัสผ่านไว้นอก Git ก่อนลบ workspace
