// plugins/marketing-analyzer/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // Bảo mật HTTP headers
const rateLimit = require('express-rate-limit'); // Giới hạn request
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // Giới hạn 100 request/15 phút

// Kết nối MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/marketingDB';
mongoose.connect(mongoUri, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema cho dữ liệu phân tích
const AnalysisSchema = new mongoose.Schema({
  adSpend: { type: Number, required: true },
  revenue: { type: Number, required: true },
  conversions: { type: Number, default: 0 },
  roi: Number,
  cpa: Number,
  date: { type: Date, default: Date.now },
  userId: String // Nếu cần theo dõi user-specific
});
const Analysis = mongoose.model('Analysis', AnalysisSchema);

// Middleware xác thực API Key
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

// API phân tích dữ liệu
app.post('/analyze', authenticate, async (req, res) => {
  try {
    const { adSpend, revenue, conversions = 0, userId } = req.body;

    // Validation
    if (!adSpend || !revenue || adSpend < 0 || revenue < 0) {
      return res.status(400).json({ error: 'adSpend và revenue phải là số dương' });
    }

    // Tính toán chỉ số
    const roi = ((revenue - adSpend) / adSpend) * 100;
    const cpa = conversions > 0 ? adSpend / conversions : null;

    // Đề xuất chiến lược
    let suggestion;
    if (roi > 100) suggestion = 'Chiến dịch rất hiệu quả. Đề xuất tăng ngân sách hoặc mở rộng kênh.';
    else if (roi > 50) suggestion = 'Chiến dịch ổn. Xem xét tối ưu hóa nhắm mục tiêu hoặc nội dung.';
    else suggestion = 'ROI thấp. Đề xuất thử A/B testing hoặc đổi kênh quảng cáo.';

    // Lưu vào database
    const analysis = new Analysis({
      adSpend,
      revenue,
      conversions,
      roi,
      cpa,
      userId
    });
    await analysis.save();

    // Trả kết quả
    res.status(200).json({
      roi: `${roi.toFixed(2)}%`,
      cpa: cpa ? `${cpa.toFixed(2)} VND` : 'Không có dữ liệu chuyển đổi',
      suggestion,
      analysisId: analysis._id,
      history: await Analysis.find({ userId }).sort({ date: -1 }).limit(5) // Lịch sử 5 lần gần nhất
    });
  } catch (error) {
    console.error('Error in /analyze:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// API lấy lịch sử phân tích
app.get('/history', authenticate, async (req, res) => {
  try {
    const { userId } = req.query;
    const history = await Analysis.find(userId ? { userId } : {}).sort({ date: -1 }).limit(10);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`MarketingAnalyzer running on port ${port}`);
});
