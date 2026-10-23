/**
 * خادم تطبيق "راصد" السحابي (Node.js + Express + Socket.IO)
 * المرحلة الثانية: البنية التحتية السحابية والتواصل الحي بين السائقين
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1. إعداد Socket.IO مع دعم CORS لجميع النطاقات
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// تقديم الملفات الثابتة للتطبيق (HTML, CSS, JS, PWA)
app.use(express.static(__dirname));

// 2. مصفوفة حفظ البلاغات في الذاكرة (Memory Array)
const activeHazards = [
  {
    id: 'haz_seed_1',
    type: 'police',
    lat: 31.9750,
    lng: 35.8850,
    name: 'دورية أمنية - شارع المدينة المنورة',
    timestamp: Date.now() - 1000 * 60 * 15
  },
  {
    id: 'haz_seed_2',
    type: 'camera',
    lat: 31.9540,
    lng: 35.8550,
    name: 'رادار متحرك - طريق المطار',
    timestamp: Date.now() - 1000 * 60 * 30
  }
];

// 3. الاستماع لاتصال السائقين عبر Socket.IO
io.on('connection', (socket) => {
  console.log(`🚗 [راصد] سائق متصل جديد: ${socket.id}`);

  // إرسال البلاغات النشطة للمستخدم فور اتصاله
  socket.emit('load_active_hazards', activeHazards);

  // استقبال حدث new_hazard (بلاغ جديد) من أي سائق
  socket.on('new_hazard', (hazardData) => {
    console.log(`⚠️ [بلاغ جديد] مستلم من السائق (${socket.id}):`, hazardData);

    if (!hazardData) return;

    const completeHazard = {
      ...hazardData,
      id: hazardData.id || `haz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: hazardData.timestamp || Date.now()
    };

    const alreadyExists = activeHazards.some(h => h.id === completeHazard.id);
    if (!alreadyExists) {
      activeHazards.push(completeHazard);
    }

    // إعادة بثّه (Broadcast) لجميع السائقين الآخرين المتصلين
    socket.broadcast.emit('broadcast_hazard', completeHazard);
  });

  // استقبال حدث حذف بلاغ (إلغاء التنبيه) وإعادة بثّه
  socket.on('remove_hazard', (hazardId) => {
    console.log(`🗑️ [حذف بلاغ] طلب السائق (${socket.id}) حذف البلاغ: ${hazardId}`);
    const index = activeHazards.findIndex(h => h.id === hazardId);
    if (index !== -1) {
      activeHazards.splice(index, 1);
    }
    socket.broadcast.emit('hazard_removed', hazardId);
  });

  socket.on('disconnect', () => {
    console.log(`👋 [راصد] انقطع اتصال السائق: ${socket.id}`);
  });
});

// مسار فحص الحالة وطلب قائمة البلاغات عبر REST API
app.get('/api/hazards', (_req, res) => {
  res.json({
    status: 'online',
    connectedClients: io.engine.clientsCount,
    count: activeHazards.length,
    hazards: activeHazards
  });
});

// المنفذ المحدد للتشغيل
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 =========================================`);
  console.log(`🚀 خادم راصد السحابي يعمل على المنفذ ${PORT}`);
  console.log(`⚡ جاهز لمزامنة البلاغات الحية بين السائقين`);
  console.log(`📡 =========================================`);
});