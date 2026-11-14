# ผลตรวจความปลอดภัย StockLens — 14 พฤศจิกายน 2026

[คู่มือทั้งหมด](README.md) · [สถานะและข้อจำกัด](KNOWN_LIMITATIONS.md) · [เปิดแอป](https://stocklen-znwy.onrender.com/)

ตรวจโค้ดของ branch ที่ใช้บนเว็บออนไลน์ ระบบบัญชี/สิทธิ์ข้อมูล RSS/ตัวอ่านบทความ/AI/Push, dependency, ประวัติ Git, การเก็บไฟล์ในเครื่อง และการตั้งค่าเว็บ HTTPS ไม่พบช่องโหว่ระดับสูงหรือวิกฤตที่ยืนยันได้ในขอบเขตรอบนี้ พบและแก้ประเด็นด้านล่าง พร้อมทดสอบก่อนและหลังแก้

แพตช์แอปออนไลน์: [9e4b7a3](https://github.com/lew280352-sudo/StockLens/commit/9e4b7a3920c2478bc8d188fdacdf7c52deabb0b1) · แพตช์ที่ backport เข้า main: [6a4b0b0](https://github.com/lew280352-sudo/StockLens/commit/6a4b0b0) การ backport คงฟีเจอร์เดิมของ main และนำเฉพาะการแก้ด้านความปลอดภัยเข้าไป

## ประเด็นที่แก้แล้ว

| ประเด็น | ระดับ | ผลกระทบและการแก้ |
| --- | --- | --- |
| สร้างรหัสกู้คืนใหม่โดยไม่ยืนยัน MFA ซ้ำ | กลาง | ผู้ที่มีทั้งเซสชันที่ยังใช้ได้และรหัสผ่านของบัญชี MFA สามารถสร้างรหัสกู้คืนแล้วใช้รีเซ็ต MFA ได้ โดยไม่ต้องมี Authenticator แก้ให้ `/api/recovery-code` ตรวจและใช้ TOTP แบบครั้งเดียวใน transaction เดียวกับการเปลี่ยนรหัสกู้คืน พร้อมเพิ่มช่อง Authenticator ในฟอร์ม บัญชีที่ไม่ได้เปิด MFA ยังคงใช้รหัสผ่านตามเดิม |
| แพ็กเกจ `fast-xml-parser` มี advisory | ต่ำ | รุ่น 5.11.2 อยู่ในช่วงของ CVE-2026-126066 ซึ่งเกี่ยวกับการใช้ CPU มากผิดปกติเมื่อเปิด `stopNodes` แอปไม่ได้เปิดตัวเลือกนี้ จึงยังไม่ยืนยันเส้นทางโจมตีผ่านแอป แต่ปรับเป็น 5.12.1 และอัปเดต lockfile แล้ว ผล `npm audit` หลังแก้เหลือ 0 รายการ |
| สิทธิ์ไฟล์ฐานข้อมูล local เปิดกว้าง | ต่ำ · เฉพาะเครื่อง | พบโฟลเดอร์ `.data` เป็น 0777 และฐาน preview เป็น 0644 ผู้ใช้อื่นในระบบเดียวกันอาจเข้าถึงข้อมูลได้ แก้โฟลเดอร์ข้อมูลเริ่มต้น/backup เป็น 0700, ฐานและ backup เป็น 0600, จำกัด WAL/SHM ตามฐาน และปฏิเสธ symlink ที่ปลายทางไฟล์ฐาน ไม่เปลี่ยนสิทธิ์โฟลเดอร์แม่ที่ผู้ดูแลกำหนดร่วมกับแอปอื่น ข้อมูล production บน Turso ไม่ได้อยู่ในไฟล์ preview นี้ |

หลักการยืนยันปัจจัยเดิมก่อนเปลี่ยนข้อมูลที่ใช้ข้าม MFA อ้างอิง [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html#changing-mfa-factors) ส่วนเงื่อนไขและรุ่นแก้ไขของ XML parser ดู [GitHub Advisory GHSA-474x-hrwr-fgx4](https://github.com/advisories/GHSA-474x-hrwr-fgx4)

## การเสริมการป้องกัน

- เพิ่ม `Strict-Transport-Security: max-age=31536000` สำหรับ public origin ที่กำหนดเป็น HTTPS รวมหน้า API และข้อผิดพลาด ใช้ค่าจาก configuration ไม่เชื่อ `X-Forwarded-Proto` ที่ส่งมาเอง และไม่บังคับ HSTS กับ localhost สำหรับพัฒนา
- เพิ่ม CSP `object-src 'none'` โดยคงข้อกำหนด script, frame และฟอนต์เดิมของแต่ละ branch
- ตัดเครื่องมือพัฒนาและไฟล์ private signing key ออกจาก Docker build context เพิ่มเติม ไฟล์ `.env`, ฐานข้อมูลและ backup ถูกตัดออกอยู่แล้ว
- จำกัดสิทธิ์ฐาน preview และโฟลเดอร์ข้อมูล/backup ที่มีอยู่ใน workspace ให้เจ้าของเข้าถึงได้

HSTS ช่วยบังคับการเชื่อมต่อครั้งถัดไปให้เป็น HTTPS หลังเบราว์เซอร์ได้รับนโยบายผ่าน HTTPS แล้ว ไม่ได้แทนที่การตั้งค่า HTTPS ของโฮสต์ ดู [MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)

## หลักฐานการทดสอบ

| การตรวจ | ผล |
| --- | --- |
| Regression ก่อนแก้ MFA | ทดสอบใหม่ล้มเหลวตามคาด เพราะคำขอไม่มี TOTP ได้ HTTP 200; หลังแก้ต้องได้ 401 และไม่ส่งรหัสกู้คืน |
| MFA หลังแก้ | ปฏิเสธ TOTP ที่ไม่มี/เคยใช้แล้ว รับรหัสใหม่ได้ครั้งเดียว และรหัสกู้คืนที่ออกหลังยืนยันยังใช้กู้บัญชีได้ |
| Unit/API ของ branch ออนไลน์ | **91/91 ผ่าน** ครอบคลุมบัญชีแยกกัน CSRF การเพิกถอนเซสชัน MFA/recovery/OTP การอ่านบทความ การปฏิเสธ URL ภายใน และความเป็นส่วนตัวของไฟล์ |
| Unit/API ของ main หลัง backport | **71/71 ผ่าน** โดยไม่เพิ่มฟีเจอร์แอปจาก branch ออนไลน์เข้ามา |
| Browser ด้านความปลอดภัย | ผ่านทั้งสอง branch รวมสร้างรหัสกู้คืนด้วย TOTP จริงในฟอร์ม และป้องกันผล MFA/recovery ที่ตอบช้าไปปรากฏหลัง logout/เปลี่ยนบัญชี |
| Browser บทความและ PWA | ผ่านบน branch ออนไลน์ รวมการ escape XSS ผลตอบช้าหลัง logout และการไม่แคชข้อมูลบัญชีเพื่อใช้ออฟไลน์ |
| สิทธิ์ไฟล์ | ทดสอบภายใต้ umask 000, เปิดฐานเดิมที่เคยเป็น 0644, WAL/SHM และ symlink ผ่าน; ลอง backup ด้วยฐาน fixture แล้วไฟล์เป็น 0600 ในโฟลเดอร์ 0700 |
| Dependency หลังแก้ | `npm audit` ไม่พบ advisory ในแพ็กเกจที่ติดตั้งทั้ง runtime และ dev ณ วันตรวจ ไม่ใช่การยืนยันว่าแพ็กเกจไม่มีช่องโหว่ที่ยังไม่ถูกประกาศ |
| Secret scan | สแกน Git object ที่เข้าถึงได้ 885 blob ณ รอบตรวจ ไม่พบรูปแบบคีย์ผู้ให้บริการที่รู้จัก, JWT, private PEM หรือ credential assignment ที่ตรงรูปแบบที่ตรวจ ไม่พบไฟล์ private key/ฐานข้อมูล/`.env` จริงที่ถูกติดตามใน Git |
| เว็บจริงหลัง deploy | HTTPS เปิดได้; HSTS และ CSP ใหม่แสดงจริง; `/api/export` ที่ไม่มีบัญชีได้ 401; `/.env`, `/.data/stocklens.sqlite`, ไฟล์ signing key และ `/.git/config` ได้ 404; JavaScript ของฟอร์มส่ง TOTP แล้ว ไม่มีการโจมตี MFA หรือสร้างโหลดหนักบน production |

ดู source ของ regression ใน [security.test.mjs](../test/security.test.mjs), [https-policy.test.mjs](../test/https-policy.test.mjs) และ [storage-permissions.test.mjs](../test/storage-permissions.test.mjs) ผล CI ของรุ่นแก้ไขอยู่ใน [GitHub Actions](https://github.com/lew280352-sudo/StockLens/actions/runs/43615412034)

## สิ่งที่ยังต้องยืนยันหรือดูแลต่อ

- **คีย์ที่เคยแชร์:** เอกสารการตรวจเดิมระบุว่าเคยส่งคีย์ Groq/Finnhub ในแชต รอบนี้ตรวจ Git แล้ว แต่ไม่มีสิทธิ์เข้าหน้าจัดการคีย์ของผู้ให้บริการเพื่อยืนยันว่าคีย์เก่าถูกเพิกถอนแล้ว เจ้าของควรตรวจหรือเพิกถอนที่ [Groq API keys](https://console.groq.com/keys) และ [Finnhub](https://finnhub.io/dashboard) แล้วเก็บค่าที่ใช้งานใน Render Environment เท่านั้น
- **Proxy และ rate limit:** โค้ดมีการจำกัดบัญชี/IP และปฏิเสธ forwarded IP เว้นแต่กำหนด trusted hops แต่ยังไม่ได้ตรวจ topology และค่าจริงใน Render ห้ามเพิ่มจำนวน hops โดยเดา เพราะอาจเปิดให้ปลอม IP หรือทำให้ผู้ใช้หลายคนแชร์ bucket เดียวกัน
- **Turso และ backup:** ไม่ได้เข้าตรวจสิทธิ์บัญชีผู้ให้บริการ การกู้คืน backup จริง หรือนโยบายลบสำเนาเก่า การลบบัญชีในแอปไม่ได้ลบสำเนาสำรองเก่าโดยอัตโนมัติ
- **อีเมล/Push:** ยังไม่ยืนยันการส่งจริงถึงอุปกรณ์ครบ; profile Render ฟรีปิด email-login OTP ไว้ ไม่ได้บังคับยืนยันอีเมลก่อนใช้งาน การสมัครยังแจ้งเมื่ออีเมลซ้ำ จึงอาจใช้ตรวจว่ามีบัญชีอยู่ได้ภายใต้ rate limit
- **ขอบเขตการตรวจ:** เป็นการตรวจภายในและทดสอบในเครื่องร่วมกับคำขออ่านอย่างเดียวบนเว็บจริง ไม่ใช่รายงานจากผู้ตรวจอิสระ ไม่ได้ทำ stress test, ทดสอบเจาะระบบคลาวด์ หรือยืนยันการไม่มีช่องโหว่ทุกชนิด

สำหรับฐาน local ที่กำหนดพาธเอง ให้ใช้โฟลเดอร์ส่วนตัวของ service user และเก็บคีย์ MFA/VAPID คู่กับ backup อย่างปลอดภัย ส่วน Android ต้องสำรอง release signing key เพื่อออกอัปเดตด้วยลายเซ็นเดิม ดู [คู่มือนักพัฒนา](DEVELOPMENT.md) และ [คู่มือผู้ดูแล](OPERATIONS.md)
