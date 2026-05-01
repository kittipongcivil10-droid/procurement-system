# PRO Procurement System — API Ready Package

ชุดนี้รวมไฟล์พร้อมรันสำหรับ Flask + SQLite + Frontend ที่เริ่มเชื่อม Database จริงผ่าน API แล้ว

## แก้ไขแล้วใน Package นี้

1. Backend Flask รันได้
   - `/health`
   - `/api/health`
   - `/api/departments`
   - `/api/projects`
   - `/api/vendors`
   - `/api/users`
   - `/api/login`

2. SQLite Database
   - สร้างไฟล์ `database/procurement.db` อัตโนมัติ
   - มี migration เบื้องต้น กรณี database เก่ามี column ไม่ครบ
   - สร้าง admin เริ่มต้น: `admin / admin123`

3. Frontend เชื่อม API แล้วสำหรับ Master Data
   - Departments
   - Projects
   - Vendors
   - Users
   - Login

4. Responsive รองรับ Tablet / มือถือ ตามไฟล์ CSS เดิมที่ปรับแล้ว

## วิธีติดตั้ง

```bash
pip install flask
python app.py
```

เปิดเว็บ:

```text
http://127.0.0.1:5000
```

เช็ก API:

```text
http://127.0.0.1:5000/api/health
```

Login:

```text
admin / admin123
```

## วิธีเช็กว่า Frontend เชื่อม Database แล้ว

1. เปิด `http://127.0.0.1:5000`
2. กด F12
3. ไปที่ Network → Fetch/XHR
4. กด Reload
5. ต้องเห็น request เช่น:
   - `/api/departments`
   - `/api/projects`
   - `/api/vendors`
   - `/api/users`

## หมายเหตุสำคัญ

ตอนนี้เชื่อมฐานข้อมูลจริงแล้วในส่วน Master Data ก่อน ได้แก่ แผนก / โครงการ / ผู้ขาย / ผู้ใช้งาน
ขั้นต่อไปควรเชื่อม PR → PO → GRN → Stock ต่อเป็นลำดับ

หากต้องการเริ่ม database ใหม่แบบสะอาด ให้หยุด server แล้วลบไฟล์:

```text
database/procurement.db
```

จากนั้นรันใหม่:

```bash
python app.py
```
