# ติดตั้ง StockLens

[กลับหน้าแรก](../README.md) · [เริ่มใช้งาน](USER_GUIDE.md) · [คู่มือทั้งหมด](README.md)

ทุกอุปกรณ์เปิด [StockLens ออนไลน์](https://stocklen-znwy.onrender.com/) เพื่อใช้งานได้ทันที การติดตั้งช่วยให้เปิดแอปจากไอคอนบนเครื่อง ข่าว ราคา AI และการเข้าสู่ระบบยังต้องใช้อินเทอร์เน็ต

## Android

### ติดตั้งไฟล์ APK

รองรับ Android 8 ขึ้นไป ต้องมี Chrome หรือเบราว์เซอร์ที่รองรับ Trusted Web Activity รุ่นปัจจุบันคือ **0.9.2 Beta**

1. ใช้มือถือเปิด [ดาวน์โหลด StockLens APK](https://github.com/lew280352-sudo/StockLens/releases/download/android-v0.9.2-beta.1/StockLens-0.9.2-beta.1.apk) หรือเลือกไฟล์ `.apk` ใน [หน้า Release](https://github.com/lew280352-sudo/StockLens/releases/tag/android-v0.9.2-beta.1)
2. เปิดไฟล์ที่ดาวน์โหลด หาก Android ขอสิทธิ์ติดตั้งจากแหล่งนี้ ให้อนุญาตเฉพาะเบราว์เซอร์หรือตัวจัดการไฟล์ที่ใช้เปิด APK แล้วกลับมากด **ติดตั้ง**
3. เปิด **StockLens** จากหน้าแอป สมัครบัญชีใหม่หรือเข้าสู่ระบบด้วยบัญชี StockLens ที่มีอยู่

หาก Android แสดงขั้นตอนยืนยันเพิ่มเติม ให้ทำตามขั้นตอนของระบบ ดู [คำอธิบายการยืนยันนักพัฒนาจาก Android](https://support.google.com/android/answer/17065026?hl=en) หรือเลือกติดตั้งแบบ PWA ด้านล่าง

ไฟล์ APK ลงนามแล้ว และมี [SHA256SUMS.txt](https://github.com/lew280352-sudo/StockLens/releases/download/android-v0.9.2-beta.1/SHA256SUMS.txt) สำหรับตรวจไฟล์ รุ่นนี้ผ่านการลองติดตั้งบน Android 15 จำลอง การเปิดแอป สมัคร/เข้าสู่ระบบ สลับธีม และออกจากระบบแล้ว

### ติดตั้งผ่าน Chrome โดยไม่ใช้ APK

1. เปิด [StockLens](https://stocklen-znwy.onrender.com/) ใน Chrome
2. เปิดเมนูจุดสามจุด → **ติดตั้ง / Install** หรือ **Install and create shortcut → Install** ชื่อเมนูอาจต่างกันตามรุ่น
3. ยืนยัน แล้วเปิดจากไอคอน StockLens บนเครื่อง

ดู [คู่มือ Chrome บน Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en) สำหรับชื่อเมนูของเบราว์เซอร์

## Windows

ติดตั้งเป็นเว็บแอปผ่าน Edge หรือ Chrome ได้ โดยไม่ต้องติดตั้ง Node.js

1. เปิด [StockLens](https://stocklen-znwy.onrender.com/) ใน Edge หรือ Chrome
2. กดไอคอน **ติดตั้ง / Install** ด้านขวาของแถบที่อยู่ หากไม่เห็นไอคอน ให้ใช้เมนู:
   - **Edge:** จุดสามจุด → **More tools → Apps → Install this site as an app** บางรุ่นมีเมนู **Apps** ให้เลือกโดยตรง
   - **Chrome:** จุดสามจุด → **Cast, save, and share → Install page as app**
3. ยืนยัน **Install** แล้วเปิด StockLens จากเมนู Start หรือปักหมุดไว้ที่แถบงาน

รายละเอียดเมนู: [Microsoft Edge](https://support.microsoft.com/en-US/edge/install-manage-or-uninstall-apps-in-microsoft-edge) · [Google Chrome](https://support.google.com/chrome/answer/9658361?hl=en)

## macOS

- **Safari บน macOS Sonoma 14 ขึ้นไป:** เปิด [StockLens](https://stocklen-znwy.onrender.com/) → **File → Add to Dock** → ตั้งชื่อ **StockLens** → **Add** จากนั้นเปิดจาก Dock หรือ Spotlight
- **Chrome:** เปิดเว็บ → ไอคอนติดตั้งที่แถบที่อยู่ หรือ **Cast, save, and share → Install page as app** → **Install**

ขั้นตอน Safari อ้างอิง [Apple Support](https://support.apple.com/en-us/104996)

## iPhone และ iPad

1. เปิด [StockLens](https://stocklen-znwy.onrender.com/) ใน **Safari** หากเปิดจากแอปแชต ให้เปิดลิงก์ใน Safari ก่อน
2. กด **แชร์ / Share** หากซ่อนอยู่ให้เปิดเมนูของหน้าก่อน แล้วเลือก **เพิ่มไปยังหน้าจอโฮม / Add to Home Screen** บน iPad อาจต้องกด **View More** ก่อน
3. เปิด **Open as Web App** หากระบบมีตัวเลือกนี้ ตั้งชื่อ **StockLens** แล้วกด **เพิ่ม / Add**
4. เปิดไอคอนบนหน้าจอโฮม แล้วเข้าสู่ระบบด้วยบัญชี StockLens

ดูขั้นตอนของ [iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios) และ [iPad](https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados) เมนูอาจต่างกันตามรุ่นระบบ

## Linux และ Chromebook

เปิด [StockLens](https://stocklen-znwy.onrender.com/) ใน Chrome → ไอคอนติดตั้งที่แถบที่อยู่ หรือ **Cast, save, and share → Install page as app** → ยืนยัน จากนั้นเปิดจากเมนูแอปของเครื่อง ดู [คู่มือ Chrome](https://support.google.com/chrome/answer/9658361?hl=en)

## อัปเดต ถอนการติดตั้ง และแก้ปัญหา

| เรื่อง | วิธีทำ |
| --- | --- |
| อัปเดตแอป | ส่วนเว็บรับการอัปเดตจากบริการออนไลน์ หากค้างที่หน้าเก่าให้ปิดแล้วเปิดใหม่ APK รุ่นใหม่ดูที่ [GitHub Releases](https://github.com/lew280352-sudo/StockLens/releases) แล้วติดตั้งทับรุ่นเดิม |
| ไม่เห็นปุ่มติดตั้ง | เปิดลิงก์ในเบราว์เซอร์โดยตรง อัปเดตเบราว์เซอร์ ใช้หน้าต่างปกติ แล้วลองเมนูติดตั้งตามอุปกรณ์ ระหว่างนี้ใช้ผ่านเว็บได้ |
| เปิดครั้งแรกช้า | โฮสต์ฟรีอาจพักบริการ รอสักครู่แล้วลองเปิดใหม่ ข่าวและ AI ต้องใช้อินเทอร์เน็ต |
| APK เปิดเป็นหน้า Chrome | ตรวจว่า Chrome เปิดใช้งานและเป็นรุ่นปัจจุบัน APK อาศัยเบราว์เซอร์ในการแสดงบริการเว็บ |
| เปลี่ยนอุปกรณ์แล้วต้องเข้าสู่ระบบใหม่ | ใช้บัญชี StockLens เดิมได้ การติดตั้งแต่ละเบราว์เซอร์หรืออุปกรณ์อาจมีเซสชันแยกกัน |
| ถอนการติดตั้ง | Android ใช้การตั้งค่าแอป; Windows ใช้ Settings → Apps หรือเมนูถอนการติดตั้งของเว็บแอป; iPhone/iPad ลบไอคอนจากหน้าจอโฮม; Mac/Linux/Chrome ใช้เมนูจัดการแอปของระบบหรือเบราว์เซอร์ |
| ต้องการลบบัญชี | ถอนแอปอย่างเดียวไม่ได้ลบบัญชีบนเซิร์ฟเวอร์ ให้ใช้เมนูลบบัญชีในแอปตาม [คู่มือบัญชี](USER_GUIDE.md#2-สมัครสมาชิกและเก็บรหัสกู้คืน) |

หากต้องการรันเซิร์ฟเวอร์ของตัวเอง ให้ดู [คู่มือสำหรับนักพัฒนา](DEVELOPMENT.md) แทนขั้นตอนติดตั้งสำหรับผู้ใช้งานทั่วไป
