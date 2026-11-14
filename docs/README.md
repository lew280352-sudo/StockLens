# คู่มือ StockLens

[กลับหน้าแรก](../README.md) · [เปิดแอป](https://stocklen-znwy.onrender.com/)

## สำหรับผู้ใช้งาน

| คู่มือ | เนื้อหา |
| --- | --- |
| [ติดตั้งทุกอุปกรณ์](INSTALLATION.md) | Android APK/PWA, Windows, macOS, iPhone/iPad, Linux และ Chromebook พร้อมแก้ปัญหาการติดตั้ง |
| [เริ่มใช้งานและจัดการบัญชี](USER_GUIDE.md) | สมัคร/เข้าสู่ระบบ รหัสกู้คืน บริษัทที่ติดตาม ข่าว ราคา AI และอุปกรณ์ |
| [เกี่ยวกับแอป](ABOUT.md) | ความสามารถ แหล่งข้อมูล ความเป็นส่วนตัว และสถานะของบริการ |
| [สรุปบทความและถาม AI](ARTICLE_SUMMARIES.md) | แหล่งที่อ่านได้ ข้อจำกัดการอ่าน การอ้างอิง และโควตา |
| [ราคา กราฟ และแนวโน้ม](PRICE_WIDGETS.md) | Finnhub, TradingView ช่วงเวลาเปรียบเทียบและขอบเขตข้อมูล |
| [สถานะและข้อจำกัด](KNOWN_LIMITATIONS.md) | สิ่งที่ใช้งานได้ สิ่งที่ต้องตั้งค่า และสิ่งที่ยังไม่ได้ยืนยัน |

## สำหรับผู้ดูแลและนักพัฒนา

| คู่มือ | เนื้อหา |
| --- | --- |
| [รันซอร์สโค้ดและทดสอบ](DEVELOPMENT.md) | เตรียมเครื่อง Windows/macOS/Linux รันเซิร์ฟเวอร์ และตรวจการเปลี่ยนแปลง |
| [ตั้งค่า AI ออนไลน์](AI_ONLINE.md) | Gemini/Groq, Environment บน Render, โควตาและการตรวจบริการจริง |
| [AI บนเครื่อง](LOCAL_AI.md) | Ollama และการตั้งค่าโมเดลบนคอมพิวเตอร์ส่วนตัว |
| [โฮสต์ฟรี Render + Turso](FREE_CLOUD.md) | เชื่อมฐานข้อมูล ตั้งค่า HTTPS ข้อจำกัดของโฮสต์ฟรี และ backup |
| [ดูแลเซิร์ฟเวอร์](OPERATIONS.md) | Docker การสำรอง/กู้คืน การอัปเดต และการเปิดใช้งานภายนอก |
| [HTTPS ส่วนตัว](PRIVATE_ACCESS.md) | เปิดแอปภายในเครือข่ายส่วนตัวผ่าน Tailscale |
| [สร้างและลงนาม Android APK](https://github.com/lew280352-sudo/StockLens/blob/android-v0.9.2-beta.1/android/README.md) | เครื่องมือ build, release key และการสำรองคีย์สำหรับอัปเดต APK |
| [การตรวจความปลอดภัยภายใน](SECURITY_REVIEW.md) | ขอบเขตการตรวจ ผลที่พบ และงานสำหรับการตรวจภายนอก |

## ผลทดสอบและบันทึกรุ่น

สถานะปัจจุบันดูจาก [GitHub Actions](https://github.com/lew280352-sudo/StockLens/actions) และ [GitHub Releases](https://github.com/lew280352-sudo/StockLens/releases) บันทึกด้านล่างเป็นผล ณ เวลาที่ทดสอบ จึงอาจอธิบายหน้าตาหรือข้อจำกัดของรุ่นก่อนหน้า

- [รายการตรวจรับระบบ](VALIDATION.md)
- [การลองใช้และข้อเสนอปรับปรุง UI](USABILITY_AUDIT_2026-10-21.md)
- [ผลทดสอบผู้ใช้จำลอง 20 คน](TEST_20_USERS.md)
- [รุ่น 0.3](RELEASE_03.md) · [0.3.1](RELEASE_031.md) · [Local AI 0.4](RELEASE_04.md) · [รายการติดตาม 0.5](RELEASE_05.md) · [AI ออนไลน์ 0.6](RELEASE_06.md)
