const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const memberRoutes = require("./routes/memberRoutes");
const profileRoutes = require("./routes/profileRoutes");


const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/profiles", profileRoutes);

app.use(errorMiddleware);

module.exports = app;