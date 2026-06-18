const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const panelRoutes = require('./routes/panelRoutes');
const cobradorRoutes = require('./routes/cobradorRoutes');
const descansosRoutes = require('./routes/descansosRoutes');
const horariosRoutes = require('./routes/horariosRoutes');
const mensajesRoutes = require('./routes/mensajesRoutes');
const mediosPagoRoutes = require('./routes/mediosPagoRoutes');
const arqueosRoutes = require('./routes/arqueosRoutes');
const cron = require('node-cron');
const { activarAlmuerzosAutomaticos } = require('./services/descansoCron');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Archivos estáticos: fotos de evidencia subidas por los cobradores
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
    res.json({ mensaje: "API cobrApp funcionando 🚀" });
});

app.use('/api/auth', authRoutes);
app.use('/api', panelRoutes);
app.use('/api/cobrador', cobradorRoutes);
app.use('/api/descansos', descansosRoutes);
app.use('/api/supervisor/horarios', horariosRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/medios-pago', mediosPagoRoutes);
app.use('/api/arqueos', arqueosRoutes);

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
        message: 'Error interno del servidor',
        detail: error.message,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

// ── Cron: activar descanso de almuerzo automáticamente a las 14:30 ──
cron.schedule('30 14 * * *', () => {
    activarAlmuerzosAutomaticos().catch(console.error);
}, { timezone: 'America/Asuncion' });