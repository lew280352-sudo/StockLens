# ใช้ StockLens จากมือถือนอกบ้านแบบส่วนตัวและฟรี

ทางเลือกนี้ใช้ [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) ให้ HTTPS ที่เข้าถึงได้เฉพาะอุปกรณ์ใน tailnet เดียวกัน ไม่เปิดแอปให้คนทั่วไปเข้าถึง เหมาะกับการใช้ส่วนตัวบนคอมและมือถือ [Personal plan](https://tailscale.com/pricing) ของ Tailscale ไม่มีค่าใช้จ่ายสำหรับการใช้ส่วนตัวตามเงื่อนไขปัจจุบัน คอมที่รัน StockLens ยังต้องเปิดเครื่องและเชื่อมอินเทอร์เน็ตตลอดเวลาที่จะใช้งาน

1. ติดตั้ง [Tailscale บน Windows](https://tailscale.com/docs/install/windows) และบนมือถือ แล้ว Login ด้วยบัญชีเดียวกันทั้งสองเครื่อง เปิด HTTPS certificates ใน tailnet เมื่อ Tailscale ขอให้ยืนยัน
2. หยุด StockLens ที่กำลังรันบนพอร์ต 4173 ก่อน จากโฟลเดอร์ `stocklens` เปิด PowerShell แล้วรัน `./scripts/start-private.ps1` สคริปต์จะตรวจชื่อเครื่องใน tailnet, ตั้ง `APP_ORIGIN` ให้ตรง HTTPS, เปิด Node บน `127.0.0.1`, แล้วเปิด `tailscale serve --bg` โดยไม่เปลี่ยนค่า `.env` หรือเปิดพอร์ต LAN
3. เปิด URL `https://<ชื่อเครื่อง>.<tailnet>.ts.net` ที่สคริปต์แสดงบนมือถือขณะ Tailscale เชื่อมต่อ แล้ว Login StockLens ตามปกติ ลิงก์และ PID บันทึกไว้ที่ `.data/private-preview.json` ซึ่ง Git ไม่ติดตาม
4. ตรวจการแจ้งเตือน: บนมือถือไปที่ **การแจ้งเตือน** → **เปิด Push บนอุปกรณ์นี้** → อนุญาต แล้วปิดหน้าแอป จากคอมที่ Login บัญชีเดียวกัน กด **ส่งทดสอบ** และตรวจว่ามือถือได้รับจริง ผลการทดสอบบนมือถือจริงยังต้องยืนยันเอง

Tailscale Serve แบบ `--bg` คงการตั้งค่าไว้หลังรีสตาร์ท Tailscale แต่ Node/StockLens ต้องเริ่มใหม่เมื่อคอมรีสตาร์ท หากต้องการให้ Tailscale เชื่อมต่อแม้ยังไม่ Login Windows ให้เปิด [Run unattended](https://tailscale.com/docs/how-to/run-unattended) ตามคู่มือทางการ การตั้งค่านี้ไม่ทำให้ StockLens รันเองเมื่อบูต

หากต้องการหยุดแชร์ใน tailnet ให้รัน `tailscale serve --https=443 off` และหยุด process StockLens ที่บันทึกใน `.data/private-preview.json` หลังตรวจ PID ให้ตรงก่อน ห้ามใช้ `tailscale funnel` แทน เพราะ Funnel เปิดสู่สาธารณะ

การส่งรหัส Login ทางอีเมลยังต้องมี SMTP จริง หากใช้ Gmail ต้องเปิด 2-Step Verification และสร้าง [App Password](https://support.google.com/mail/answer/185833?hl=en) ด้วยตนเอง แล้วใส่ใน `.env` เท่านั้น ไม่ส่งรหัสผ่านหรือ App Password ในแชตหรือ Git ดูวิธีทดสอบใน [คู่มือผู้ใช้](USER_GUIDE.md) และยังไม่ควรเปิด `EMAIL_LOGIN_OTP_ENABLED=true` จนกว่าส่งและรับอีเมลจริงได้
